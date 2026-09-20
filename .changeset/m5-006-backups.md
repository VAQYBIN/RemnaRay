---
'@remnaray/api': minor
---

Add the backup service, the restore script and the pre-migrate dump (TASK-M5-006)

`backup` takes a `pg_dump -Fc -Z 6` at 03:00 UTC, archives `themes/` and
`uploads/`, keeps fourteen daily and eight weekly copies — the weekly one is a
hard link, so a Sunday costs no extra space — copies the dump to S3 when the
`RR_BACKUP_S3_*` variables are set, and writes the `.last-status` line
`maintenance.backup-check` reads. `.env` is never copied.

`deploy/backup/restore.sh` performs the section 20.5 sequence, and the new
`migrate` one-shot service applies migrations before the applications start,
dumping first when a pending migration is marked `reversible: no`.
