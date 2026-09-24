---
'@remnaray/api': minor
'@remnaray/worker': minor
'@remnaray/queues': minor
'@remnaray/metrics': minor
'@remnaray/web': patch
---

Send the outgoing webhooks of section 9.8: `user.created`, `subscription.activated`, `subscription.expired`, `payment.succeeded`, `payment.refunded` and `referral.rewarded`, to up to five recipients in `webhooks.outgoing`, signed `X-RemnaRay-Signature: sha256=<hmac>`, with 10 s per attempt and retries after 1 min, 5 min, 30 min, 2 h and 12 h, counted in `rr_outgoing_webhook_failures_total`. The recipients are editable in the console's settings.
