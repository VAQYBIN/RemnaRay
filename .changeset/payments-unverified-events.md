---
'@remnaray/api': patch
---

Keep webhooks that fail verification away from the event's deduplication key. They are still stored for audit (AC-063c) but under their own body hash, so a forged body naming the id of a genuine payment notification can no longer make that notification a duplicate that is never applied.
