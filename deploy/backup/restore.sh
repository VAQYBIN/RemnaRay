#!/bin/sh
# Section 20.5 restore, run from the repository root on the server:
#
#   ./deploy/backup/restore.sh backups/remnaray-20260920-0300.dump
#
# It performs exactly the documented sequence, and refuses to guess: the dump
# has to exist and the operator has to confirm, because `--clean --if-exists`
# drops the current contents. The themes and uploads archive the backup took
# with the dump (`files-<stamp>.tar.gz`, section 20.5) is restored with it.
set -eu

dump=${1:-}
compose_file=${COMPOSE_FILE:-compose.yaml}
profile=${RR_PROXY_PROFILE:-nginx}
project_dir=$(cd "$(dirname "$compose_file")" && pwd)

if [ -z "$dump" ] || [ ! -f "$dump" ]; then
  echo "Usage: $0 <backups/remnaray-<stamp>.dump>" >&2
  exit 1
fi

# `remnaray-<stamp>.dump` and `remnaray-weekly-<stamp>.dump` share the archive
# `files-<stamp>.tar.gz`; a pre-migrate dump has none.
stamp=$(basename "$dump" .dump | sed -e 's/^remnaray-weekly-//' -e 's/^remnaray-//')
files="$(cd "$(dirname "$dump")" && pwd)/files-$stamp.tar.gz"

if [ "${RR_RESTORE_ASSUME_YES:-}" != 'true' ]; then
  printf 'This replaces the contents of the current database with %s. Continue? [y/N] ' "$dump"
  read -r answer
  case "$answer" in y | Y | yes | YES) ;; *) echo 'Aborted.' >&2; exit 1 ;; esac
fi

echo '1/5 stopping the stack'
docker compose -f "$compose_file" --profile "$profile" down

echo '2/5 starting PostgreSQL alone'
docker compose -f "$compose_file" up -d postgres
# The user and database are the container's own, which compose takes from
# `.env`: this shell never reads `.env`, so a changed POSTGRES_USER or
# POSTGRES_DB expanded here would be the defaults. Readiness is asked over TCP:
# on an empty volume (26.4 R3 removes it) the image first initialises with a
# server on the socket only, which answers ready and then restarts.
until docker compose -f "$compose_file" exec -T postgres \
  sh -c 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
  sleep 1
done

echo '3/5 restoring the database'
docker compose -f "$compose_file" exec -T postgres \
  sh -c 'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < "$dump"

echo '4/5 restoring themes and uploads'
if [ -f "$files" ]; then
  # A one-off `backup` container writes into ./themes and the `uploads`
  # volume, which the running service only reads. Existing files the archive
  # does not name are left in place.
  docker compose -f "$compose_file" --profile "$profile" run --rm -T --no-deps \
    --entrypoint sh \
    -v "$files:/restore/files.tar.gz:ro" \
    -v "$project_dir/themes:/restore/themes" \
    -v uploads:/restore/uploads \
    backup -c 'tar -xzf /restore/files.tar.gz -C /restore'
else
  echo "  no $(basename "$files") next to the dump; themes and uploads are left as they are"
fi

echo '5/5 starting the stack'
docker compose -f "$compose_file" --profile "$profile" up -d
echo 'Restored. Check /admin/system and the bot before announcing it.'
