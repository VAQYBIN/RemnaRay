---
---

Generate the Next.js route types when the workspace is installed.

`apps/web/i18n/request.ts` calls `rootLocale()` from `next/root-params`, whose
types Next writes into `.next/types` — gitignored, and produced by a build.
CI lints before it builds, so the call resolved to `any` and the quality gate
failed on two `no-unsafe-*` errors that no local run could reproduce. The root
`postinstall` now runs `next typegen` beside `prisma generate`; it takes two
seconds and needs no build.

`scripts/ci-local.sh` runs the whole quality gate from the state a runner
starts in — no `node_modules`, no `dist`, no `.next` — because that gap is
what made a green working tree disagree with CI twice.
