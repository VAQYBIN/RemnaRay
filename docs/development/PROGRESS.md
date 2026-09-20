# RemnaRay Development Progress

## Current milestone

M5. M4 acceptance is closed; see "M4-003 Lighthouse verification".

## Current task

TASK-M5-004 (the TLS modes end to end: `acme`, the `certbot` container with its
bootstrap configuration and flag reload, `custom`, and `tls-check`).
TASK-M5-001 … TASK-M5-003 are complete and committed; see their verification
sections.

## M5 entry audit — 2026-09-20

- Read AGENTS.md, this handoff, the relevant implementation, and authoritative
  specification sections 9.1, 17.4, 25.6, 25.9 and ADR-009. The requested first
  task is TASK-M5-001, dependent on TASK-M4-009; its acceptance is AC-171 with
  the Playwright setup flow and a 404 after completion.
- Initial `git status --short` and `git diff` were empty. Inspected
  `git log --oneline -15`; HEAD was `7b99197`. No M5 implementation commits
  were present in that history.
- Confirmed and repaired the local M4 OpenAPI defect: `apps/api/openapi.json`
  previously declared
  `3.0.3`, has no schema components, and many request bodies only declare
  `type: object`. The API build script previously only ran `tsc -p tsconfig.json`;
  there was no OpenAPI generation step. `apps/api/openapi/generator.ts` now
  uses `OpenApiGeneratorV31` and the shared `packages/domain/src/contracts/`
  schemas, while the existing route map is preserved as
  `apps/api/openapi.routes.json`; the build regenerates `apps/api/openapi.json`.
  The generated document is 3.1.0 with eight shared schemas and 128 paths,
  and the root tooling test asserts the generation boundary. Context7 resolved
  `/asteasolutions/zod-to-openapi` and confirmed the registry and
  `OpenApiGeneratorV31` APIs; documentation access is available.
- The OpenAPI repair now satisfies section 9.1, ADR-009 and section 25.9 item
  5 for the shared contracts. Its route metadata remains a checked-in source
  map because the existing Nest controllers do not expose a complete runtime
  contract registry; future route additions must update that map and the
  shared Zod contract used by the generator.
- Confirmed the outstanding external M4-003 acceptance gate: Lighthouse
  performance >= 90, accessibility >= 90 and SEO >= 95 on the reference
  server (sections 13.5 and 25.5). No reference-server address/access or
  measurement report is supplied in the handoff or repository. The running
  Docker services are the local development PostgreSQL and Valkey containers;
  they are not evidence of a reference-server run. No Lighthouse check is
  configured in the current CI workflow.
- Local tools are available: Node 24.21.0, pnpm 11.26.0 and Docker 29.7.2.
  This is not a local runtime or Context7 outage. Existing task test results
  below remain historical results; application tests were rerun for the
  OpenAPI correction and the checks are recorded below.
- No M4 implementation is overwritten, no M5 task is claimed complete, and
  M6 remains unopened. Earlier statements that M4 was finished mean the
  implementation sequence was committed, not that all acceptance gates passed.

### Entry blocker and exact continuation — resolved

The entry blocker recorded above was the unverified Lighthouse measurement.
It was wrong to treat it as external: NFR-010 names CI as its verification
method, and the measurement needs the production artefacts, not a hosted
reference server. `pnpm lighthouse` now runs the audit against the same
Testcontainers stack the Playwright suite uses. See "M4-003 Lighthouse
verification"; continue at TASK-M5-001 and follow section 25.6 dependency
order through TASK-M5-009.

## Current handoff correction

- Committed implementation: `c56c5fc` (M4-001), `a52a91e` (M4-002),
  `e1cd614` (M4-003). These are implementation checkpoints, not verified
  milestone acceptance. Preserve their history; fix gaps in follow-up commits.
- M4-001 gaps are now closed (see "M4-001 reconciliation" below).
- M4-002 gaps are now closed (see "M4-002 reconciliation" below).
- M4-003 gaps are now closed, including the Lighthouse ≥ 90/90/95
  measurement; see "M4-003 Lighthouse verification".
- M4-004 is implemented and committed; the earlier uncommitted draft was
  replaced.
- OpenAPI is generated into `apps/api/openapi.json` as 3.1.0 from the shared
  Zod contracts during the API build. The route source map is
  `apps/api/openapi.routes.json`; the generator and verification are recorded
  in "OpenAPI repair verification".

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
- TASK-M0-008 — added multi-stage app/web Dockerfiles, Compose runtime and
  development dependencies, safe environment initialization, and `./rr`.
- TASK-M0-009 — added GitHub Actions CI for Node 24/26 quality checks,
  package tests, Turbo build, and non-publishing app/web Docker builds.
- TASK-M1-001 — added the section 17.3 settings registry and Zod schemas,
  AES-256-GCM secret envelopes, transactional Prisma repository, Redis Pub/Sub
  cache invalidation, grouped admin settings API, schema endpoint, and safe
  export/import.
- TASK-M1-002 — added Telegram user upsert, v1 channel identity creation,
  cryptographically generated referral codes, referral attribution, payload
  parsing for `ref_`, `promo_`, and `plan_`, and the internal bot endpoint.
- TASK-M1-003 — added Telegram Login Widget verification, Valkey cookie
  sessions, HS256 bot JWT issue/exchange, cookie/bearer guards, CSRF checks,
  internal token guard, and Valkey-backed Nest throttling.

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
- M0-008 uses `pnpm` frozen installs in both image builders, rootless Node
  runtime users, read-only Compose services with `/tmp` tmpfs, and a fixed
  `172.28.0.0/16` network.

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
- TASK-M0-008 acceptance checks passed: app/web Docker builds, Compose config,
  built-image API/web health smoke checks, development PostgreSQL/Valkey plus
  three mock health checks, ten tests, lint, typecheck, and formatting.
- TASK-M0-009 acceptance checks passed: workflow coverage test, ten root tests,
  lint, typecheck, and formatting. Hosted GitHub Actions execution remains an
  external gate.
- TASK-M1-001 acceptance checks passed: six settings unit tests, Prisma runtime
  client build, API test, lint, typecheck, formatting, and full Turbo build.
  OpenAPI includes the settings routes; no migration was needed because M0-007
  already created the complete `settings` table.
- TASK-M1-002 acceptance checks passed: ten API unit tests, root tests, lint,
  typecheck, formatting, and full Turbo build. The existing M0-007 migration
  already contains unique `users.telegram_id`, `users.referral_code`, the
  Telegram identity uniqueness constraint, and referral attribution tables.
- TASK-M1-003 acceptance checks passed: thirteen API unit tests, root tests,
  lint, typecheck, formatting, and full Turbo build. The Telegram signature
  and expiry checks cover AC-132; no migration was needed because M0-007
  already created session-independent user and admin tables.
- TASK-M1-004 — added the transactional double-entry ledger, sorted account
  row locks with `FOR UPDATE`, held-reward-aware `available()`, insufficient
  funds protection, and ledger audit reconciliation.
- TASK-M1-005 — added validated plan CRUD, public plan list caching in Valkey,
  mutation invalidation, and `PLAN_HAS_SALES` protection for sold plans.
- TASK-M1-006 — added subscription lifecycle operations, one-time trial
  eligibility, purchase activation/renewal, plan-change quote/apply, grace and
  expiry transitions, and the internal expiry pass.
- TASK-M1-007 — added the typed undici Remnawave client, Fastify in-memory
  panel mock, panel sync/reconcile service, HMAC webhook boundary, and health
  endpoint.
- TASK-M1-008 — added the shared queue contract, transactional outbox writer,
  BullMQ relay with stable job IDs, and worker two-second cron skeleton.
