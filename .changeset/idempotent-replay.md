---
'@remnaray/api': minor
---

Keep the response of `POST /me/invoices`, `/me/trial` and `/me/promocodes/redeem` for 24 hours per user and `Idempotency-Key` (section 9.2), and answer a repeat with it and `Idempotent-Replay: true`. The key must be a UUID and is required for invoices. The same key with another request is `422 IDEMPOTENCY_KEY_REUSED`, and a repeat while the first request runs is `409 CONFLICT`.
