---
title: "firm: de Rails Solid-stack, in pure Python"
description: "Achtergrondtaken, caching, pub/sub en een auditlog die allemaal in je bestaande SQL-database draaien. Ports van de Solid-stack uit Rails 8 — geen Redis nodig."
pubDate: 2026-07-02
key: firm
lang: nl
readMin: 6
project: firm
repo: https://github.com/h11t-labs/firm
tags: ["python", "background-jobs", "caching", "postgresql", "sqlite"]
---

Rails 8 leverde de **Solid**-stack — `solid_queue`, `solid_cache`, `solid_cable` —
op basis van een simpele weddenschap: de meeste apps hebben geen Redis nodig. Je
SQL-database kan de taakwachtrij, de cache en het pub/sub-kanaal prima aan, en één
stuk infrastructuur minder draaien is veel waard.

**firm** is die weddenschap in Python. Het is een pure-Python port van de
Solid-stack, plus één eigen module.

## Eén package, vier onafhankelijke modules

Installeer alleen wat je nodig hebt:

| Module | Installatie | Port van | Kenmerken |
|---|---|---|---|
| **queue** | `pip install "firm[queue]"` | `solid_queue` | concurrency-controls, terugkerende taken, retries, forked/threaded supervisor, crash-recovery |
| **cache** | `pip install "firm[cache]"` | `solid_cache` | FIFO-eviction op leeftijd/grootte/aantal, plugbare coders, encryptie at-rest |
| **channel** | `pip install "firm[channel]"` | `solid_cable` | broadcast/subscribe over je database, polling-listener, automatisch opschonen van berichten |
| **audit** | `pip install "firm[audit]"` | *(origineel in firm)* | append-only auditlog, opt-in retentie, `history()`-queries |

Alle vier draaien op **SQLite**, **PostgreSQL** en **MySQL/MariaDB** — live getest
tegen alle drie. Het top-level package importeert niks zwaars, dus een queue-only
workerproces laadt nooit de cache-, pub/sub- of auditcode.

## Hoe het gebruik eruitziet

Achtergrondtaken:

```python
import firm.queue as bq
bq.configure(database_url="postgresql://localhost/myapp")

@bq.job()
def greet(name): print(f"hi {name}")

greet.enqueue("Ada")        # then: firm-queue start --import myapp.jobs
```

Caching:

```python
from firm.cache import Cache
cache = Cache(database_url="postgresql://localhost/myapp")
cache.fetch("k", lambda: expensive())
```

Pub/sub:

```python
from firm.channel import Channel
ps = Channel(database_url="postgresql://localhost/myapp")
ps.subscribe("room:42", lambda payload: print(payload))
ps.broadcast("room:42", b'{"msg": "hi"}')
```

Auditlog:

```python
from firm.audit import AuditLog
audit = AuditLog(database_url="postgresql://localhost/myapp")
audit.record("invoice.paid", subject=invoice, actor=user, data={"amount": 4200})
```

## Waarom "geen Redis" het punt is

Als je al PostgreSQL draait, betekent Redis erbij nog een proces om te deployen, te
monitoren, te back-uppen en waarvan je de faalscenario's moet doorgronden. Voor veel
apps levert die kost weinig op. firm houdt taken, cache, channels en het auditspoor
in dezelfde transactionele database als de rest van je data — wat ook betekent dat
een taak en de rij die hij wegschrijft **samen** kunnen committen of terugrollen.

## Hoe het gebouwd is

firm is een uv-workspace van onafhankelijke packages — `firm-core`, `firm-queue`,
`firm-cache`, `firm-channel`, `firm-audit`, `firm-ui` — met een dun top-level
`firm`-package dat ze via extras aan elkaar knoopt. Databasedrivers en features voeg
je ook als extras toe: `firm[queue,postgres]`, `firm[cache,encryption]`, enzovoort.

De docs zijn gebouwd met [Zensical](https://zensical.org) (de opvolger van MkDocs
van het Material for MkDocs-team), en er is een `llms.txt` / `llms-full.txt`-paar om
het geheel aan een agent te voeren. Tests draaien standaard op SQLite en tegen live
Postgres/MySQL als je ze op echte databases richt.

Geïnspireerd door de Rails Solid-stack van 37signals
([solid_queue](https://github.com/rails/solid_queue),
[solid_cache](https://github.com/rails/solid_cache),
[solid_cable](https://github.com/rails/solid_cable)).

Code: [github.com/h11t-labs/firm](https://github.com/h11t-labs/firm)