- TASK-M1-009 — added the PostgreSQL 18 + Valkey 9.1 Testcontainers integration
  gate covering migrations, concurrent ledger debits, trial, activation,
  renewal, and expiry.

- TASK-M2-001 — added the PaymentProvider contract and registry, invoice and
  payment-event repositories, idempotent webhook application, invoice expiry,
  polling, Idempotency-Key handling, and the payments worker queue boundary.
- TASK-M2-002 — added the deterministic `payments-mock` provider and payment
  integration fixtures.
- TASK-M2-003 — added YooKassa creation, IP allowlisting, receipts, webhooks,
  and mandatory status re-fetching.
- TASK-M2-004 — added Robokassa ResultURL signatures, `OK<InvId>` responses,
  polling boundary, and fiscal receipt serialization.
- TASK-M2-005 — added Lava invoice creation, additional-key HMAC verification,
  and status polling.
- TASK-M2-006 — added Platega transaction creation and polling-only settlement.
- TASK-M2-007 — added Crypto Pay fiat-RUB invoices and
  `crypto-pay-api-signature` verification.
- TASK-M2-008 — added Telegram Stars invoice links, precheckout support, and
  successful-payment normalization.
- TASK-M2-009 — added balance topups and purchases, sorted account locking,
  late-payment balance credit, partial refunds, and plan-change quote logic.
- TASK-M2-010 — added `ReceiptData`, fiscal settings integration, and provider
  receipt serialization with fallback email support.

- TASK-M3-001 — added the grammY middleware chain, Valkey sessions and rate
  limiting, ICU catalog loading, internal `ApiClient`, Telegram Stream webhook
  ingress with consumer groups and `XAUTOCLAIM`, polling with runner, live
  transport reconfiguration, and localized command registration.

- TASK-M3-002 — added the state-aware home menu, trial and subscription
  screens, panel link reset with a 24-hour Valkey guard, QR PNG and client
  deep-link output, plan/payment screens, balance and preset top-ups,
  referrals, language, support, notifications, and email prompt routes.
- TASK-M4-001 — added the `packages/ui` shadcn-style primitives, Radix dialog,
  CVA variants, loading/empty/error states, runtime Tailwind CSS variables,
  Zod theme schema and contrast validation, `_admin` and `manta` themes, and
  the complete Manta asset set.
- TASK-M4-002 — added password + Argon2id/TOTP admin authentication, 12-hour
  `rr_asid` sessions with CSRF tokens, five-failure lockouts, shared RBAC
  permissions, and sanitized immutable audit interception.
- TASK-M4-003 — added localized public landing and legal pages, flat ru/en
  catalog loading, next-intl locale negotiation, SEO metadata, robots/sitemap,
  and cached theme asset delivery.

## Verification correction

The M1-001..003 runtime correction added a CommonJS-compatible DB export,
shared Prisma/Valkey infrastructure, Nest dependency wiring, flat settings API
shape (`patch`, JSON schema, export/import), strict future-dated Telegram
expiry, session sliding TTL, internal network/token guards, CSRF/admin checks,
and retry-safe concurrent user upsert. Verified with a clean PostgreSQL 18
migration, API startup against PostgreSQL/Valkey, `/api/v1/health` HTTP 200,
internal token rejection outside the trusted CIDR, successful trusted internal
user/token requests, 16 API tests, root tests, lint, typecheck, formatting, and
Turbo build.

- TASK-M1-004 acceptance checks passed: 18 API tests, clean PostgreSQL
  migration/deploy, ten parallel real PostgreSQL debits of 100 from a 1000
  minor-unit balance, `available() = 0`, audit over 7 accounts with zero
  mismatches, root tests, lint, typecheck, formatting, and Turbo build. No
  migration was needed because M0-007 already created all ledger tables and
  immutable triggers.
- TASK-M1-005 acceptance checks passed: 21 API tests, real PostgreSQL/Valkey
  CRUD and public cache smoke, 60-second cache TTL, mutation invalidation,
  public filtering, deactivation filtering, and `PLAN_HAS_SALES` rejection;
  root tests, lint, typecheck, formatting, and Turbo build. No migration was
  needed because M0-007 already created `plans` and transaction plan links.
- TASK-M1-006 acceptance checks passed: 22 API tests, real PostgreSQL lifecycle
  smoke for trial, activation, renewal, quote/apply, and expiry, root tests,
  lint, typecheck, formatting, and Turbo build. No migration was needed because
  M0-007 already created the partial one-live-subscription index.
- TASK-M1-007 acceptance checks passed: SDK/mock typecheck, lint, unit tests,
  package builds, joint HTTP mock smoke (`create → getByUsername → health`),
  API typecheck/lint, and full source formatting. ADR-010 numeric panel ID
  incompatibilities remain explicitly documented for later mapping work.
- TASK-M1-008 acceptance checks passed: root tests, lint, typecheck, formatting,
  full Turbo build, and real PostgreSQL/Valkey outbox smoke: rollback left zero
  rows, committed job published to BullMQ in 34 ms.
- TASK-M1-009 acceptance checks passed: `pnpm test:m1` with fresh PostgreSQL 18
  and Valkey 9.1 containers, 10-way AC-070 concurrent debit assertion, and
  subscription lifecycle assertions. Full M1 Definition of Done checks passed:
  root tests, package/API tests, lint, typecheck, formatting, Turbo build,
  migration deploy, contract mock smoke, and runtime API smoke.

## Known blockers

None that stop development. One open specification item is recorded in
"M5-001 open item — the step 5 logo upload". Hosted GitHub Actions execution and maintainer
review remain external Definition of Done gates. Proxy smoke is scheduled in
M5 (TASK-M5-007) and TASK-M5-004 needs a stand with a real domain for its
manual certificate checklist.

Local browser runs (`pnpm test:e2e`, `pnpm lighthouse`) need Chromium's system
libraries. Installing them needs root; `docs/e2e.md` documents the rootless
loader-prefix alternative, which is what this machine uses.

The `web` image cannot be built on this machine: Next.js static generation runs
out of memory inside the Docker VM, which shares the same 7.9 GB. The same
build succeeds on the host in 22.5 seconds, and the CI `docker` job builds the
image on a runner with room. See "Defects found while verifying M5-002".

## OpenAPI repair verification — 2026-09-20

- `pnpm --filter @remnaray/api build` now regenerates the artifact with
  `OpenApiGeneratorV31`; the result is OpenAPI 3.1.0 with eight shared Zod
  schemas and 128 paths.
- The new tooling test passes, as do API lint/typecheck, root lint, root and
  workspace typechecks, formatting, and the full Turbo build.
- The generated route map is kept in `apps/api/openapi.routes.json`; generated
  output is `apps/api/openapi.json`. No secret or runtime credential is used by
  generation.
- This correction is committed separately as a follow-up to the M4 handoff;
  it does not claim M4 acceptance because the reference-server Lighthouse
  gate remains unverified.

## M3-001 verification

- Context7 documentation was checked for grammY middleware/webhooks, runner,
  Redis sessions, rate limiting, auto-retry, and ICU formatting. The installed
  package API was then checked locally because ratelimiter 1.2.1 exposes the
  older `limit`/`RedisStore` contract.
- `@remnaray/i18n-core`: typecheck and 2 tests passed.
- `@remnaray/bot`: typecheck and 3 tests passed, including internal headers,
  structured API errors, and the 20 updates/10 seconds drop boundary.
- `@remnaray/api`: typecheck and 30 tests passed, including Telegram Stream
  insertion, secret validation, locale delivery, and bot config.
