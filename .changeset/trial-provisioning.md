---
'@remnaray/api': patch
'@remnaray/bot': patch
---

Provision the trial in the panel. A trial was created `active` with no `panel.sync-user` queued, so its user never reached the panel and got no link. It now starts `provisioning` with a sync queued (FR-010, EX-01). The sync activates it and sends `subscription.activated` and the customer's `sub.activated` message. Reconciliation retries it, and after 24 h it becomes `provisioning_failed` with an alert. Meanwhile the bot says the subscription is being activated.
