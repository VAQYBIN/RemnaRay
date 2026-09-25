---
'@remnaray/api': patch
---

A broadcast now answers Telegram's 429 by waiting `retry_after` and sending the same message again (section 16.x), at most five times per recipient, instead of marking the recipient failed after one second.