- The API publishes `tg:updates`; the bot uses `XACK` after successful handling
  and reclaims pending entries after 60 seconds. Settings changes for `bot.*`
  and `domain.*` reload transport and commands without restart.

## M3-002 verification

- Context7 documentation was checked for the installed QR generator's async
  `toBuffer` API; QR output is generated as a 512px PNG in the bot process.
- `@remnaray/bot`: lint, typecheck, and 5 tests passed.
- `@remnaray/api`: lint, typecheck, and 31 tests passed, including home-menu
  state data, bot config, locale delivery, and webhook stream insertion.
- The internal bot facade serializes bigint money and panel values as strings,
  enforces acting-user ownership for invoice checks, and exposes top-up,
  referral, transaction, and subscription actions through `ApiClient`.

## M2 verification

- PostgreSQL 18 integration: duplicate paid webhook produced one invoice
  transaction and two ledger entries; late payment was credited to balance;
  balance payment and partial refund assertions passed.
- Provider contract tests: 28 API tests passed, including YooKassa IP ranges,
  Robokassa signature and acknowledgement, Lava HMAC, CryptoBot signature,
  Platega polling-only behavior, and Stars successful-payment normalization.
- `pnpm test`, database migration tests, `pnpm test:m1`, and `pnpm test:m2`
  passed.
- `pnpm lint`, `pnpm typecheck`, `pnpm format`, and the full Turbo build passed.
- Migration `0002_payment_event_processing` permits only processing markers on
  payment events, fixing the immutable-event processing contract.
- OpenAPI, provider documentation, ten Changesets, and the M2 integration
  fixture are present.

## Next

TASK-M5-004, then section 25.6 dependency order through TASK-M5-009.
Do not begin M6.

## M3 acceptance reconciliation

The initial acceptance audit identified the M4 ordering conflict and runtime
gaps. The following M3 work resolved them without rewriting history: atomic
Stream deduplication and both-transport persistence, callback acknowledgement
before limiting, settings-based token startup, API-built i18n output, the
subscription reset guard, conversations, minimal RBAC/audit, support/promo
boundaries, and the Telegram mock/e2e harness. The permitted M4 dependencies
are included in M3; M4 remains unopened.

## M3-003 verification

- Context7 documentation was checked for `@grammyjs/conversations`, including
  replay storage, filtered waits, timeout handling, and conversation exit.
- Added Valkey-backed conversation storage with a 10-minute TTL, promo,
  custom top-up, receipt email, and support-message flows, three-attempt
  validation, command cancellation, and support forwarding.
- Added internal API boundaries for promo reservation and support forwarding;
  updated OpenAPI and both locale catalogs.
- `@remnaray/bot`: lint, typecheck, 8 tests, and build passed.
- `@remnaray/api`: lint, typecheck, 31 tests, and build passed.
- i18n lint/typecheck/tests, root tooling tests (10), full Turbo build, and
  Prettier passed.

## M3-004 verification

- Added `403` Telegram error handling that marks `users.bot_blocked_at`,
  suppresses delivery errors, and sends an eight-character incident code for
  handler failures. Added the unblocked endpoint used by `/start` flows.
- `autoRetry` remains the 429 retry boundary; outgoing message methods now use
  a serialized transformer with 30 messages/second global and 1 message/second
  per-chat spacing.
- `@remnaray/bot`: lint, typecheck, and 10 tests passed.
- `@remnaray/api`: lint, typecheck, and 31 tests passed.

## M3-005 verification

- Added the agreed minimal M4 dependency: bot-admin role checks for active
  `admin`/`operator` records, user lookup, daily stats, broadcast status, and
  `/admin_extend` with a zero-value adjustment transaction and immutable
  `audit_log` row using `reason='bot-admin'`.
- `@remnaray/api`: lint, typecheck, and 32 tests passed, including the audit
  assertion. `@remnaray/bot`: lint, typecheck, and 10 tests passed.

- TASK-M3-006 — added the HTTP Telegram Bot API mock with update injection,
  webhook/polling methods, message/payment/callback methods, and 403/429
  injection; added the first E2E-01 grammY interaction.

## M3-006 verification

- `@remnaray/telegram-mock`: lint, typecheck, and 3 tests passed, including
  getMe, webhook/update/sendMessage, 429 injection, and `/start` handling.
- The full Turbo build, root tooling tests, and formatting passed after the
  mock was added.

## M3 Definition of Done reconciliation

- All six M3 tasks have commits and task-level checks. The minimal RBAC/audit
  and referral/support dependencies explicitly permitted by the user were
  implemented inside M3.
- Hosted CI, maintainer review, live provider credentials, and proxy-smoke are
  external gates. M3 is complete and M4 is now active.

## M4-001 verification

- Context7 documentation was checked for Tailwind v4 `@theme inline`, React 19
  refs, Radix Dialog, CVA variants, and Zod 4 schemas.
- `pnpm theme-validate themes/manta` and `_admin` passed. The authoritative
  Manta palette reports the specified 3.03:1 primary/white pair as a warning;
  schema and asset validation still pass per section 18.3.
- Theme-schema tests: 3 passed. UI tests: 2 passed. Both package typechecks
  and lint passed; web typecheck and production build passed.
- Root `pnpm test` passed (10 tooling tests), `pnpm lint`, `pnpm typecheck`,
  `pnpm format`, and full `pnpm build` passed. Frozen install passed after the
  workspace lockfile update.
- Added `docs/theming.md` and `.changeset/m4-001-ui-theme.md`. No API routes,
  OpenAPI contract, or database migration changed in this task.

## M4-001 decisions

- `theme.json` remains the data source; `@remnaray/theme-schema` exports the
  runtime parser, CSS variable projection, and WCAG contrast helpers.
- `packages/ui` follows ADR-008 with Tailwind class composition, CVA variants,
  Radix Dialog accessibility, and reusable Skeleton/EmptyState/ErrorState
  components.
- The server layout emits validated Manta tokens and dark-mode variables;
  Tailwind v4 maps them with `@theme inline`, so a theme switch does not need
  a rebuild.
- The generated Manta OG asset is stored at 1200×630, with the required bot
  avatar at 512×512 and Apple touch icon at 180×180.

## M4-002 verification

- Context7 documentation was checked for Argon2id options, OTPAuth TOTP/URI
  handling, NestJS metadata/interceptors, and Prisma transactional writes.
- Added 2 domain RBAC tests, 3 admin API auth/audit/RBAC test files covering
  the fifth-failure `423` lock, TOTP enrollment, session creation, role and
  permission checks, and secret masking. API suite: 37 tests passed.
- `@remnaray/domain` and `@remnaray/api` lint/typecheck passed. OpenAPI now
  includes the admin auth routes; no migration was needed because M0-007
  already created `admins` and immutable `audit_log`.
- Added `docs/admin.md` and `.changeset/m4-002-admin-auth.md`. Password and
  TOTP secrets are encrypted or masked and are not written to audit rows.

## M4-003 verification

- Context7 documentation was checked for next-intl routing, request config,
  server translations, Next.js metadata, robots/sitemap, and Next 16 root
  parameters.
- `pnpm i18n-check` passed for 2 locales and 10 namespaces. Web lint,
  typecheck, production build, and the legal Markdown test passed. The build
  prerenders `/ru`, `/en`, all six localized legal routes, robots, and sitemap.
- Added `.changeset/m4-003-public-web.md`, `docs/i18n.md`, and the public web
  route set. No database migration or API route was required; public plans
  are read from the existing `GET /api/v1/public/plans` boundary.

## M4-001 reconciliation

Verified on 2026-09-20.

