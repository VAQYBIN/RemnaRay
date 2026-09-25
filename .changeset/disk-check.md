---
'@remnaray/api': minor
'@remnaray/worker': minor
'@remnaray/web': minor
---

Check the free space on the database volume at worker start and hourly, raise `disk.low` below `admin.disk_alert_pct` (10 % by default), and show it on `/admin/system`. The worker mounts the `pgdata` volume read-only for it.
