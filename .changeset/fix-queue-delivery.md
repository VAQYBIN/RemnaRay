---
---

Deliver queued jobs. Every job identifier carried a colon, which BullMQ refuses,
and the outbox published under a different key prefix than the workers read, so
no panel sync, notification, broadcast or maintenance job ever ran.
