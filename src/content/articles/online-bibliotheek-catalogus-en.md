---
title: "Owning the catalog: a faster search for the Dutch online library"
description: "The official onlinebibliotheek.nl search is poor, so I scraped the whole catalog into SQLite + FTS5 and built my own fast, faceted search UI."
pubDate: 2026-06-24
key: online-bibliotheek-catalogus
lang: en
readMin: 7
project: online-bibliotheek-catalogus
repo: https://github.com/h11t-labs/online-bibliotheek-catalogus
tags: ["python", "sqlite", "fts5", "fastapi", "scraping"]
---

The Dutch online library ([onlinebibliotheek.nl](https://www.onlinebibliotheek.nl/))
has a great collection and a search that gets in the way of it. Slow, thin filters,
no good way to sort or browse. So I did the obvious thing: pull the entire catalog
into a database I control and put a decent search in front of it.

The pipeline is four stages:

**enumerate** every title → **fetch + parse** each detail page →
**normalize** into SQLite (+FTS5) → **search** in a minimal web UI.

## Why this is harder than "just scrape it"

The site caps its result pager at 50 pages (~1000 results), and deep page URLs
work only up to a hard **10,000-result cap per query**. A naive crawl sees a
fraction of the catalog and calls it done.

The fix is partitioning. `--full` enumerates per **`type × taal`** (format ×
language) — every title has both, so the partitions are exhaustive. Foreign
languages fit comfortably under the cap and paginate fully. Dutch is the only
language over 10k, so it gets split further by **original publication year**
(Dutch titles are ~98% year-filled), with a maker-sort window to mop up whatever
still overflows. When any partition is still capped, it recurses:
`type → jaar → taal → nbcHoofdCategorie → doelgroep → subject code` until every
piece fits under 10k. Records are de-duplicated by PPN, and the run is resumable
per `(format, year)` via a checkpoint file, so a crawl can stop and restart
without redoing work.

## Storage: rebuild, never patch

The database is written by **full rebuild**, never per-row. `normalize` streams
the raw records into a temporary SQLite file and then **atomically swaps** it over
the live database. Readers keep seeing the previous catalog right up until the
swap — no half-written state, no locking the UI during a load. The whole
normalize takes about five seconds.

Search is **SQLite FTS5** with an `unicode61 remove_diacritics 2` tokenizer over
title, author, subjects, and summary, ranked with `bm25` weighted toward title and
author. Facets (format, language, genre, year) and sorting sit on top. No search
server, no external index — one SQLite file.

## The details that make it usable

- **Publishers** are canonicalised at normalize time: variants differing only in
  case, brackets, or spacing collapse to the most common spelling, with a curated
  alias list for imprints that share no words (*Prometheus* / *Bert Bakker*).
- **Authors** are split on `|` / `;` into individual people, so a co-author is
  searchable on their own while the joined string still shows for display.
- **Curated lists** are pluggable providers: the weekly **Bestseller 60** and genre
  toplists from debestseller60.nl, plus the **New York Times** Best Sellers via the
  official Books API. `normalize` matches list items to catalog PPNs by ISBN, else
  by title + author surname. There is a `/lists` overview, per-list pages in rank
  order, a "Lijsten" filter, and cover ribbons.
- Cover images are hotlinked straight from the library's CDN; nothing is cached
  locally.

The UI is server-rendered **FastAPI + Jinja2** with pages for search, book, author,
series, lists, and stats, and a search bar that autocompletes titles, authors,
publishers, genres, languages, and lists.

## Keeping it fresh

The catalog sorts by license date, so new and relicensed titles appear first.
`--sync` pages newest-first and stops after a long run of already-known titles
(usually a few pages). It can't see removals, so `--reconcile` does a full scan and
stamps `removed_at` on titles that are gone; the UI hides them.

## Etiquette

This is personal-use harvesting of factual catalog metadata. `robots.txt` blocks
named bots and disallows `/*.do`; `/catalogus/` is allowed for normal browsers. The
crawler keeps a low request rate, uses its own session, caches responses, and does
no parallel hammering. No login or borrow actions are automated.

The stack, in one line: Python 3.11+, `httpx` + `beautifulsoup4`/`lxml` for
fetching and parsing, `tenacity` for retries, **SQLite + FTS5** for storage and
search, **FastAPI + Jinja2** for the UI, and **uv** for packaging.

Code: [github.com/h11t-labs/online-bibliotheek-catalogus](https://github.com/h11t-labs/online-bibliotheek-catalogus)
