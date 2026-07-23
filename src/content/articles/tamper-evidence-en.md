---
title: "How firm's audit log knows if someone tampered with it"
description: "An audit log is only useful if you can trust it wasn't edited. Here's how firm proves nobody quietly changed, deleted, or faked a log entry — explained as simply as I can."
pubDate: 2026-07-23
key: tamper-evidence
lang: en
readMin: 8
project: firm
repo: https://github.com/h11t-labs/firm
url: https://h11t-labs.github.io/firm/audit/tamper-evidence/
tags: ["python", "audit-log", "security", "cryptography", "postgresql"]
---

Imagine you keep a diary, and the rule is: you only ever *add* new lines. You never
erase anything. That's an **audit log** — a list of things that happened, in order,
that you're supposed to be able to trust forever. "User 12 changed the price."
"Invoice 4200 was paid." "Admin deleted an account."

Now here's the uncomfortable question. The diary lives in your database. Lots of
people — and programs — can reach that database. What stops someone from quietly
opening the diary, changing one line, and closing it again as if nothing happened?

With a normal audit log: nothing. And that's the whole problem. A log you can't
trust is just a story.

firm's audit module has an opt-in feature called **tamper evidence** that fixes
this. The name is the important part: it doesn't stop a determined person from
messing with your data — nobody can promise that. What it guarantees is that if they
do, **you will find out**. No silent edits. Ever.

Here's how it works, in three layers, each one closing a hole the previous one left
open.

## Layer 1: a secret fingerprint on every line

When you turn tamper evidence on, you give firm a **secret key** — think of it as a
password only your app knows.

Every time a new line goes into the diary, firm uses that secret to stamp a tiny
**fingerprint** next to it. The fingerprint is calculated from the exact words of
the line *plus* the secret. (The technical name is an HMAC, but "fingerprint made
with a secret" is all you need.)

The magic: change a single letter in the line, and the fingerprint no longer
matches. And because you need the secret to make a correct fingerprint, an attacker
who edits a line **can't fake a new one**. They don't have the password.

So Layer 1 catches: *someone edited an existing entry.*

But it leaves a hole. What if they don't edit a line — what if they tear a whole
**page** out? Delete entry #50 entirely. Every remaining line still has a perfect
fingerprint. Nothing looks wrong… because the evidence is the thing that's gone.

## Layer 2: sealing whole pages shut

To catch missing pages, firm doesn't just fingerprint each line. Every so often it
takes a batch of lines — say entries 1 through 100 — and writes one **signed seal**
that says: *"Entries 1 to 100. This exact set. Sealed."*

Now try to tear out entry #50. The individual fingerprints are fine, but the seal
over the whole range breaks, because the range isn't what it was sealed as. Removing
a page, sneaking in a fake page, shuffling the order — all of it breaks the seal.

There's one honest exception you *do* want: sometimes you're **allowed** to throw
old entries away. Audit logs get big, and deleting last year's records on purpose is
normal (it's called retention). So how does firm tell "legitimately cleaned up" apart
from "an attacker deleted the evidence"?

It signs that too. When old entries are retired, firm records a signed
**floor**: *"Everything below entry #500 was removed on purpose, and here's my
signature to prove it was me."* An attacker can't forge that line — no secret — so
they can't hide a deletion behind a fake "oh, that was just cleanup."

So Layer 2 catches: *someone removed, inserted, or reordered entries.*

But there's still a bigger hole. What if the attacker doesn't tear out a page — what
if they **burn the whole diary**? Delete the log *and* the seals, all of it, and
start a fresh empty book. Now there's nothing left to compare against.

## Layer 3: a note kept outside the building

The fix for "burn everything" is to keep a little proof **somewhere else** — outside
the database entirely.

firm can append a one-line note to an external file (an **anchor**): *"As of today,
I had at least 100 sealed entries, and the floor was at 500."* The file only ever
grows, and it lives apart from the database.

Now if the diary comes back looking suspiciously empty — 40 entries where there
should be 100 — the note outside says otherwise, and the mismatch screams tampering.
You can't erase what you can't reach. Burning the diary no longer covers your tracks;
it just moves the alarm outside.

So Layer 3 catches: *someone wiped the whole log to cover it up.*

## Two keys, so one break isn't game over

One more clever bit. The everyday part of your app — the code writing new lines all
day — needs the secret to stamp fingerprints. But that's exactly the code most likely
to get compromised.

So firm lets you use **two keys**: a *writing* key for the busy everyday code, and a
separate *sealing* key kept somewhere safer, used only to sign the range seals. If an
attacker steals the writing key, they still can't forge the seals that catch missing
pages. One break doesn't hand them everything.

## What it actually looks like

You turn it on with a key, and firm does the stamping for you:

```python
from firm.audit import AuditLog

# The key lives in an env var, not your code.
audit = AuditLog(database_url="postgresql://localhost/myapp")
audit.record("invoice.paid", subject=invoice, actor=user, data={"amount": 4200})
```

Then, whenever you want the truth, you ask firm to check the whole diary:

```bash
firm-audit verify
```

It reads every fingerprint, every seal, the floor, and the outside note, and tells
you one of two things: **everything checks out**, or **entry #73 was tampered with**
— pointing right at the problem. There's also a dashboard with a shield that turns
green when all is well and red the moment something doesn't add up, plus an option to
run that check quietly in the background on a timer.

## The one thing to remember

Tamper evidence is *evidence*, not a force field. A person with enough access can
still destroy your data — that's true of any system. What firm takes away is their
ability to do it **quietly**. Every edit, every missing page, every attempt to wipe
the slate breaks a signature the attacker can't fix without a secret they don't have.

An audit log's whole job is to be trustworthy. This is how firm earns it.

---

The full details — key rotation, how retention and verification agree on what's
prunable, the exact guarantees with and without the external anchor — are in the
[tamper-evidence docs](https://h11t-labs.github.io/firm/audit/tamper-evidence/).
firm's audit module is part of [firm](https://github.com/h11t-labs/firm), the
pure-Python port of the Rails Solid stack.
