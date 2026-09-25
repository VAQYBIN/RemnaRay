---
'@remnaray/api': patch
'@remnaray/web': patch
---

Never apply a console credit, refund or extension twice. The console's POSTs that create money or subscriptions now take `Idempotency-Key` like the account's (section 9.1): the same request again is answered from the kept response with `Idempotent-Replay: true` and no second audit entry. The console sends one key per opened dialog, so confirming again after an answer that never arrived is a replay.
