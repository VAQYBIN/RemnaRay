# Upgrading

`compose.yaml` follows the major line: the images resolve to
`ghcr.io/remnaray/<image>:${RR_VERSION:-1}`, so a pull brings the current minor
and patch of major 1. Pin `RR_VERSION=1.2.3` in `.env` if you would rather
decide each time.

## The procedure

```sh
git pull                      # the compose files and the proxy templates
# read the CHANGELOG section for the version you are moving to
docker compose pull
./scripts/rr up
docker compose ps
```

`migrate` runs first and `api`, `bot` and `worker` wait for it. Downtime is the
length of the migrations, usually seconds. `web` and the proxy are not
restarted unless their image changed, so the site stays up while the API
restarts.

Afterwards, open **Settings → System** in the console: it shows the panel, the
queues, the certificate and the last backup.

## Read the changelog first

Every release says what an owner has to know under three headings:

- **⚠ Breaking** — behaviour that changes.
- **Migration notes (reversible: yes/no)** — whether the database change can be
  undone. A migration marked `reversible: no` means the only way back is a
  restore.
- **Downgrade path** — what to do if you want to go back.

Before an irreversible migration, `migrate` takes a dump of its own into
`backups/pre-migrate-<version>.dump` (`RR_AUTO_PREMIGRATE_BACKUP`, on by
default). It is a safety net, not a backup policy: see
[`backup.md`](backup.md).

## Going back

```sh
RR_VERSION=1.2.2 docker compose pull
RR_VERSION=1.2.2 ./scripts/rr up
```

That works while no irreversible migration has run in between. When one has,
restore the pre-migrate dump first:

```sh
./scripts/rr restore backups/pre-migrate-1.2.3.dump
```

## Security rebuilds

The base images move faster than the application. Every Monday the four images
are rebuilt on the current `node`, `nginx` and `caddy` bases, scanned, and
published as `X.Y.Z-<yyyymmdd>` with the floating `X.Y` and `X` tags moved onto
them. The application version does not change and neither does the changelog,
so `docker compose pull` on a quiet week still picks up the patched base.

`postgres` and `valkey` are pinned by tag and updated through a pull request on
this repository. A PostgreSQL minor inside 18.x is safe to take; a major change
only ever arrives in a major release of RemnaRay, with instructions.

## Which versions are supported

The latest minor of the current major, plus security fixes for the previous
minor for thirty days and for the previous major for ninety. See
[`SECURITY.md`](../SECURITY.md).
