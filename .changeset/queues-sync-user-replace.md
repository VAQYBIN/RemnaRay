---
'@remnaray/queues': patch
'@remnaray/api': patch
---

Stop dropping panel syncs and retry queued jobs as section 7.3 requires. `panel.sync-user` is queued as `sync:<userId>` and replaces rather than collides: a finished sync no longer swallows the user's later renewals, bans and unbans. `panel.sync-user` (10 attempts from 5 s), `payments.apply-event` (5 from 2 s), `notify.send` (3, 10 s apart) and `broadcast.chunk` (3) are now retried.
