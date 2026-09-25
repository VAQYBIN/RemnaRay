---
'@remnaray/api': patch
'@remnaray/web': patch
---

Resume a paused broadcast for real. The resumed chunks reused the first run's job ids, which BullMQ still kept, so nothing was sent. Each run now names its chunks afresh. A chunk stopped by a pause counts what it sent. Start, resume, pause and cancel apply only to the statuses they fit: a canceled broadcast can no longer be restarted, and anything else is answered 409.
