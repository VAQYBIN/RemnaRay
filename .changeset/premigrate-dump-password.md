---
'@remnaray/api': patch
---

`migrate` gives `pg_dump` the database password, so the dump it takes before a migration that cannot be undone no longer fails authentication and stops the upgrade.
