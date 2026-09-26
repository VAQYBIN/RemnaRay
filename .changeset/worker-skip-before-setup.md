---
'@remnaray/worker': patch
---

Stop failing scheduled jobs while the setup wizard runs. The API refuses every internal call until setup finishes, and each of those jobs was recorded as failed; they now complete as skipped.
