---
title: "De catalogus in eigen hand: sneller zoeken in de Nederlandse online bibliotheek"
description: "De officiële zoekfunctie van onlinebibliotheek.nl is slecht, dus schraapte ik de hele catalogus naar SQLite + FTS5 en bouwde er mijn eigen snelle, gefacetteerde zoek-UI op."
pubDate: 2026-06-24
key: online-bibliotheek-catalogus
lang: nl
readMin: 7
project: online-bibliotheek-catalogus
repo: https://github.com/h11t-labs/online-bibliotheek-catalogus
tags: ["python", "sqlite", "fts5", "fastapi", "scraping"]
---

De Nederlandse online bibliotheek
([onlinebibliotheek.nl](https://www.onlinebibliotheek.nl/)) heeft een mooie collectie
en een zoekfunctie die je ervan weghoudt. Traag, magere filters, geen goede manier om
te sorteren of te bladeren. Dus deed ik het voor de hand liggende: de hele catalogus
in een database trekken die ik zelf beheer, en er een fatsoenlijke zoekfunctie voor
zetten.

De pijplijn bestaat uit vier fasen:

**enumereren** van elke titel → **ophalen + parsen** van elke detailpagina →
**normaliseren** naar SQLite (+FTS5) → **zoeken** in een minimale web-UI.

## Waarom dit lastiger is dan 'gewoon scrapen'

De site kapt zijn resultatenpager af op 50 pagina's (~1000 resultaten), en diepe
pagina-URL's werken maar tot een harde **limiet van 10.000 resultaten per query**. Een
naïeve crawl ziet een fractie van de catalogus en denkt dat-ie klaar is.

De oplossing is partitioneren. `--full` enumereert per **`type × taal`** (formaat ×
taal) — elke titel heeft beide, dus de partities zijn uitputtend. Vreemde talen passen
ruim onder de limiet en pagineren volledig. Nederlands is de enige taal boven de 10k,
dus die wordt verder opgesplitst op **oorspronkelijk publicatiejaar** (Nederlandse
titels zijn ~98% van een jaar voorzien), met een maker-sorteervenster om op te ruimen
wat alsnog overloopt. Loopt een partitie nog steeds tegen de limiet, dan gaat het
recursief verder: `type → jaar → taal → nbcHoofdCategorie → doelgroep → subjectcode`
tot elk stuk onder de 10k past. Records worden ontdubbeld op PPN, en de run is
hervatbaar per `(formaat, jaar)` via een checkpoint-bestand, zodat een crawl kan
stoppen en herstarten zonder werk over te doen.

## Opslag: herbouwen, nooit patchen

De database wordt geschreven via een **volledige herbouw**, nooit per rij. `normalize`
streamt de ruwe records naar een tijdelijk SQLite-bestand en **wisselt dat atomair om**
naar de live database. Lezers blijven de vorige catalogus zien tot precies het moment
van omwisselen — geen half-geschreven toestand, geen UI die vastloopt tijdens het
laden. De hele normalize duurt ongeveer vijf seconden.

Zoeken gebeurt met **SQLite FTS5** en een `unicode61 remove_diacritics 2`-tokenizer
over titel, auteur, onderwerpen en samenvatting, gerankt met `bm25` en gewogen richting
titel en auteur. Facetten (formaat, taal, genre, jaar) en sortering liggen daarbovenop.
Geen zoekserver, geen externe index — één SQLite-bestand.

## De details die het bruikbaar maken

- **Uitgevers** worden bij het normaliseren gecanoniseerd: varianten die alleen
  verschillen in hoofdletters, haakjes of spaties vallen samen tot de meest voorkomende
  spelling, met een handmatige alias-lijst voor imprints die geen woorden delen
  (*Prometheus* / *Bert Bakker*).
- **Auteurs** worden gesplitst op `|` / `;` in losse personen, zodat een co-auteur op
  zichzelf vindbaar is terwijl de samengevoegde string nog steeds getoond wordt.
- **Samengestelde lijsten** zijn plugbare providers: de wekelijkse **Bestseller 60** en
  genre-toplijsten van debestseller60.nl, plus de **New York Times** Best Sellers via de
  officiële Books API. `normalize` matcht lijstitems aan catalogus-PPN's op ISBN, anders
  op titel + achternaam van de auteur. Er is een `/lists`-overzicht, pagina's per lijst
  in rangorde, een "Lijsten"-filter en cover-ribbons.
- Cover-afbeeldingen worden rechtstreeks van de CDN van de bibliotheek gehotlinkt; er
  wordt lokaal niets gecachet.

De UI is server-rendered **FastAPI + Jinja2** met pagina's voor zoeken, boek, auteur,
serie, lijsten en statistieken, en een zoekbalk die titels, auteurs, uitgevers, genres,
talen en lijsten autocomplete.

## Vers houden

De catalogus sorteert op licentiedatum, dus nieuwe en opnieuw gelicentieerde titels
komen eerst. `--sync` pagineert nieuwste-eerst en stopt na een lange reeks al bekende
titels (meestal een paar pagina's). Verwijderingen ziet het niet, dus `--reconcile`
doet een volledige scan en stempelt `removed_at` op titels die weg zijn; de UI verbergt
ze.

## Etiquette

Dit is harvesting voor persoonlijk gebruik van feitelijke catalogus-metadata.
`robots.txt` blokkeert benoemde bots en verbiedt `/*.do`; `/catalogus/` is toegestaan
voor normale browsers. De crawler houdt een lage request-rate aan, gebruikt z'n eigen
sessie, cachet responses en hamert niet parallel. Er worden geen inlog- of leen-acties
geautomatiseerd.

De stack, in één regel: Python 3.11+, `httpx` + `beautifulsoup4`/`lxml` voor ophalen en
parsen, `tenacity` voor retries, **SQLite + FTS5** voor opslag en zoeken, **FastAPI +
Jinja2** voor de UI, en **uv** voor packaging.

Code: [github.com/h11t-labs/online-bibliotheek-catalogus](https://github.com/h11t-labs/online-bibliotheek-catalogus)
