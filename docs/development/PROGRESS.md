# RemnaRay Development Progress

## Current milestone

M4

## Current task

M4 acceptance reconciliation. TASK-M4-001, TASK-M4-002 and TASK-M4-003
reconciliation are complete and committed. Next: repair the CI quality gates,
then TASK-M4-004. Do not start M5.

## Current handoff correction

- Committed implementation: `c56c5fc` (M4-001), `a52a91e` (M4-002),
  `e1cd614` (M4-003). These are implementation checkpoints, not verified
  milestone acceptance. Preserve their history; fix gaps in follow-up commits.
- M4-001 gaps are now closed (see "M4-001 reconciliation" below).
- M4-002 gaps are now closed (see "M4-002 reconciliation" below).
- M4-003 gaps are now closed except the Lighthouse ≥ 90/90/95 measurement,
  which needs the reference server and stays an external gate.
- M4-004 partial UI is saved on disk, uncommitted, and will be rewritten:
  it expects API response shapes that do not exist, prints raw minor units, and
  has no 15-second cache, payment deadline or page-state tests.
- OpenAPI is maintained by hand (`apps/api/openapi.json`, 3.0.3). Section 9.1
  requires a 3.1 document generated from Zod contracts; the generator is planned
  with the `packages/domain/contracts` work in TASK-M4-004.

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

Hosted GitHub Actions execution, maintainer review, provider credential
healthchecks, and the later proxy-smoke/full e2e gates remain external gates.
No credentials or external infrastructure were required for TASK-M4-001.

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

TASK-M4-004 — customer account pages, payment status, Telegram auth flow, and
loading/empty/error states. M4-003 is complete; M5 remains unopened.

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
- Known gap moved to TASK-M4-009: `POST /api/admin/v1/settings/import` still
  answers `{ diff: [] }` for `dryRun`, and `PUT /settings` always answers
  `restartRequired: []` instead of the section 17.6 matrix.

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

## M4-003 decisions

- The current Next.js 16 `proxy.ts` convention is used for next-intl locale
  negotiation; it replaces the deprecated `middleware.ts` filename while
  preserving the specification’s middleware behavior.
- Flat catalog files are expanded into nested runtime messages only at the
  web request boundary, preserving the specification’s dotted-key data format.
