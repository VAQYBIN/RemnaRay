---
'@remnaray/api': patch
'@remnaray/worker': patch
'@remnaray/queues': patch
---

Perform `panel.reset-traffic` and `panel.delete-user`. The worker sent every panel job other than a sync to a full reconciliation, so the console's "reset traffic" never reached the panel and an anonymized user (section 19.5) kept their panel user. Both now call the panel, with the retries of a sync.
