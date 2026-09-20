#!/bin/sh
# Section 20.5 restore, run from the repository root on the server:
#
#   ./deploy/backup/restore.sh backups/remnaray-20260920-0300.dump
#
# It performs exactly the documented sequence, and refuses to guess: the dump
# has to exist and the operator has to confirm, because `--clean --if-exists`
# drops the current contents.
set -eu

dump=${1:-}
compose_file=${COMPOSE_FILE:-compose.yaml}
profile=${RR_PROXY_PROFILE:-nginx}

if [ -z "$dump" ] || [ ! -f "$dump" ]; then
  echo "Usage: $0 <backups/remnaray-<stamp>.dump>" >&2
  exit 1
fi

if [ "${RR_RESTORE_ASSUME_YES:-}" != 'true' ]; then
  printf 'This replaces the contents of the current database with %s. Continue? [y/N] ' "$dump"
  read -r answer
  case "$answer" in y | Y | yes | YES) ;; *) echo 'Aborted.' >&2; exit 1 ;; esac
fi

echo '1/4 stopping the stack'
docker compose -f "$compose_file" --profile "$profile" down

echo '2/4 starting PostgreSQL alone'
docker compose -f "$compose_file" up -d postgres
until docker compose -f "$compose_file" exec -T postgres \
  pg_isready -U "${POSTGRES_USER:-remnaray}" -d "${POSTGRES_DB:-remnaray}" >/dev/null 2>&1; do
  sleep 1
done

echo '3/4 restoring'
docker compose -f "$compose_file" exec -T postgres \
  pg_restore -U "${POSTGRES_USER:-remnaray}" -d "${POSTGRES_DB:-remnaray}" \
  --clean --if-exists < "$dump"

echo '4/4 starting the stack'
docker compose -f "$compose_file" --profile "$profile" up -d
echo 'Restored. Check /admin/system and the bot before announcing it.'