- `packages/ui` now exports the complete section 14.4 list: Button, Input,
  Select, Dialog, Sheet, Table, Tabs, Badge, Toast, Form (react-hook-form +
  zod), DataTable (cursor), MoneyInput, DateRangePicker, Stat, EmptyState,
  ErrorState, Skeleton, ConfirmDialog(reason). A test asserts the export list
  and renders the cursor table in loading/empty/error/ready states with
  `react-dom/server`.
- AA acceptance is now a hard gate: `contrastFailures()` fails the body-text
  pairs from section 13.5 and `pnpm theme-validate` exits non-zero on them. The
  section 18.3 warnings (including the specified 3.03:1 Manta primary/white
  pair) stay warnings.
- Themes load through `ThemeService` in `apps/api`: mounted directory scan,
  Zod validation, fingerprinted asset URLs, `ETag` plus `Cache-Control:
max-age=60` on `GET /api/v1/public/theme`, `GET /api/admin/v1/themes` rescan,
  and a `rr:theme.changed` subscription. `apps/web` reads those tokens per
  request with a five-second revalidation window (AC-181) and falls back to the
  bundled manifest only when the API is unreachable.
- Fixed a runtime defect found during this work: `@remnaray/domain` and
  `@remnaray/theme-schema` had no `dist` build and no `require`-resolvable
  export condition, so the compiled CommonJS API could not load
  `@remnaray/domain/rbac` at all (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Both now
  build to `dist` like the other workspace packages; `@remnaray/payments-mock`
  gained the missing `default` condition.
- Added `packages/domain/client.ts` — the single typed fetch + Zod client
  required by section 13.1 — with the section 9.3 error envelope.
- `compose.yaml` now mounts `./themes:/themes:ro` and `./locales:/locales:ro`
  into the app services and web, with `RR_THEMES_DIR`/`RR_LOCALES_DIR`.
- Checks: ui 8 tests, theme-schema 5 tests, api 42 tests, all workspace tests,
  `pnpm lint`, `pnpm typecheck`, `pnpm format`, full `pnpm build`, and
  `pnpm theme-validate` for `themes/manta` and `themes/_admin`.

## M4-002 reconciliation

Verified on 2026-09-20.

- AC-143: `AdminsService` adds the FR-143 CRUD (`GET/POST /api/admin/v1/admins`,
  `PATCH /:id`, `/:id/reset-password`, `/:id/reset-totp`, `/:id/deactivate`).
  Deactivating or demoting the last active `admin` answers `409 LAST_ADMIN`.
  The survivor check runs inside the update transaction and locks the remaining
  admin rows with `SELECT … FOR UPDATE`. Seven tests cover it, including
  inactive and soft-deleted rows.
- AC-144: `AuditInterceptor` now records the prior state the handler read.
  Handlers return `Audited(before, after, body?)`; the interceptor writes both
  sides, copies only `reason` from the request body, masks secrets and truncates
  states above 16 KB.
- RBAC metadata now covers every admin route that exists: settings
  (`settings.read`/`settings.write`), plans (`plans.read`/`plans.write`),
  themes (`themes.read`) and admins (`admins.write` + `@Roles('admin')`). The
  hardcoded settings role check in `AuthGuard` was removed in favour of the
  decorators. The matrix itself gained `legal.read`, `themes.read` and
  `audit.read.self` so the section 14.2 operator row is represented exactly,
  plus `operatorLimits`/`limitKeyFor` for the `@Limit` work in TASK-M4-005.
- CSRF no longer exempts `/api/admin/v1/auth/*`. Login and TOTP have no session
  yet and are checked by origin and `X-Requested-With`; once a session exists,
  `X-CSRF-Token` is required too.
- The password failure counter is incremented by the database, the TOTP
  enrolment secret is encrypted with `RR_APP_KEY` before it reaches Valkey, and
  the login challenge `DEL` is the atomic commit point for issuing a session.
- Checks: api 56 tests (17 files), domain 5 tests, all workspace tests,
  `pnpm lint`, `pnpm typecheck`, `pnpm format`, full `pnpm build`.
- The settings import diff and the section 17.6 reaction matrix were completed
  in TASK-M4-009.

## M4-003 reconciliation

Verified on 2026-09-20.

- Locales are data again. The bot catalog moved out of TypeScript into
  `locales/{ru,en}/bot.json` and `notify.json`; `@remnaray/i18n-core` now reads
  the mounted directory and no process ships a compiled-in copy.
- Added `I18nService`: `locale_overrides` → `<lang>` file → `en` file → key,
  cached in Valkey under `rr:i18n:<lang>:<ns>` and dropped on
  `rr:i18n.changed`. It serves `GET /api/v1/public/i18n/:lang/:namespace` with
  an ETag and backs `GET /api/internal/v1/i18n/:lang` and the bot command
  descriptions.
- Added `GET /api/v1/public/config`, `GET /api/v1/public/legal/:doc?lang=` with
  `{brand}`/`{domain}`/`{support}` substitution, and `GET /api/v1/r/:code`
  plus the web `/r/[code]` handler, both storing `rr_ref` for 30 days.
- `GET /api/v1/public/plans` now returns the `PlanPublic` projection only;
  squads and internal flags no longer leak.
- Russian copy is real Russian. Landing, common, SEO, error and legal catalogs
  were rewritten in both languages, and the legal documents are complete.
- The landing follows section 13.2: brand and theme from the API, plans hidden
  when the list is empty or fails, features/steps/clients/FAQ from the catalog,
  CTA to `t.me/<bot>` plus the Login Widget, footer with legal links, support
  contact, language switcher and the `hide_powered_by` attribution.
- Money is formatted with `formatMoneyLocale`, which builds the decimal string
  from exact minor units before handing it to `Intl`.
- `pnpm i18n-check` now verifies ICU compilation, placeholder parity, array and
  object leaves, untranslated Russian copy and the legal documents.
- The site reads config, catalogs and theme with a five-second revalidation
  window, so AC-181 holds for the site side.
- Fixed workspace typechecks that had never run: `@remnaray/config` and
  `@remnaray/logger` were CommonJS packages compiled under `verbatimModuleSyntax`,
  and three shell packages failed on TS18003.
- Checks: api 69 tests (19 files), workspace tests, `pnpm lint`,
  `pnpm -r typecheck`, `pnpm format`, full `pnpm build`, `pnpm i18n-check`,
  `pnpm theme-validate`, and a CommonJS load of the compiled `AppModule`.
- Remaining external gate: Lighthouse ≥ 90/90/95 on the reference server.

## M4-004 verification

Verified on 2026-09-20.

- Added `MeService` with every section 9.4 `me/*` operation, exposed twice:
  `/api/v1/me/*` resolves the user from `rr_sid`, `/api/internal/v1/me/*` from
  `X-Acting-User` (section 9.5). The duplicated bot-only implementation was
  removed, as were the legacy `/api/v1/me/subscription/change/*` routes that
  section 9.4 does not define.
- Money crosses the public API as JSON numbers, `PlanPublic` is the only plan
  shape, transactions and referral lists are cursor-paginated, referral names are
  masked, promo codes follow the section 15.5 rules, and AC-061 hides a provider
  whose last healthcheck failed.
- Added `GET /me/subscription/qr` (512×512 PNG), `GET/DELETE
/me/subscription/devices`, `POST /me/invoices/:id/cancel`,
  `GET /me/plan-change/quote` and `POST /me/anonymize-request` (section 19.5
  records the request in `audit_log`; the admin alert belongs to TASK-M4-007).
- Fixed `POST /api/internal/v1/support/forward`, which the bot had been calling
  at a path the API never served.
- Web: all seven section 13.4 pages plus `/pay/[invoiceId]`, the Telegram Login
  Widget and `/auth/tg`. `useResource` caches reads for 15 seconds and mutations
  invalidate instead of applying optimistically.
- AC-133: `apps/web/test/account-pages.test.tsx` renders each page against a
  mocked API and asserts loading, empty and error, including the localized error
  message and the `requestId`. AC-134: `apps/web/test/pay-page.test.tsx` covers
  the three-second polling window, the countdown, Stars deep links, the paid and
  expired states and the error state.
- Checks: api 81 tests (20 files), web 13 tests (3 files), bot 10 tests, all
  workspace tests, `pnpm lint`, `pnpm -r typecheck`, `pnpm format`, full
  `pnpm build`, `pnpm i18n-check`.

## M4-005 verification

Verified on 2026-09-20.

- Added the section 9.6 admin API this task covers: dashboard overview, daily
  series and the requires-attention counters; user search, card and every FR-141
  action; subscriptions with bulk extension; invoices with masked provider
  events, recheck, transactions and refund; plan reorder. Every mutation returns
  `Audited`, so the interceptor records the prior state.
- Section 14.2 limits are enforced server-side: an operator cannot debit a
  balance, bulk-extend, anonymize or write plans, and their daily credit total is
  capped by `settings.operator.max_credit_minor`.
- Added `/admin` with the `_admin` theme and no locale prefix: login with TOTP
  enrolment, dashboard with Recharts revenue and registration charts, users list
  and card with reason modals, subscriptions with selection and bulk extension,
  payments with the event viewer and refund, and plan management with ordering.
- AC-142: `test/m4.admin.integration.test.mjs` recomputes revenue, payments, new
  users, trials, active subscriptions, balance liability and referral rewards
  with an independent SQL control on PostgreSQL 18 fixtures and compares them to
  the service output; the daily series sums back to the same totals. The same
  test covers AC-140 search by Telegram id, username and status, and AC-141
  audited extend, balance and anonymize actions.
- Checks: api 91 tests (22 files), web 18 tests (4 files), `pnpm test:m4`,
  workspace tests, `pnpm lint`, `pnpm -r typecheck`, `pnpm format`, full
  `pnpm build`, `pnpm i18n-check`.

## M4-006 verification

Verified on 2026-09-20.

- Added the section 15.2 accrual engine, running inside the payment
  transaction: source filters, the three modes, the daily cap with an
  administrator alert, idempotency on `source_transaction_id`, holds, the
  invitee bonus and the `maintenance.referral-release` endpoint.
- Refunding a source reverses the reward, fully or proportionally rounded down,
  and administrators can reverse manually from `/admin/referrals`.
- Section 15.3 attribution now also works from the site: `POST
/api/v1/auth/telegram` turns the `rr_ref` cookie into a `ref_<code>` start
  payload, and the sign-up invitee bonus is granted when the trigger says so.
- Section 15.5 promo codes reserve their slot under `SELECT … FOR UPDATE` on the
  promo code row before the invoice exists, so `max_uses` can never be oversold;
  the reservation carries the discount onto the invoice and settles to `applied`
  with `used_count + 1` on payment, or is released on cancel/underpay/failure.
- Added the admin promo code screen (create, batch generation, CSV export,
  soft delete) and the referral screen (programme form, accrual list, reversal),
  both hidden for roles without the permission.
- AC-152, AC-153 and AC-155 are covered by
  `test/m4.rewards.integration.test.mjs` on PostgreSQL 18; the test also asserts
  that held rewards are not spendable through `ledger.available()`.
- Checks: api 91 tests, web 18 tests, workspace tests, `pnpm lint`,
  `pnpm -r typecheck`, `pnpm format`, full `pnpm build`, `pnpm i18n-check`, and
  the M1, M2 and M4 integration gates.

## M4-007 verification

Verified on 2026-09-20.

- Added `NotifyService` with the complete section 16.1 event table, section 16.2
  delivery rules and the `notify.scan-expiring` cron. Emitters write outbox jobs
  inside the transaction that caused the change, so a notification cannot exist
  without its cause.
- `notification_log` is immutable, so a row is written once with its final
  status; a short Valkey lock on the dedup key serialises concurrent workers and
  the unique index is the backstop. Migration `0003_notification_log_status`
  adds the `skipped` status section 16.2 needs for a banned recipient.
- Administrator alerts deliver to every active admin with a Telegram id in
  `settings.admin.language` and deduplicate on `rr:alert:<type>` for an hour.
  `payment.late`, `payment.underpaid` and `referral.daily_cap` already emit.
- The worker now consumes the `notify`, `panel` and `maintenance` queues as well
  as `payments`, and ticks the expiry scan and referral release every ten
  minutes. Added `POST /api/internal/v1/remnawave/sync-user`, which the
  `panel.sync-user` jobs had been queued against with no consumer.
- AC-160 and AC-163 are covered by `test/m4.notify.integration.test.mjs` on
  PostgreSQL 18, plus five `NotifyService` unit tests.
- Checks: api 96 tests, workspace tests, `pnpm lint`, `pnpm -r typecheck`,
  `pnpm format`, full `pnpm build`, `pnpm i18n-check`, and the M1, M2 and M4
  integration gates after the new migration.

## M4-008 verification

Verified on 2026-09-20.

- Added `packages/domain/segment.ts`: the section 16.3 DSL compiles to a plan
  the repository executes, with all ten operators and `now±Nd/h` relative dates
  covered by tests. A segment can never widen the mandatory exclusions.
- Added the editor contract: one text per language, at most four buttons of the
  three supported kinds, an optional photo, the four placeholders, and Telegram
  HTML validation that rejects any tag outside the section 16.3 list.
- `start` materializes the audience once as `pending` deliveries (migration
  `0004_broadcast_delivery_pending`) and queues chunks of 500. Chunks skip
  non-pending deliveries, throttle at 25 messages per second with
  `concurrency: 1`, re-read the status every 50 messages, mark `403` as blocked
  with `users.bot_blocked_at`, and back off on `429`.
- Added the admin screen with presets, segment preview, test-on-myself,
  start/pause/resume/cancel and the failures CSV.
- AC-161 is covered by `test/m4.broadcast.integration.test.mjs`: a run is paused
  mid-way, resumed, and every recipient receives exactly one message; blocked,
  opted-out and anonymized users never enter the audience.
- Checks: api 101 tests, domain 12 tests, workspace tests, `pnpm lint`,
  `pnpm -r typecheck`, `pnpm format`, full `pnpm build`, `pnpm i18n-check`, and
  the M4 broadcast and notification integration gates.

## M4-009 verification

Verified on 2026-09-20.

- AC-061: `GET /api/admin/v1/providers` reports `offeredToUsers` as
  `enabled && lastHealthcheckOk === true`, and `GET /api/v1/me/payment-methods`
  now uses the same rule, so a provider that was never checked or failed its
  last check is never offered. Saving a provider configuration runs a
  healthcheck immediately. Five `ProvidersService` tests cover it.
- AC-181: `PUT /settings` publishes the section 17.6 channels for the changed
  keys and answers with `applied`, `restartRequired` and `reconfigured`. The
  site revalidates config, catalogs and theme every five seconds and the bot
  caches catalogs for sixty seconds, dropping them immediately on
  `rr:i18n.changed`. Both windows are asserted by tests.
- AC-146: `GET /api/admin/v1/system` reports version, images, last panel
  reconciliation, outbox depth, database size, bot mode, TLS and backup markers
  and the health endpoint; `GET /system/queues` plus `retry-failed` complete the
  page.
- Added panel, bot, theme, locale and legal administration, the action journal
  with the operator-only scope, and the administrators screen on top of the
  FR-143 API from TASK-M4-002.
- `POST /settings/import` now returns a real diff for `dryRun`, and every value
  patched into `locale_overrides` is ICU-compiled before it is stored.
- Checks: api 109 tests, bot 12 tests, web 19 tests, workspace tests,
  `pnpm lint`, `pnpm -r typecheck`, `pnpm format`, full `pnpm build`,
  `pnpm i18n-check`.

## M4-003 decisions

- The current Next.js 16 `proxy.ts` convention is used for next-intl locale
  negotiation; it replaces the deprecated `middleware.ts` filename while
  preserving the specification’s middleware behavior.
- Flat catalog files are expanded into nested runtime messages only at the
  web request boundary, preserving the specification’s dotted-key data format.

## M4-010 verification

Verified on 2026-09-20.

- `pnpm test:e2e` builds the workspace and runs 25 Playwright tests against a
  real stack: PostgreSQL 18 and Valkey 9.1 in Testcontainers, the API from
  `dist`, the site from its standalone build, and a reverse proxy that serves
  both from one origin exactly as nginx or Caddy do in a deployment
  (`e2e/setup/stack.mjs`). All 25 pass in under a minute.
- The coverage follows the section 22.1 E2E row. Site: landing brand, plan and
  call-to-actions, the language switch, legal pages, robots and sitemap, the
  public API, the `/r/<code>` referral cookie. Account: the anonymous redirect,
  the `/auth/tg` sign-in the bot performs, the empty subscription state, the
  plan list with providers and the promo field, balance and history, saving
  settings, sign-out, and a purchase with the `mock` provider that the provider
  confirms with its signed webhook. Administration: a wrong password, the
  password + TOTP flow, the dashboard widgets and charts, user search and the
  card, the journal, creating a plan, the AC-061 provider gate, the system page,
  a forged mutation and one with a wrong CSRF token, and `Disallow: /admin`.
- An administrator TOTP code may be redeemed once, so the suite signs in once in
  a `setup` project and the administration specs reuse that `storageState`.
- CI gained an `e2e` job after `quality`: `pnpm typecheck:e2e`, Chromium with
  its system dependencies, `pnpm test:e2e`, and the `test-results` artifact on
  failure. `docs/e2e.md` documents the harness and the rootless local run.
- Defects the suite found, each fixed in this task:
  - Next.js 16 rejects a local `next/image` source carrying a query string
    unless `images.localPatterns` allows the path. Section 18.2 serves theme
    assets as `/themes/<slug>/<asset>?v=<version>`, so every landing render
    after the build threw and the site kept serving its build-time fallback —
    which also broke the AC-181 five-second window on the live site.
    `apps/web/next.config.ts` now declares the patterns and a web test guards
    them.
  - `GET /api/v1/me` was declared by both `AuthController` and `MeController`,
    so Fastify refused to start with `FST_ERR_DUPLICATED_ROUTE`. The duplicate
    route and the service method it used are removed.
  - `RbacGuard` was registered only through `APP_GUARD`, so the administration
    module could not export it (`UnknownExportException`).
  - `/auth/tg` and `/r/<code>` built an absolute redirect from the request URL,
    which leaks the internal host behind a reverse proxy. Both now answer with a
    relative `Location`.
- Checks: 25 Playwright tests, `pnpm lint`, `pnpm typecheck`,
  `pnpm typecheck:e2e`, `pnpm -r typecheck`, `pnpm test` (10),
  `pnpm -r test` (api 109, web 20, bot 12, ui 8 and the remaining packages),
  `pnpm format`, full `pnpm build`, `pnpm i18n-check` (1264 messages),
  `pnpm theme-validate` for `manta` and `_admin`.

## M4 Definition of Done review

Section 25.9, reviewed on 2026-09-20 for TASK-M4-001 … TASK-M4-010.

1. Conventions and gates: `pnpm lint`, `pnpm typecheck`, `pnpm -r typecheck`
   and `pnpm typecheck:e2e` are green.
2. Tests: unit and component tests per package, Testcontainers integration
   suites (`test/m4.*.integration.test.mjs`) and the Playwright E2E suite. No
   coverage threshold was lowered.
3. Acceptance criteria with an executing test: AC-130 and AC-136 (M4-003),
   AC-133 and AC-134 (M4-004), AC-140 … AC-142 (M4-005), AC-143 and AC-144
   (M4-002), AC-150 … AC-156 (M4-006), AC-160 and AC-163 (M4-007), AC-161
   (M4-008), AC-061, AC-146 and AC-181 (M4-009), the section 22.1 E2E row
   (M4-010), and `theme-validate` with the AA contrast check (M4-001).
4. Locales: every key exists in `ru` and `en`; `pnpm i18n-check` is green.
5. OpenAPI: `apps/api/openapi.json` covers the M4 routes and is generated as
   a 3.1.0 document from the shared Zod contracts during the API build; see
   "OpenAPI repair verification".
6. Migrations: `0003_notification_log_status` and
   `0004_broadcast_delivery_pending` carry the `reversible` header and are
   applied from scratch by every integration run.
7. Documentation: `docs/theming.md`, `docs/admin.md`, `docs/i18n.md`,
   `docs/account.md`, `docs/rewards.md`, `docs/notifications.md`,
   `docs/broadcasts.md` and `docs/e2e.md`.
8. Changesets: one per task, `m4-001-*` … `m4-010-e2e`.
9. Secrets: the section 19.6 redaction tests pass and `Audited` never writes a
   secret value into `audit_log`; provider and panel credentials are stored in
   AES-256-GCM envelopes.
10. External gates that remain outside this repository's control: maintainer
    review, a full CI run on the hosted runners and the `proxy-smoke` job for
    both profiles (its templates land with M5). The Lighthouse ≥ 90/90/95
    measurement for M4-003 is no longer external; see the section below.

## M4-003 Lighthouse verification

Verified on 2026-09-20; this closes the last TASK-M4-003 acceptance gate.

- `pnpm lighthouse` (`tools/lighthouse-check.mjs`) boots the Playwright
  harness stack — PostgreSQL 18 and Valkey 9.1 in Testcontainers, the API from
  `dist`, the site from its standalone build, one reverse proxy in front of
  both — and audits it with the official Lighthouse desktop preset. NFR-010
  names CI as its verification method, so a `lighthouse` job runs it after
  `quality` and always uploads `test-results/lighthouse`.
- The account audit enters through `/auth/tg?token=<jwt>`, the way the bot's
  «Открыть кабинет» button does. Lighthouse clears storage before it navigates,
  so a cookie set up front would not survive; the run fails if the navigation
  does not end on `/<locale>/account`.
- Context7 resolved `/googlechrome/lighthouse` and `/radix-ui/primitives`; the
  programmatic `lighthouse(url, flags, config)` call, the desktop config export
  and the Slot `asChild` contract were implemented from that documentation.
- First measurement: performance 100, accessibility **85**, SEO 100. Four axe
  audits failed, three of them real markup defects:
  - Every "link that looks like a button" rendered a `<button>` inside an `<a>`
    or a `<Link>`, which fails `target-size` and nests two interactive
    elements. `Button` gained `asChild` (Radix `Slot`) and the fourteen call
    sites in the site, the account and the administration console now render a
    single element.
  - The Telegram login container carried `aria-label` on a plain `<div>`
    (`aria-prohibited-attr`); it is now `role="group"`.
  - The widget script injects its `<iframe>` next to the `<script>` Next.js
    appends to `document.body`, without a title (`frame-title`). A
    `MutationObserver` names `iframe[id^="telegram-login-"]` as it appears.
  - `color-contrast` stays: the Manta teal and white brand pairing the
    specification fixes in section 18.1 is 3.03:1, which `theme-validate`
    reports as a warning for the same reason. The palette is specified data and
    was not changed.
- Final measurement: landing `ru` and `en` performance 100, accessibility 96,
  SEO 100; the signed-in account accessibility 96. Section 13.2 requires
  90/90/95.
- Two Playwright assertions named the old roles (`button` «Выбрать тариф» and
  «Открыть»); both now assert `link`, which is what the corrected markup
  renders.
- Checks: `pnpm lighthouse`, `pnpm test:e2e` (25), `pnpm lint`,
  `pnpm typecheck`, `pnpm -r typecheck`, `pnpm typecheck:e2e`, `pnpm test`
  (11), `pnpm -r test` (api 109, web 22, bot 12, ui 8 and the remaining
  packages), `pnpm format`, full `pnpm build`, `pnpm i18n-check` (1264
  messages), `pnpm theme-validate` for `manta` and `_admin`.

### M4-003 Lighthouse decisions

- `chrome-launcher` rewrites its profile directory into a Windows path when it
  detects WSL, and a Linux Chrome then creates that literal name in the working
  directory. The tool passes `userDataDir: false` and its own
  `--user-data-dir`, so the profile always lands in the system temp directory.
- The browser is `CHROME_PATH` if set, otherwise Playwright's Chromium, so the
  rootless loader-prefix workaround in `docs/e2e.md` covers this command too.

## M5-001 verification

Verified on 2026-09-20.

- `apps/api/src/modules/setup/` implements `/api/setup/v1/*`: `state`, `token`,
  `steps/:step` for the seven writing steps, the three «Проверить» routes
  (`check/panel`, `check/bot`, `check/provider`) and `finish`. Every step
  validates on the server with its own Zod schema and writes straight into
  `settings` and the target tables.
- `SetupGuard` is registered as an `APP_GUARD` from a module imported before
  `AuthModule`, so a request made before the wizard finishes answers
  `SETUP_NOT_COMPLETED` 503 rather than `UNAUTHENTICATED`. `/api/setup/*` and
  `/api/v1/health*` stay open, which keeps the Compose healthcheck green and
  lets the bot wait instead of crash-looping (section 17.5). Once
  `setup.completed` is true the wizard answers `SETUP_ALREADY_COMPLETED` 404.
- Step 0 compares the submitted token with `argon2(RR_SETUP_TOKEN)`, stored in
  `setup_state.token_hash` on the first success, and blocks an address for
  fifteen minutes after five wrong attempts. It answers with `rr_setup`, a
  one-hour session that slides with every step.
- Step 1 is posted twice: without `code` the server generates the TOTP secret,
  keeps it encrypted in the wizard session and answers with the QR; with `code`
  it confirms and creates the administrator. An abandoned wizard therefore
  leaves no half-made account.
- `GET /state` serves the draft only to a wizard session. The draft names the
  domain, the panel and the brand, so an anonymous caller only learns which
  step to show. Secrets are never in the draft: they go into their encrypted
  columns when their step is submitted and the draft records `tokenSet: true`.
- `finish` requires every step but payments, flips `setup.completed`, marks
  `setup_state`, queues `panel.reconcile-all` through the outbox and publishes
  `rr:bot.reconfigure`, `rr:theme.changed` and `rr:i18n.changed`. The bot
  process owns `setWebhook`/`setMyCommands`, and its two-second reconcile loop
  picks the channel up; the administrators get the `setup.completed` alert.
- `apps/web/app/setup/` serves the eight-step UI on the `_admin` theme and
  answers 404 once the API says the wizard is closed. `apps/web/proxy.ts`
  redirects every path to `/setup` while it is pending, caching the answer for
  five seconds and permanently once the setup is done.
- AC-171: `e2e/specs/setup.spec.ts` walks E2E-02 steps 4–11 against a second
  stack whose database is empty and whose `RR_SETUP_TOKEN` is set, with the
  Remnawave and Telegram mocks behind the panel and bot checks, and ends on the
  404 for `/setup` and for the wizard API plus a 200 from the shop's public API.
- Checks: `pnpm test:e2e` (26), `pnpm lint`, `pnpm typecheck`,
  `pnpm -r typecheck`, `pnpm typecheck:e2e`, `pnpm test`, `pnpm -r test`
  (api 121, web 22, bot 12, ui 8 and the remaining packages), `pnpm format`,
  full `pnpm build`, `pnpm i18n-check` (1472 messages), `pnpm theme-validate`.

### M5-001 decisions

- The section 17.4 table gives step 1 two server interactions but one route.
  Both go to `POST /steps/1`; the presence of `code` selects enrolment or
  confirmation, so the documented route shape is kept.
- The «Проверить» buttons are separate `check/*` routes rather than steps, so a
  check never writes. Step 3 re-runs the panel check before it saves, and step 7
  healthchecks every provider it stores, which is what AC-061 needs.
- `PlansService.create` parses its own input and `planInputSchema` transforms
  the money fields into `bigint`, so the wizard hands it the untouched body and
  keeps the parsed copy only for the slug and the draft. A regression test
  covers it.
- The wizard's own e2e stack is a second `startStack({ seed: false })` rather
  than a mutation of the shared one: the section 22.1 specs need a shop whose
  setup is finished, and AC-171 needs one whose setup has not run. The main
  stack now seeds `setup.completed = true` for the same reason.
- `@remnaray/telegram-mock` gained the `tsconfig.build.json` and `build` script
  `@remnaray/remnawave-mock` already had, so the e2e harness can load it from
  `dist` the way it loads the panel mock.

### M5-001 open item — the step 5 logo upload

Section 17.4 lists «логотип (загрузка PNG/SVG → `themes/<slug>/overrides/`)»
among the step 5 fields. It is not implemented, and this is a specification
conflict rather than a shortcut: section 18.2 mounts `themes/` into `api` and
`web` as `./themes:/themes:ro`, so no process can write into it, and the
`RR_THEME_UPLOAD` flag of section 17.2 that would gate such an upload is
unimplemented across the whole repository — the M4 administration console does
not offer theme or asset upload either.

Closing it needs three things that belong together and not to this task: a
writable overrides mount in Compose, `ThemeService` resolving
`themes/<slug>/overrides/<asset>` ahead of the shipped asset, and the upload
endpoint behind `RR_THEME_UPLOAD`. Until then the wizard offers the theme
picker and section 18.3's documented `cp -r themes/manta themes/mybrand` flow
replaces assets on the host. Carry this into the M5 Definition of Done review.

## M5-002 verification

Verified on 2026-09-20.

- `deploy/proxy/nginx/Dockerfile` is `nginx:1.30-alpine` plus
  `nginx-module-acme`, both pinned. Verified against nginx.org on 2026-09-20:
  the Alpine v3.24 repository publishes `nginx-module-acme-1.30.5.0.4.1-r1`,
  which is the build for the `nginx/1.30.5` the base image carries, and the
  base image already ships nginx.org's signing key in `/etc/apk/keys`. The
  Dockerfile asserts `ngx_http_acme_module.so` exists, so a base image that
  moves ahead of the module fails the build.
- `deploy/proxy/nginx/` carries the whole section 21.3 configuration:
  `nginx.conf.tmpl`, `site.conf.tmpl`, the HTTP-only `site-bootstrap.conf.tmpl`,
  `tls-{acme,certbot,custom}.inc.tmpl`, `tls-cert-{acme,certbot,custom}.inc.tmpl`,
  and the verbatim `ratelimits.inc`, `security-headers.inc` and
  `common-proxy.inc`. `custom.d/` is the documented extension point and is
  copied through without ever being rewritten.
- `apps/api/src/tools/render-proxy.ts` renders them from `settings.domain.*`,
  `settings.admin.ip_allowlist` and `.env`, writes `tmp` + `rename` and, with
  `--watch`, re-renders on `rr:settings.changed` and publishes
  `rr:proxy.reload` only when the output actually changed.
- `apps/api/src/tools/proxy-reloader.ts` talks to the Engine API over the
  read-only docker socket, runs `nginx -t` before `nginx -s reload`, and reports
  every apply to the new `POST /api/internal/v1/system/proxy-reload-result`,
  which writes `audit_log(action=proxy.reload)` and raises `proxy.config_invalid`
  on a refusal. It also watches certbot's `/etc/letsencrypt/.renewed` flag.
- Compose gained `proxy-config`, `proxy-nginx` and `proxy-reloader` under the
  `nginx`/`caddy` profiles with the section 21.1 volumes, and `./rr` now reads
  `RR_PROXY_PROFILE`/`RR_TLS_MODE` from `.env` so one command starts a profile
  (NFR-013), plus `proxy:render` and `proxy:reload`.
- Acceptance: `pnpm test:m5` builds the image, asserts the module is in it,
  renders `acme`, `certbot` and `custom` and runs `nginx -t` on each — all three
  pass — then changes `settings.domain.main` and measures the reload. It took
  **1277 ms** against a fifteen-second budget. A `proxy` CI job runs it, and the
  nginx image joined the CI docker matrix.
- Checks: `pnpm test:m5`, `pnpm lint`, `pnpm typecheck`, `pnpm -r typecheck`,
  `pnpm typecheck:e2e`, `pnpm test` (11), `pnpm -r test` (api 131, web 22,
  bot 12, ui 8 and the remaining packages), `pnpm test:e2e` (26), `pnpm format`,
  full `pnpm build`, `pnpm i18n-check` (1476 messages),
  `docker compose --profile nginx config`, the nginx image build with its
  module assertion, and the app image build including a runtime check that
  `dist/tools` resolves its modules through the symlink. The web image build is
  recorded below as blocked by this machine's memory.

### M5-002 decisions

- The deployment tools live in `apps/api/src/tools/` so they are built with the
  API and share its `node_modules`; the runtime image links
  `dist/tools -> apps/api/tools`, so section 21.1's documented
  `node dist/tools/render-proxy.js` command works unchanged and Node still
  resolves modules next to the real files.
- `nginx -t` loads the certificate files, so the `certbot` and `custom` modes
  cannot be validated without one. The acceptance test mounts a throwaway
  self-signed pair at both documented paths; `acme` needs none because the
  module serves the certificate through variables.
- OCSP stapling is rendered for the `certbot` mode only. Section 21.3 puts it
  in the shared server block, but the ACME module's `$acme_certificate`
  variables do not support stapling and a `custom` certificate may be
  self-signed, so the directive moved into `tls-cert-certbot.inc`.
- The `extra_domains` redirect server, the administration allowlist and the
  `/api/docs` denial are emitted only when they apply. An empty `server_name`
  would make nginx redirect every unmatched host, and an unconditional
  `deny all;` would lock out the very surfaces the settings leave open.
- `.prettierignore` now covers `deploy/proxy/**`: Prettier infers the `html`
  parser for `.inc` and reflows an nginx include into an invalid file. The
  acceptance test caught it, which is what it is for.

### Defects found while verifying M5-002

Rebuilding the images for the `dist/tools` link surfaced two that predate this
task; both are fixed in the same commit and neither is an M5-002 requirement.

- Both `deploy/docker/app.Dockerfile` and `deploy/docker/web.Dockerfile` ran
  `pnpm --filter <app> build`, which does not build the workspace packages the
  application consumes from `dist`. The API's OpenAPI generation (added with
  `1396dbc`) and every `apps/web` import of `@remnaray/domain` therefore failed
  inside the image while `pnpm build` stayed green locally, because Turbo
  resolves `^build`. Both images now run their application through Turbo, and
  the web image copies `locales/` and `themes/` into the build stage because
  prerendering reads them.
