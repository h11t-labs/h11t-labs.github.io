# h11t labs

The brand + writing site for **h11t labs**, built with [Astro](https://astro.build)
and ported from the Claude Design source (`h11t labs.dc.html`).

Dark, terminal-flavored, two-column: a fixed left sidebar (numbered nav) and a
main column. Space Grotesk for headings/UI, Source Serif 4 for long-form prose,
JetBrains Mono for labels, Poppins for the wordmark. Amber `#f4a838` accent on
ink `#0f1115`.

## Brand — assets, style guide & tone of voice

The logo, the visual style guide (colors, type, tokens), and the **tone of voice**
live in a separate repo, which is the source of truth. This site follows it — read
it before writing copy or touching the design:

**→ [github.com/h11t-labs/brand](https://github.com/h11t-labs/brand)**

- [tone-of-voice.md](https://github.com/h11t-labs/brand/blob/main/tone-of-voice.md) — how h11t labs writes
- [style-guide.md](https://github.com/h11t-labs/brand/blob/main/style-guide.md) — colors, type, spacing
- [logo.md](https://github.com/h11t-labs/brand/blob/main/logo.md) · [logo.html](https://github.com/h11t-labs/brand/blob/main/logo.html) — the wordmark
- [tokens.css](https://github.com/h11t-labs/brand/blob/main/tokens.css) — the design tokens (mirrored in `src/styles/global.css`)

## Develop

```bash
npm install        # once
npm run dev        # http://localhost:4321 with hot reload
npm run build      # render static site to ./dist
npm run preview    # serve ./dist locally
```

Requires Node 18.20.8+ / 20.3+ / 22+.

## Pages

`/` home (statement + work + writing indexes) · `/work` projects · `/writing`
posts · `/writing/<slug>` a post · `/system` the design-token styleguide ·
`/about` · `/rss.xml`.

## Structure

```
src/
  content/articles/*.md     the posts (schema in content.config.ts)
  content.config.ts         articles collection (title, category, readMin, repo, …)
  data/projects.ts          the work items (name, category, year, tags, repo, handle)
  layouts/
    Base.astro              two-column shell, <head>, Google Fonts
    Article.astro           post layout — serif prose, meta, github button
  components/
    Logo.astro              the h11t labs wordmark (Poppins recipe)
    Sidebar.astro           logo + numbered nav + EN/NL toggle + footer
    WorkItem.astro          one project row
    WritingItem.astro       one post row
  pages/                    index, work, writing, system, about, rss.xml.ts
  styles/global.css         design tokens + base styles
public/favicon.svg
```

## Add a project

Append to `src/data/projects.ts` — renders a work row on `/` and `/work` with a
GitHub handle link and, if `article` is set, a "read the write-up" link.

## Add an article

Each article has two files — English and Dutch — that share a `key` (the URL) and
differ by `lang`. Name them `<something>-en.md` and `<something>-nl.md` (the `-en`/
`-nl` suffix keeps their loader ids distinct). Frontmatter:

```yaml
---
title: "..."
description: "..."
pubDate: 2026-07-04
key: my-article          # shared by the en/nl files; becomes /writing/my-article
lang: en                 # or: nl
readMin: 6
project: firm            # optional — slug from data/projects.ts
repo: https://github.com/h11t-labs/firm   # optional — "view on github" button
tags: ["python", "sqlite"]
---
```

> Do **not** name the field `slug` — Astro's glob loader treats a `slug` field as
> the entry id and would collide the two language files into one.

## Languages

The site is bilingual (English default, Dutch). Both languages render into every
page and a client-side `EN / NL` toggle (in the sidebar) swaps them via
`<html lang>` + `localStorage` — **URLs never change**. UI strings use the
`<T en nl />` component ([src/components/T.astro](src/components/T.astro)); article
bodies are the paired `-en`/`-nl` files ([src/lib/articles.ts](src/lib/articles.ts)).

## Design tokens

All colors and fonts live as CSS custom properties at the top of
`src/styles/global.css`, mirrored on the `/system` page. The **source of truth** is
[tokens.css in the brand repo](https://github.com/h11t-labs/brand/blob/main/tokens.css);
keep the two in sync (ink, surface, border, amber, text, muted, link, index).

## Deploy

The site auto-deploys to **GitHub Pages** via GitHub Actions. Every push to `main`
runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): it builds with
Node 22 (`npm ci && npm run build`) and publishes `dist/` to Pages.

**One-time setup:**

1. Push the repo to GitHub (under the `h11t-labs` org).
2. Repo **Settings → Pages → Build and deployment → Source: _GitHub Actions_**.
3. Custom domain: [`public/CNAME`](public/CNAME) pins `h11t-labs.nl`. Point that
   domain at GitHub Pages — a DNS `CNAME` record to `<owner>.github.io` (or the four
   `A` records for apex). Not using a custom domain? Delete `public/CNAME`, and if
   it's a *project* repo (not `h11t-labs.github.io`) set `base: '/<repo>'` in
   `astro.config.mjs`.

`npm run build` alone still emits plain static files to `dist/` — host it anywhere
(Cloudflare Pages, Netlify, any static host). No server, no runtime.
