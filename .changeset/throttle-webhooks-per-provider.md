---
'@remnaray/api': patch
---

Give webhooks their own rate limit (section 9.1): 600 a minute per provider, Telegram included, instead of the anonymous visitors' 60 a minute per IP, which refused bursts of provider notifications with 429.