- With that fixed, the web image still fails to build on this machine, and it
  is an environment limit rather than a repository defect. Inside Docker the
  Next.js static generation runs seven workers, pages exceed the sixty-second
  per-page budget and a worker finally exits with code 1 — the signature of
  memory pressure. The identical build on the host, with `.next` deleted and
  the same `INTERNAL_API_URL`, finishes in **22.5 seconds with no timeouts**,
  so the inputs are sound; the Docker VM shares this machine's 7.9 GB and the
  build also installs the workspace and builds four packages first. The CI
  `docker` job, which now includes the web image, verifies it on a runner with
  room. An earlier diagnosis blaming DNS was wrong: setting
  `INTERNAL_API_URL` did not change the symptom. The setting is kept anyway,
  because a build should not depend on what a resolver does with `api`.
- NFR-011 caps `api`/`bot`/`worker` at 250 MB and `web` at 300 MB. The app
  image copies the whole `.pnpm` store and is far above that; the section 6.1
  note and NFR-011 both point at `pnpm deploy --prod` as the remedy. This
  belongs to the image work, not to the proxy profile, and is carried into the
  M5 Definition of Done review.

## M5-003 verification

Verified on 2026-09-20.

- `deploy/proxy/caddy/Caddyfile.tmpl` is the section 21.4 configuration in
  full, rendered by the same `render-proxy` into the same `proxy-conf` volume
  and applied by the same `proxy-reloader`, so section 21.5's invariant holds:
  the profiles differ only in which containers run.
