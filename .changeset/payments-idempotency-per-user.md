---
'@remnaray/api': patch
---

Scope invoice `Idempotency-Key` replays to the user and the request (sections 9.2, 9.3). A key used to return whatever invoice carried it, including another user's with its payment link; a different user or a different plan, provider or top-up amount under a used key now gets 422 `IDEMPOTENCY_KEY_REUSED`, and a replayed promocode purchase no longer reserves a second slot.
