---
title: "release-please bumpt je versie maar vergeet uv.lock"
description: "release-please werkt pyproject.toml bij maar niet de zelf-verwijzende version-pin in uv.lock, dus `uv sync --locked` faalt op de release-commit. Hier is een nette fix die de lock in sync houdt binnen de release-PR."
pubDate: 2026-07-22
key: release-please-uv-lock
lang: nl
readMin: 5
repo: https://github.com/h11t-labs/kobo2readwise
tags: ["release-please", "uv", "github-actions", "ci-cd", "python"]
---

Versioneer je een Python-project met [release-please](https://github.com/googleapis/release-please)
en lock je dependencies met [uv](https://docs.astral.sh/uv/), dan zit er een kleine valkuil
in die pas op het slechtst denkbare moment tevoorschijn komt — de release-commit zelf.

## Het probleem

Het `python`-release-type van release-please bumpt de versie in `pyproject.toml` (en
`CHANGELOG.md`, en het manifest). Het raakt `uv.lock` **niet** aan. Maar uv schrijft een
zelf-verwijzende entry voor je eigen project in de lockfile:

```toml
[[package]]
name = "my-project"
version = "0.1.0"
source = { virtual = "." }
```

Die `version`-pin klopt nu niet meer. Dus op het moment dat de release-PR merget en CI
`uv sync --locked` draait, faalt het:

```
error: The lockfile at `uv.lock` needs to be updated, but `--locked` was provided.
```

Het venijnige: op elke feature-PR is het groen — daar verandert de versie niet — en het
klapt pas op de **release**, precies als je wilt shippen. Zit je deploy achter die
CI-job, dan gaat er niets naar buiten.

## Twee uitwegen

De eerlijke, simpele optie is **`uv sync --frozen`** in plaats van `--locked`. Die gebruikt
de lockfile precies zoals-ie gecommit is, dus het maakt niet uit dat de version-pin
achterloopt — en het is al wat de meeste Dockerfiles doen. Je levert twee dingen in: de
`--locked`-check die "iemand wijzigde een dependency maar vergat te herlocken" vangt (al
houden `uv add`/`uv remove` de lock sowieso in sync, en een écht ontbrekende dependency
laat je tests alsnog falen), en de version-pin in de lock loopt nu één release achter
(cosmetisch, maar het leest als een bug). Voor veel projecten is dat een prima ruil — en
neem je die, dan kun je hier stoppen met lezen.

Het addertje: die drift raakt niet alleen de release-commit. Zodra een release merget,
staat op `main` de nieuwe `pyproject.toml`-versie naast de oude `uv.lock`-pin, dus de
**volgende feature-PR** faalt óók op `uv sync --locked`. Wil je `--locked` ergens laten
werken, dan móét *iets* `uv.lock` meebumpen bij de versie-bump. De nette plek daarvoor is
de release-PR zelf.

## De fix: sync uv.lock binnen de release-PR

release-please vertelt je wanneer het een release-PR opende (`prs_created`) en op welke
branch (`pr.headBranchName`). Dus meteen na de action: check die branch uit, regenereer de
lock, en commit **alleen** de version-pin-wijziging terug in de PR:

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

De job heeft `permissions: contents: write` nodig voor die push.

## De guard is het belangrijkste

De naïeve variant draait gewoon `uv lock && git commit -am … && git push`. Niet doen.
`uv lock` kan namelijk óók **nieuwere dependency-releases** binnentrekken zodra een
`>=`-range naar een verse publicatie resolvet. Gebeurt dat tijdens een release, dan
smokkel je stiekem een dependency-bump een release-PR in die niets meer dan een
versie-bump zou moeten zijn.

Daarom controleert het script dat de diff **exact één regel** wijzigt, dat de
toegevoegde regel een `version = "x.y.z"`-pin is, en dat die naast de `name` van je
project staat. Alles daarbuiten → **laat de job luid falen**. Een echte
dependency-wijziging krijgt dan z'n eigen `chore(deps)`-PR, waar-ie hoort, in plaats van
te verstoppen in een release.

De ruil: als de guard afgaat, **blokkeert-ie de release** tot je die `chore(deps)`-PR hebt
gemerged. In de praktijk gebeurt dat zelden — een kale `uv lock` upgrade't al gepinde
dependencies niet, dus bij een versie-only bump ís de diff echt die ene regel — maar het
is bewuste strengheid, geen gratis lunch. Wil je dependency-bumps liever laten meeliften,
laat de guard dan weg; weet alleen wat je inlevert.

## Eén valkuil met tokens

Die stap pusht naar de release-PR-branch. De standaard `GITHUB_TOKEN` kan dat met
`contents: write` — geen extra setup.

Maar let op als je **deploy in een aparte workflow draait die op de `vX.Y.Z`-tag
triggert**. Pushes en tags gemaakt met de standaard `GITHUB_TOKEN` triggeren **geen**
andere workflows, dus je tag landt en er deployt niets. Dan heb je een **GitHub
App-token** (`actions/create-github-app-token`) nodig op de release-please-stap, zodat de
tag als een echte actor-event telt.

Zit je deploy juist in *dezelfde* workflow, gated op de `release_created`-output van
release-please — die afgaat bij het menselijke mergen van de release-PR — dan volstaat de
standaard token. Dat is de opzet in
[kobo2readwise](https://github.com/h11t-labs/kobo2readwise).

## Resultaat

Overal weer `--locked`, `uv.lock` altijd in sync met de release, en dependency-drift kan
niet meer via de achterdeur naar binnen. De release-PR wordt weer saai — precies wat een
release-PR hoort te zijn.