- `ghcr.io/remnaray/caddy` was already `caddy:2.11.4` rebuilt with
  `github.com/mholt/caddy-ratelimit` from TASK-M0-003; the acceptance test now
  asserts `http.handlers.rate_limit` is in the image it builds. The five zones
  carry the nginx numbers: `rr_webhooks` 300/10s, `rr_auth` 5/1m, `rr_admin`
  30/1m, `rr_api` 100/10s, `rr_general` 200/10s, plus the
  `order rate_limit before basicauth` the module needs.
- `RR_CADDY_IMAGE=caddy:2-alpine` renders the same file without any
  `rate_limit` block — the documented degradation of section 21.4 — and
  `GET /api/admin/v1/system` now answers `proxy.rateLimited`, so the console
  can show it instead of leaving it silent.
- Caddy owns its certificates, so the profile takes `acme` (default) and
  `custom`, and the renderer refuses `certbot` rather than emit a
  configuration that would quietly not work.
- Acceptance: `pnpm test:m5` builds the image, renders `acme`, `custom` and the
  stock-image variant and runs `caddy validate` on each — all three report
  `Valid configuration` — and asserts the `certbot` refusal. The nginx half of
  the suite still passes, with the reload after a domain change at **569 ms**.
- Checks: `pnpm test:m5` (2), `pnpm lint`, `pnpm typecheck`, `pnpm -r typecheck`,
  `pnpm typecheck:e2e`, `pnpm test` (11), `pnpm -r test` (api 136, web 22,
  bot 12, ui 8 and the remaining packages), `pnpm format`, full `pnpm build`,
  `pnpm i18n-check` (1476 messages), and
  `docker compose --profile caddy config`.

### M5-003 decisions

- Section 21.4 names the owner's certificate path `/etc/caddy/certs`, which
  cannot work: `/etc/caddy` is the read-only `proxy-conf` volume, and Docker
  cannot create a mount point inside a read-only mount — the acceptance test
  failed on exactly that. The directory is mounted at `/certs` instead and the
  rendered `tls` directive names it. The nginx profile is unaffected, because
  `/etc/nginx` there is not a volume.
- `custom.d/*.caddy` mirrors the nginx profile's `custom.d/*.conf`; the
  renderer picks the suffix from the profile so neither can pull the other's
  files in.
