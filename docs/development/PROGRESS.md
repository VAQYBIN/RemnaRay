# RemnaRay Development Progress

## Current milestone

M0

## Current task

TASK-M0-008 — application/web Dockerfiles and development compose stack.

## Completed tasks

- TASK-M0-001 — initialized the pnpm/Turborepo monorepo, TypeScript 7.0.2
  compiler setup, ESLint 10 flat config, Prettier, Husky, lint-staged,
  commitlint, Changesets, and empty application/package shells.

- TASK-M0-002 — pinned the section 6.1 JavaScript dependency matrix across
  the root, applications, and workspace packages; fixed `@types/node` at
  `~24.13.6`; added Renovate 24.6 policy groups, release-age windows,
  security bypasses, and major-version exceptions.
- TASK-M0-003 — verified the official `caddy:2-alpine` image at Caddy
  `v2.11.4` and added a two-stage custom image with `caddy-ratelimit`.
- TASK-M0-004 — verified Remnawave panel `v3.4.4` and its official OpenAPI
  document; recorded the section 10.1 compatibility matrix and required
  v3 identifier mapping in `docs/adr/ADR-010.md`.
- TASK-M0-005 — added the NestJS/Fastify API, grammY bot, BullMQ worker, and
  Next.js/Tailwind web shells with their required local health endpoints.
- TASK-M0-006 — added Zod environment validation, section 19.6 Pino redaction,
  and exact bigint minor-unit money helpers with package-level Vitest tests.
- TASK-M0-007 — added the Prisma 7.10 schema, SQL `0001_init` migration,
  immutable-table guards, transaction guard, and initial system seeds.

## Verification

TASK-M0-001 verified on 2026-09-19:

- `pnpm install --frozen-lockfile` passed with pnpm 11.26.0.
- `pnpm test` passed: 3 repository tooling checks.
- `pnpm lint` passed with ESLint 10.10.0.
- `pnpm typecheck` passed with TypeScript 7.0.2.
- `pnpm format` passed with Prettier 3.9.8.

The supported execution environment is available: Node.js 24.21.0, pnpm
11.26.0, Docker 29.7.2, and Docker Compose v5.5.0. The initial WSL2/Docker
blocker is resolved.

## Important decisions

- The root compiler remains TypeScript 7.0.2 as required by section 6.1.
- Current `typescript-eslint` 8.70.0 rejects TypeScript 7.0.2. The shared
  `@remnaray/eslint-config` package therefore runs its parser tooling with a
  local TypeScript 6.0.3 dependency, following RISK-001's tool-only fallback;
  application code still uses the root TypeScript 7 compiler.
- `@eslint/js` is pinned to its current ESLint 10 companion version 10.0.1;
  the specification's 10.10.0 pin applies to `eslint` itself.
- pnpm added `minimumReleaseAgeExclude` entries for the pinned Turborepo,
  Node types, and intl-messageformat packages while generating the lockfile;
  these are retained so frozen installs remain reproducible with pnpm 11.26.0.
- pnpm build scripts are explicitly allowlisted in `pnpm-workspace.yaml`;
  telemetry and unused optional builds are denied. The optional native
  `cpu-features` build can report a network failure without failing install.
- Renovate validation uses the official validator; the policy keeps major
  updates behind approval, delays ordinary updates, and allows patch
  automerge only for development dependencies outside sensitive packages.
- Caddy verification on 2026-09-19: official `caddy:2-alpine` reported
  `v2.11.4 h1:XKxkMTgNSizEvKG6QHue6cAsFOteU2qA61w2tKkCWi0=` at digest
  `sha256:de23def33b17fb5d1290b0f6c2add1d70780e52341896c00a4c8a2a2fe9d355e`.
  The custom build uses `caddy:2.11.4-builder-alpine` and embeds
  `github.com/mholt/caddy-ratelimit`.
- Remnawave verification on 2026-09-19: official release `v3.4.4`, backend
  image `ghcr.io/remnawave/backend:3.4.4`, OpenAPI SHA-256
  `bebc345543b82c66ee1f956333e65cddfb8aec46099bf4427de38fb43df69396`.
  The v3 contract uses numeric `userId` values and does not expose the
  specified Telegram lookup route; ADR-010 records each affected row.
- M0-005 uses CommonJS NestJS output as required by section 6.1. The API and
  worker are inert with external services unconfigured; the BullMQ worker is
  enabled only with `RR_WORKER_ENABLED=true`, while all health routes remain
  available for local smoke checks.
- M0-006 keeps environment validation free of secret values in error messages,
  masks email as `a***@domain`, redacts all section 19.6 secret categories,
  and performs money operations with `bigint` only.
- M0-007 keeps trigger-heavy PostgreSQL behavior in hand-reviewed SQL while
  Prisma owns the typed schema/client; generation works with a safe local URL
  fallback and deployment still requires the real `DATABASE_URL`.

## Definition of Done review

- Section 25.9: tooling acceptance checks, tests, documentation and Changeset
  are present. No application FR, locales, OpenAPI, migration or secret
  handling changed in this infrastructure task.
- Maintainer review and hosted CI/proxy-smoke remain external gates; CI and
  proxy applications are scheduled later in M0 and are not claimed as passed.
- TASK-M0-002 acceptance checks passed: frozen install, `pnpm ls --depth 0`,
  five tests, lint, typecheck, formatting, and Renovate config validation.
- TASK-M0-003 acceptance checks passed: Docker build, runtime `caddy version`,
  runtime `http.handlers.rate_limit` module check, six tests, lint, typecheck,
  and formatting.
- TASK-M0-004 acceptance checks passed: official release/OpenAPI retrieval,
  endpoint and schema comparison, ADR-010 coverage test, seven tests, lint,
  typecheck, and formatting.
- TASK-M0-005 acceptance checks passed: frozen install, eight tests, lint,
  typecheck, formatting, Turbo build, and local HTTP 200 smoke checks for
  API, bot, worker, and web health endpoints.
- TASK-M0-006 acceptance checks passed: config/logger/money Vitest suites
  (10 tests), root tests, lint, typecheck, and formatting.
- TASK-M0-007 acceptance checks passed: Prisma generation, migration static
  tests, clean PostgreSQL 18 `migrate deploy`, seed counts, immutable ledger
  trigger check, root tests, lint, typecheck, and formatting.

## Known blockers

None. The corrected Git policy allows staging and commits. Nested
`node_modules/` remain ignored, and the handoff file is tracked.

## Next

TASK-M0-004 — verify the current Remnawave panel version, retrieve its
OpenAPI contract, and document the result in `docs/adr/ADR-010`.
