---
title: "firm: the Rails Solid stack, in pure Python"
description: "Background jobs, caching, pub/sub, and an audit log that all live in your existing SQL database. Ports of Rails 8's Solid stack — no Redis required."
pubDate: 2026-07-02
key: firm
lang: en
readMin: 6
project: firm
repo: https://github.com/h11t-labs/firm
tags: ["python", "background-jobs", "caching", "postgresql", "sqlite"]
---

Rails 8 shipped the **Solid** stack — `solid_queue`, `solid_cache`, `solid_cable` —
on a simple bet: most apps don't need Redis. Your SQL database can hold the job
queue, the cache, and the pub/sub channel just fine, and running one fewer piece of
infrastructure is worth a lot.

**firm** is that bet in Python. It's a pure-Python port of the Solid stack, plus one
module of its own.

## One package, four independent modules

Install only the part you need:

| Module | Install | Ports | Highlights |
|---|---|---|---|
| **queue** | `pip install "firm[queue]"` | `solid_queue` | concurrency controls, recurring tasks, retries, forked/threaded supervisor, crash recovery |
| **cache** | `pip install "firm[cache]"` | `solid_cache` | FIFO age/size/count eviction, pluggable coders, at-rest encryption |
| **channel** | `pip install "firm[channel]"` | `solid_cable` | broadcast/subscribe over your database, polling listener, automatic message trimming |
| **audit** | `pip install "firm[audit]"` | *(original to firm)* | append-only audit log, opt-in retention, `history()` querying |

All four run on **SQLite**, **PostgreSQL**, and **MySQL/MariaDB** — verified live
against all three. The top-level package imports nothing heavy, so a queue-only
worker process never loads the cache, pub/sub, or audit code.

## What using it looks like

Background jobs:

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

Audit log:

```python
from firm.audit import AuditLog
audit = AuditLog(database_url="postgresql://localhost/myapp")
audit.record("invoice.paid", subject=invoice, actor=user, data={"amount": 4200})
```

## Why "no Redis" is the point

If you already run PostgreSQL, adding Redis means another process to deploy,
monitor, back up, and reason about failure modes for. For a lot of apps that cost
buys very little. firm keeps jobs, cache, channels, and the audit trail in the same
transactional database as the rest of your data — which also means a job and the row
it writes can commit or roll back **together**.

## How it's built

firm is a uv workspace of independent packages — `firm-core`, `firm-queue`,
`firm-cache`, `firm-channel`, `firm-audit`, `firm-ui` — with a thin top-level `firm`
package that wires them together via extras. You add database drivers and features
as extras too: `firm[queue,postgres]`, `firm[cache,encryption]`, and so on.

The docs are built with [Zensical](https://zensical.org) (the Material for MkDocs
team's successor to MkDocs), and there's an `llms.txt` / `llms-full.txt` pair for
feeding the whole thing to an agent. Tests run on SQLite by default and against live
Postgres/MySQL when you point them at real databases.

Inspired by the Rails Solid stack from 37signals
([solid_queue](https://github.com/rails/solid_queue),
[solid_cache](https://github.com/rails/solid_cache),
[solid_cable](https://github.com/rails/solid_cable)).

Code: [github.com/h11t-labs/firm](https://github.com/h11t-labs/firm)
