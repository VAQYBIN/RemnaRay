---
---

Make the shipped scripts runnable, and the backup wrappers do their job.

`core.fileMode=false` — which a checkout on a Windows filesystem sets — kept
the executable bit out of the index, so a clone answered `./scripts/rr up`
with `Permission denied`, the CI proxy smoke could not launch its own script
and the `backup` image's crontab could not run the entrypoint it schedules.

`./scripts/rr backup` named the entrypoint script as its argument, which the
entrypoint then read as a subcommand and refused; `./scripts/rr restore` ran
inside the backup container a script that drives `docker compose` and belongs
on the host. Neither ever ran. Both are repaired, and `docs/backup.md`'s
direct `./deploy/backup/restore.sh` works now that the bit is recorded.
