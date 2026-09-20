#!/usr/bin/env sh
# Runs what the `quality` job of `ci.yml` runs, from the state CI starts in.
#
# Both times this repository went red on a green working tree, the cause was
# the same: `pnpm lint` and `pnpm typecheck` read generated types — the Prisma
# client, the Next.js route types — that a developer's checkout already has and
# a runner's does not. Nothing local reproduced that, so this removes every
# generated and built artefact first and runs the gate from there.
#
# It deletes `node_modules`, `dist`, `.turbo`, `apps/web/.next` and the
# generated Prisma client, then reinstalls: it costs a few minutes and is not
# meant for a quick check. `pnpm lint` on its own is that.
set -eu

cd "$(dirname "$0")/.."

echo '==> removing every generated and built artefact'
find . -name node_modules -maxdepth 4 -type d -not -path '*/node_modules/*' -exec rm -rf {} + 2>/dev/null || true
find . -name dist -maxdepth 3 -type d -not -path '*/node_modules/*' -exec rm -rf {} + 2>/dev/null || true
find . -name .turbo -maxdepth 3 -type d -not -path '*/node_modules/*' -exec rm -rf {} + 2>/dev/null || true
rm -rf apps/web/.next packages/db/src/generated

echo '==> install'
pnpm install --frozen-lockfile
echo '==> lint'
pnpm lint
echo '==> format'
pnpm format
echo '==> typecheck'
pnpm typecheck
pnpm -r typecheck
echo '==> repository tests'
pnpm test
echo '==> workspace tests'
pnpm turbo run test
echo '==> locale and theme checks'
pnpm i18n-check
pnpm theme-validate themes/manta
pnpm theme-validate themes/_admin
echo '==> build'
pnpm build

echo
echo 'The quality gate passes from a clean checkout.'
