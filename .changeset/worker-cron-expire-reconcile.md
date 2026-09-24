---
'@remnaray/worker': patch
---

Queue the section 7.3 crons that were missing: `maintenance.subscriptions-expire` every minute (FR-024), so subscriptions past `expires_at` move to `grace` or `expired`, and `panel.reconcile-all` every fifteen minutes (section 10.5) under `jobId=reconcile:<yyyymmddHHMM>`, run once per slot across restarts and replicas.
