---
'@remnaray/api': patch
---

Refuse HTTP webhooks for providers without one before the body is read or stored. Telegram Stars accepted any unsigned `successful_payment` posted at `/webhooks/stars`, which let anyone mark a Stars invoice paid; section 11.3.6 gives Stars no HTTP webhook, so the path now answers `WEBHOOK_NOT_SUPPORTED`.
