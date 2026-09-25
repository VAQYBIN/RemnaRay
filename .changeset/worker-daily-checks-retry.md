---
'@remnaray/worker': patch
---

Take the TLS and backup readings again five minutes after the API refused them, as it refuses every internal call until the setup wizard finishes, instead of a day later; the day now counts from the last reading the API recorded.
