---
'@remnaray/api': patch
---

Never lose a payment event whose first apply fails. The `payments.apply-event` job is queued before the inline apply, a redelivered event that is still unprocessed is applied again, and a status poll re-applies an event an earlier poll stored.
