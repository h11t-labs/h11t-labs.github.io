---
title: "release-please bumps your version but forgets uv.lock"
description: "release-please updates pyproject.toml but not uv.lock's self-referential version pin, so `uv sync --locked` fails on the release commit. Here's a clean fix that keeps the lock in sync inside the release PR."
pubDate: 2026-07-22
key: release-please-uv-lock
lang: en
readMin: 5
repo: https://github.com/h11t-labs/kobo2readwise
tags: ["release-please", "uv", "github-actions", "ci-cd", "python"]
---

If you version a Python project with [release-please](https://github.com/googleapis/release-please)
and lock dependencies with [uv](https://docs.astral.sh/uv/), there's a small trap
that stays hidden until the worst possible moment — the release commit itself.

## The problem

release-please's `python` release type bumps the version in `pyproject.toml` (and
`CHANGELOG.md`, and the manifest). It does **not** touch `uv.lock`. But uv writes a
self-referential entry for your own project into the lockfile:

```toml
[[package]]
name = "my-project"
version = "0.1.0"
source = { virtual = "." }
```

That `version` pin is now stale. So the moment the release PR merges and CI runs
`uv sync --locked`, it fails:

```
error: The lockfile at `uv.lock` needs to be updated, but `--locked` was provided.
```

The nasty part: it's green on every feature PR — no version change there — and only
blows up on the **release**, right when you're trying to ship. If your deploy is gated
on that CI job, nothing goes out.

## Two ways out

The honest, simple option is **`uv sync --frozen`** instead of `--locked`. It uses the
lockfile exactly as committed, so it doesn't care that the version pin drifted — and it's
already what most Dockerfiles do. You give up two things: the `--locked` check that
catches "someone edited a dependency but forgot to re-lock" (though `uv add`/`uv remove`
keep the lock in sync anyway, and a genuinely missing dependency still fails your tests),
and the lock's version pin now trails the real version by a release (cosmetic, but it
reads like a bug). For plenty of projects that's a perfectly reasonable trade — and if you
take it, you can stop reading here.

The catch worth knowing: this drift doesn't only hit the release commit. Once a release
merges, `main` has the new `pyproject.toml` version next to the old `uv.lock` pin, so the
**next feature PR** fails `uv sync --locked` too. So if you want `--locked` to keep
working anywhere, *something* has to bump `uv.lock` when the version bumps. The clean place
to do that is the release PR itself.

## The fix: sync uv.lock inside the release PR

release-please tells you when it opened a release PR (`prs_created`) and on which branch
(`pr.headBranchName`). So right after the action runs, check out that branch, regenerate
the lock, and commit **only** the version-pin change back into the PR:

```yaml
- uses: googleapis/release-please-action@v4
  id: release
  with:
    config-file: release-please-config.json
    manifest-file: .release-please-manifest.json

- name: Checkout release PR branch
  if: steps.release.outputs.prs_created == 'true'
  uses: actions/checkout@v4
  with:
    ref: ${{ fromJSON(steps.release.outputs.pr).headBranchName }}

- name: Set up uv
  if: steps.release.outputs.prs_created == 'true'
  uses: astral-sh/setup-uv@v6

- name: Sync uv.lock version pin in the release PR
  if: steps.release.outputs.prs_created == 'true'
  run: |
    uv lock
    if git diff --quiet -- uv.lock; then
      echo "uv.lock already in sync"; exit 0
    fi
    numstat=$(git diff --numstat -- uv.lock)
    read -r added deleted _ <<< "$numstat"
    diff_output=$(git diff -U3 -- uv.lock)
    if [ "$added" != "1" ] || [ "$deleted" != "1" ] \
       || ! echo "$diff_output" | grep -qE '^\+version = "[0-9]+\.[0-9]+\.[0-9]+"$' \
       || ! echo "$diff_output" | grep -q 'name = "my-project"'; then
      echo "::error::uv lock changed more than the version pin — refusing to auto-commit."
      echo "$diff_output"; exit 1
    fi
    git config user.name "github-actions[bot]"
    git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
    git add uv.lock
    git commit -m "chore: sync uv.lock version pin"
    git push
```

You'll need `permissions: contents: write` on the job for that push.

## The guard is the important bit

The naive version just runs `uv lock && git commit -am … && git push`. Don't. `uv lock`
can also pull in **newer dependency releases** any time a `>=` range resolves to a fresh
publish. If that happens during a release, you'd silently smuggle a dependency bump into
a release PR that's supposed to be nothing but a version bump.

So the script asserts the diff is **exactly one line changed**, that the added line is a
`version = "x.y.z"` pin, and that it sits next to your project's `name`. Anything else →
**fail the job loudly**. A real dependency change then gets its own `chore(deps)` PR,
where it belongs, instead of hiding inside a release.

The trade-off: when the guard trips, it **blocks the release** until you land that
`chore(deps)` PR. In practice it rarely fires — a plain `uv lock` doesn't upgrade
already-pinned dependencies, so on a version-only bump the diff really is that one line —
but it's deliberate strictness, not a free lunch. If you'd rather let dependency bumps ride
along, drop the guard; just know what you're trading away.

## One gotcha about tokens

That step pushes to the release PR branch. The default `GITHUB_TOKEN` can do that with
`contents: write` — no extra setup.

But watch out if your **deploy runs in a separate workflow triggered by the `vX.Y.Z`
tag**. Pushes and tags made with the default `GITHUB_TOKEN` do **not** trigger other
workflows, so your tag would land and nothing would deploy. There you need a **GitHub App
token** (`actions/create-github-app-token`) on the release-please step, so the tag counts
as a real actor event.

If instead your deploy lives in the *same* workflow, gated on release-please's
`release_created` output — which fires on the human merge of the release PR — the default
token is fine. That's the setup in
[kobo2readwise](https://github.com/h11t-labs/kobo2readwise).

## Result

`--locked` everywhere again, `uv.lock` always in sync with the release, and dependency
drift can't sneak in through the back door. The release PR goes back to being boring —
which is exactly what a release PR should be.
