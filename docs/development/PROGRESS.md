# RemnaRay Development Progress

## Current milestone

M3

## Current task

TASK-M3-005 is next; TASK-M3-004 is implemented, verified, and ready to commit.
M3-001 and M3-002 received runtime corrections in this commit series; their
remaining acceptance gaps are tracked below.

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

M3 implementation is in progress. Hosted GitHub Actions execution, maintainer
review, provider credential healthchecks, and the later proxy-smoke/full e2e
gates remain external gates. The specification lists M2-008 as depending on
M2-008; the bot has no external credential dependency for its deterministic
contract tests. No credentials were required for TASK-M3-001.

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

M3-003 is next. Do not start M4.

## M3 acceptance correction

The earlier M3 completion statements above describe partial implementation,
not acceptance. Commits 4829297 and f59894c must not be treated as proof of DoD.
No history has been rewritten. Confirmed gaps under repair:

- M3-001: transport switching and pending-update recovery have no integration
  acceptance test; throttled callbacks are not acknowledged; startup still
  depends on TELEGRAM_BOT_TOKEN instead of settings; catalogs export TS source.
- M3-002: QR is generated in bot instead of API; client links and trial settings
  are hardcoded; missing device/plan-change/invoice-cancel/referral-list screens;
  no executing AC-042; OpenAPI has not been regenerated.
- M3-003 is committed; its acceptance evidence is recorded below.
- M3-005 depends explicitly on M4-002. M3-006 E2E-01 steps 3/6/8 depend on
  notification/referral modules scheduled in M4-007/M4-006. User was asked to
  resolve the milestone-order contradiction; independent M3 work continues.

Next: repair and verify independent M3-001 transport/runtime acceptance before
accepting further tasks. Do not start M4 without resolving the ordering conflict.

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
