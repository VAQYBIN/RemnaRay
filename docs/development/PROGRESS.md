# RemnaRay Development Progress

## TASK-M5-004 remediation — 2026-09-22 (current authority)

Current milestone: M5, NOT VERIFIED. Current and sole task: TASK-M5-004.
The previous local-verification claim is withdrawn following five confirmed VPS
defects. No other TASK or milestone may start in this session.

- Defect 1 repaired in `3da1ff6`: the Compose renewal-loop entrypoint swallowed certonly.
  `tls:issue` now overrides it with Certbot and supplies webroot, domain, email,
  named lineage and keep-until-expiring. Renewal remains a separate loop.
  Regression: `node --test test/rr.test.mjs` — 2/2 pass, including failure
  propagation and missing-email rejection. Repair commit: this commit
  (`fix(deploy): route initial TLS issuance directly to Certbot`).
- Defect 2 repaired in `17d2ac9`: `proxy-config` and
  `proxy-reloader` no longer mount Certbot's private-key volume. Certbot and
  nginx retain the only certificate mounts; a separate `.issued` marker volume
  drives bootstrap/full rendering. Marker and permission-boundary regression
  coverage passes.
- Defect 3 repaired in `17d2ac9`: the worker no longer
  checks `RR_WORKER_ENABLED` or reads `RR_VALKEY_HOST`/`RR_VALKEY_PORT`; it
  pings and reuses the documented `VALKEY_URL`, and the outbox relay is always
  scheduled. Worker tests: 3 files, 5 tests passed.
- Defect 4 repaired in `17d2ac9`: `up` removes only stale
  opposite-profile containers selected by the RemnaRay Compose project/service
  labels; `down` enables nginx, caddy, external and certbot together without
  removing named volumes. Lifecycle regression coverage passes.
- Defect 5 repaired in `17d2ac9` and `b41e20b`: `up` uses Compose
  `--wait --wait-timeout 300`, a profile generation marker healthcheck and
  timeout diagnostics; Certbot state sync is followed by another bounded wait.
  No arbitrary sleep was added. Readiness regression coverage passes with the
  wrapper simulation.
- Environment blocker reproduced: `/usr/bin/docker compose version` crashes
  with Bus error; Engine `_ping` over `/var/run/docker.sock` times out at 5 s.
  Container checks and real-domain acceptance are NOT VERIFIED.
- Current repair verification: wrapper regression 4/4, proxy renderer 22/22,
  worker tests 5/5, root tests 38/38, workspace tests passed, workspace
  typechecks passed, `pnpm build`, `pnpm lint`, `pnpm format`, shell syntax and
  `git diff --check` passed. `pnpm test:m5` reached all three M5 integration
  tests but all Docker-backed tests failed before container startup because the
  WSL Docker integration reports `docker could not be found`; direct Compose
  config and nginx/Caddy image-build attempts fail with the same host error.
  Those gates are blocked, not skipped. The exact VPS procedure is in
  `docs/tls.md`; it remains an external acceptance gate and has not been
  executed here. `pnpm typecheck:e2e`, `pnpm i18n-check` (1482 messages), both
  theme validations and the final clean-tree/diff audit also pass. Overall
  TASK-M5-004 remains **NOT VERIFIED** until Docker-backed local acceptance is
  rerun and the real-domain procedure is executed.

## Reconciliation — 2026-09-21

This is the current handoff state. Older entries below preserve the evidence
and decisions made during the previous agent's work; this section supersedes
their earlier "next task" and release statements.

### Current milestone and task

M5 — in progress; the milestone is **NOT VERIFIED**. Do not proceed to M6.
The immediate task is release and acceptance closure after repairing the
Remnawave v3.4.4 compatibility boundary.

### Verified state

- TASK-M5-003, TASK-M5-006, TASK-M5-007, TASK-M5-008 and TASK-M5-009 are
  verified by the evidence recorded below. TASK-M5-002 is locally verified,
  including the measured image-size gate in its later reconciliation entry.
- TASK-M5-004 is locally verified only. Its required real-domain ACME and
  Certbot checklist remains open; the checklist is in `docs/tls.md`.
- TASK-M5-001 and TASK-M5-005 have implementation and unit coverage. Fresh
  Playwright verification depends on the host Chromium library and is not
  claimed here as a current result.
- The panel contract repair is implemented in this handoff but is not yet
  accepted against the VPS. The SDK now uses numeric Remnawave `id`, the
  documented Telegram stream endpoint, numeric action/HWID routes, and the
  required revoke body, nested `userTraffic`, and UUID-string squad payloads.
  Migration `0005_panel_user_id` stores the mapping; `vlessUuid` remains the
  subscription snapshot. The live panel is v3.4.4.
- Setup step 3 now accepts an optional owner-provided panel webhook secret.
  The check preview and saved `panel.webhook_secret` use that exact value;
  leaving it blank keeps the existing generated-secret behavior. Both locale
  strings, schema tests and setup documentation are updated.

### CI, images and release

- Subsequent VPS evidence: all five `ghcr.io/vaqybin/<image>:dev` manifests
  resolve with `linux/amd64` images. GitHub images run
  [35562770867](https://github.com/VAQYBIN/RemnaRay/actions/runs/35562770867)
  succeeded for `6cfbc770c8badb33478d16ba503a39f4397b5c1e`, including all five
  images and the summary job. This supersedes the zero-runs observation below;
  arm64 and tagged-release acceptance remain unverified.
- New VPS deployment blocker: `docker compose --profile nginx up -d` resolves
  `ghcr.io/remnaray/*:dev` despite the reported `.env` containing
  `RR_REGISTRY=ghcr.io/vaqybin`. Classified as deployment/configuration;
  precise cause is pending effective-environment and Compose-file diagnostics.
  Current repository expressions support `RR_REGISTRY`; per-image overrides
  take precedence. Do not infer an authentication failure for the published
  `vaqybin` images from a denial for the different `remnaray` namespace.
- `pnpm install --frozen-lockfile` passed in this checkout.
- GitHub run `35535283089` for commit `c28ec08` passed quality, E2E,
  Lighthouse, proxy, all five Docker matrix builds and both proxy-smoke jobs.
  The default `main` branch also has a successful CI run.
- `.github/workflows/images.yml` is manual (`workflow_dispatch`) and has zero
  runs. `.github/workflows/ci.yml` builds with `push: false`; it never publishes
  images. No release tag exists and there are no published image runs to
  inspect. This is an operational/manual release blocker, not evidence of a
  failed Docker build. The workflow's triggers, permissions, GHCR login,
  Buildx, matrix, tags and cache are present and actionlint was previously
  reported clean. Do not claim GHCR publication until an authorized workflow
  run or release tag proves it.
- Local app-image reproduction on this host terminated inside Docker with
  `fatal error: unexpected signal during runtime execution` / `Bus error`
  while installing the 970-package workspace. CI successfully built the same
  preceding app and web image revisions; the host failure is an environment
  blocker. After the crash, even `docker compose version` returned `Bus error`;
  proxy and backup images still require a fresh local build after Docker
  Desktop is repaired, and the repaired app image still needs a CI run.

### Current verification run

`pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm -r typecheck`,
`pnpm lint`, `pnpm format`, `pnpm test` (34), `pnpm --filter
@remnaray/api test` (155), `pnpm --filter @remnaray/db test` (3),
`pnpm turbo run test --force` (30 tasks), `pnpm build`,
`pnpm typecheck:e2e`, `pnpm i18n-check`, both theme checks, Prisma validation,
the SDK/mock tests, and `git diff --check` passed after the repair. The Docker
Compose validation command was attempted but could not run because Docker
Desktop itself returned the bus error above.

### Manual acceptance

- The previous VPS run reached setup step 3 and verified the squad page shape,
  Tailwind source coverage, queue delivery, proxy profiles, monitoring and
  backup behavior as recorded below.
- The previous VPS could not complete a purchase against the panel because the
  SDK sent UUIDs to a v3.4.4 panel that requires numeric IDs. The repair is now
  ready for VPS acceptance, but the purchase, HWID, revoke and webhook paths
  still need to be exercised against that panel.
- The updated setup wizard itself still needs a browser check at
  `https://<domain>/setup`: enter the existing panel secret, confirm the
  generated `WEBHOOK_SECRET_HEADER` line matches it, finish setup, and verify
  a signed panel webhook is accepted.
- Remaining blockers are classified as: **implementation** — run live panel
  compatibility acceptance; **release** — run and inspect the manual images
  workflow or a tagged release; **environment/VPS** — public-domain TLS
  checklist and this host's Docker bus error; **manual validation** — M6
  acceptance and provider checks remain out of scope for this handoff.

### Exact next action

First obtain the VPS's filtered `docker compose config --environment`,
`config --images`, and image expressions in its Compose files, following
the registry troubleshooting instructions. Correct the selected image
namespace and verify it before retrying startup.

After image selection is corrected, verify migration `0005_panel_user_id`
and service health on the VPS, then exercise a purchase and panel user actions
against v3.4.4. Run the real-domain checklist in `docs/tls.md` and record its
output. The successful development-image publication does not close the
tagged-release acceptance gate.

## Historical progress

## First-panel findings — 2026-09-20

The owner reached step 3 of the setup wizard against a real Remnawave panel.
Four defects, two of them one root cause.

- **`squads.map is not a function`.** `GET /api/internal-squads` answers with a
  page — `{response:{total,internalSquads:[…]}}` — and the client read what was
  left after unwrapping the envelope as the list itself. `packages/remnawave-mock`
  answered `{response:[…]}`, imitating the client rather than the panel, so
  nothing could catch it. The same page shape applies to
  `GET /api/hwid/devices/{id}`; `DELETE /api/users/{id}` answers 204 with no
  body, which the client parsed unconditionally. All three are fixed, the mock
  now answers what the panel answers, and a non-JSON error body — an HTML page
  from a proxy in front of the panel — now reaches the caller as its message.
  Re-verified against the official v3.4.4 document, which has not drifted: same
  SHA-256, 162 paths. `docs/adr/ADR-010.md` carries the correction.
- **Cramped buttons, invisible errors and a "Далее" that wanted two clicks.**
  One cause: Tailwind's automatic source detection skips `node_modules`, and
  that is the only path from `apps/web` to `@remnaray/ui`. The stylesheet
  carried just the classes the application itself used — 16 KB where there
  should be 27 KB. Every class the kit alone owned was absent: `px-4 py-2` from
  every button, `disabled:opacity-50` (so a disabled button looked exactly like
  an enabled one, which is the two-click impression), and `fixed`, `z-100`,
  `max-w-sm` from the toast viewport, so errors were reported to a toast that
  was never on the screen. `@source '../../../packages/ui/src'` in
  `app/globals.css` fixes all of it; measured before and after in
  `.next/static/chunks/*.css`.

A fourth defect surfaced when the owner rebuilt the images with these fixes:
`docker build` of the app failed with TS1484 on a type-only import in the new
SDK test. Three packages — `db`, `remnawave-sdk` and `remnawave-mock` —
compiled their tests into `dist` where the other ten excluded them, so test
code shipped in the application image and the image build was the only gate
that type-checked it. All three now exclude tests, and
`test/tooling.test.mjs` holds every package build config to the rule. The
applications still compile their own tests into `dist` — they build from
`tsconfig.json` directly, so separating that needs a build config per app; it
is recorded here with the M5-002 image-size item rather than changed in the
same breath.

A fifth: the owner's server is 1 vCPU / 2 GB, and `./scripts/rr build` spent
more than twelve minutes inside the Next.js build before being abandoned.
Building on the target is not a route the smallest supported server can take,
and until a release exists there was no other. `.github/workflows/images.yml`
publishes the five images from Actions under a chosen tag without making a
release, and `RR_REGISTRY` — defaulting to `ghcr.io/remnaray`, which is what
compose always resolved — points a deployment at any namespace. Found while
writing it: GHCR refuses an uppercase namespace and `github.repository_owner`
carries the account's own spelling, so `release.yml` and `rebuild.yml` would
have pushed to a name they could not create for any owner whose login is not
all lowercase. `docker/metadata-action` lowercases; a raw `tags:` string does
not. Every workflow lowercases it now.

A sixth, the same class as the first: `pnpm lint` and `pnpm typecheck` read
generated types that a developer's checkout has and a runner's does not.
`apps/web/i18n/request.ts` calls `rootLocale()` from `next/root-params`, whose
declarations Next writes into `.next/types`; CI lints before it builds, so the
call resolved to `any`. `next typegen` produces them in two seconds without a
build and now runs in the root `postinstall` beside `prisma generate`.

That is twice a green working tree disagreed with CI for the same reason, so
`scripts/ci-local.sh` now runs the quality gate from the state a runner starts
in: it deletes `node_modules`, every `dist`, every `.turbo`, `apps/web/.next`
and the generated Prisma client, installs, and runs lint, format, both
typechecks, both test sets, the locale and theme checks and the build. It
passes on this tree; `CONTRIBUTING.md` points at it.

A seventh, and the same shape again: `@remnaray/queues` imports
`@remnaray/db`, whose `exports` point at `dist`, and turbo's `test` task
depended on `^test` — which builds nothing. CI ran `pnpm -r test` before the
build step, so the suite could not resolve the import and failed to load. The
task depends on `^build` now and the workspace tests run through turbo
everywhere.

`scripts/ci-local.sh` did reproduce this on its first run and it was reported
as passing anyway. The script was not at fault: `set -eu` in a real script
aborts correctly. The verification was a hand-written paraphrase of it typed
into a shell, where `set -e` inside a `{ … }` group did nothing, and the log
was then checked with a grep that did not match the failure. The script is the
thing to run; a retyped copy of it is not. Run for real on this tree it exits
0, with 263 workspace tests across 17 packages and 33 repository tests.

**Still open, and now the largest item in the project.** ADR-010 recorded on
2026-09-19 that the panel identifies users by a numeric `id` and carries no
`uuid`, that `/api/users/by-telegram-id/{telegramId}` does not exist, and that
every action route and the HWID body take that numeric id. It asked TASK-M2-001
to introduce the mapping. M2-001 was scoped to payments and did not. The
section 10.1 client is UUID-based throughout, so every user operation beyond
`users.create` and `users.getByUsername` will fail against a live v3.4.4 panel:
a purchase cannot provision. This needs its own task — it changes the
identifier the subscription rows persist, so it carries a migration.

## First-server findings — 2026-09-20

The owner took the repository to a VPS to run the TASK-M5-004 checklist and
could not start it. Three defects stood between a clone and a running
deployment; none of them is in M5's artifact lists, and all three are fixed.

- **A fresh checkout does not lint.** `@remnaray/db` exports its types from
  `src/generated/prisma`, which `prisma generate` writes and `.gitignore`
  excludes. Without it every type-aware rule that touches a Prisma call sees
  `any`, and the first CI run of the `dev` branch failed with **3173 errors**
  — `no-unsafe-member-access` on `.outboxJob`, `$queryRaw`, `$transaction` and
  the rest. `app.Dockerfile` already ran the generate step, so only the
  workflows and a developer's own clone were exposed. A root `postinstall`
  now generates the client on every install; reproduced by moving
  `packages/db/src/generated` aside, confirmed fixed by deleting all 22
  `node_modules` trees and reinstalling, and the `web` image still builds.
- **A release would publish images nobody pulls.** `release.yml` and
  `rebuild.yml` pushed `ghcr.io/<owner>/remnaray-<image>`; `compose.yaml`
  pulls `ghcr.io/remnaray/<image>` (section 7.1). Neither workflow built the
  `backup` image at all, though every profile starts it. Both now publish the
  five images under the names compose resolves to.
- **A source checkout has nothing to start.** `compose.yaml` carries no build
  contexts by design, so with no published release `./scripts/rr up` stops at
  `error from registry: denied` — which is what the owner hit.
  `./scripts/rr build` now builds `app`, `web`, `backup` and the proxy of the
  active profile under exactly the tags compose resolves to, so `up` pulls
  nothing afterwards. `docs/install.md` gained "Running from a source
  checkout" and `docs/troubleshooting.md` the symptom.

- **A clone cannot run the documented commands.** This repository carries
  `core.fileMode=false`, so the executable bit of every shipped script stayed
  out of the index: `./scripts/rr up` answers `Permission denied` on a fresh
  clone, CI's `proxy-smoke` step could not have launched its own script, and
  the crontab the `backup` image installs executes
  `/scripts/backup-entrypoint.sh` by path from a read-only mount that would
  have been mode 644. Six scripts are now `100755` in the index.
- **Neither backup wrapper ran.** `./scripts/rr backup` passed
  `/scripts/backup-entrypoint.sh once` to an image whose entrypoint is that
  script, so it arrived as the subcommand and the script printed its usage and
  exited 1 — confirmed against the built image. `./scripts/rr restore` ran
  `restore.sh` inside the `backup` container, and that script drives
  `docker compose` (it stops the stack, brings PostgreSQL up alone, restores,
  starts everything) so it has to run on the host. `backup` now passes `once`;
  `restore` calls the host script with `COMPOSE_FILE` and `RR_PROXY_PROFILE`.
  The section 26.4 item R drill was never runnable through the wrapper.

`test/tooling.test.mjs` covers all of it: the wrapper's tags are compared
against `compose.yaml` image by image, the workflows' names against the same,
and the `postinstall` against `@remnaray/db`'s generated export; the six
script modes are read out of the git index, because the working tree hides the
problem on this machine. The naming test and the mode test were each confirmed
to fail against the state they fix.

Note for whoever runs the M5-004 checklist: the branch under test is `dev`.
`main` is still at M0, where `compose.yaml` pins `:local` tags that exist
nowhere — a clone of the default branch cannot start.

## M5-009 verification — 2026-09-20

Verified on 2026-09-20. The acceptance is that the links in the README resolve
and that `release.yml` publishes images for a tag like `v0.9.0-rc.1`.

- `README.md` (English) and `README.ru.md` (Russian) carry the section 24.1
  sections — badges, what it is, quick start, requirements, the proxy profile
  table, the payment provider table, customisation without a fork, upgrading,
  the comparison with `remnawave-tg-shop`, the section 7.1 architecture
  diagram, contributing and the licence — and link to each other.
- `LICENSE` (MIT), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor
  Covenant 2.1), `SECURITY.md`, `CHANGELOG.md`, `Makefile`, the three issue
  templates, `PULL_REQUEST_TEMPLATE.md` and `CODEOWNERS`.
- New pages: `docs/install.md`, `docs/upgrade.md`, `docs/api.md`,
  `docs/troubleshooting.md` (by symptom, as section 24.3 asks) and
  `docs/faq.md`.
- `.github/workflows/release.yml`, `rebuild.yml` and `nightly.yml`.

### M5-009 verification evidence

- `test/docs.test.mjs` walks every Markdown file the delivery ships and
  resolves every relative link: **0 broken**. It also asserts the section 24.2
  file set, a page per section 24.3 topic, the section 24.1 README sections and
  badges in both languages, and the release workflow's own shape.
- `actionlint` on all four workflows: clean.
- The tag behaviour is asserted statically, because a tag may not be pushed
  from here: `release.yml` triggers on `v*`, builds `app`, `web`, `nginx` and
  `caddy` for `linux/amd64` and `linux/arm64`, pushes with an SBOM and a
  provenance attestation, and tags `X.Y.Z` always while `X.Y` and `X` are
  enabled only when the version carries no pre-release suffix. `v0.9.0-rc.1`
  therefore publishes `0.9.0-rc.1` and `rc`, and does not move the tag an owner
  on `RR_VERSION=1` follows.
- `pnpm test` (27), `pnpm -r test` (api 155 and the rest), `pnpm lint`,
  `pnpm format`, `pnpm typecheck`, `pnpm -r typecheck`, full `pnpm build`, the
  `nginx`, `caddy` and `monitoring` compose profiles, and
  `deploy/ci/proxy-smoke.sh nginx` end to end.

### M5-009 decisions

- `compose.yaml` now resolves its images through `${RR_VERSION:-1}`, which
  section 24.4 requires and the delivery did not do: an owner who runs
  `docker compose pull` follows the major line instead of a `:local` tag that
  no registry serves. `RR_APP_IMAGE` and its siblings still override, which is
  what the smoke stand uses.
- `./scripts/rr` gained `backup`, `restore` and `theme:validate`, which section
  23.1 lists and section 26.4 R1–R3 uses, and a `help` that exits zero so the
  `Makefile` can alias it.
- The `rebuild.yml` of section 24.6 publishes the dated tag and moves `X.Y` and
  `X` only after trivy passes on the rebuilt image. A rebuild that made things
  worse must not become what `RR_VERSION=1` resolves to.
- `nightly.yml` runs `zap-baseline` against the section 22.7 smoke stand rather
  than a stack of its own: the stand is already a real deployment behind a real
  proxy, which is what a baseline scan should see.

### M5-009 gaps, recorded not closed

- **No screenshots.** Section 24.1 asks for the landing, the bot and the
  console. There are no image files in the repository and a README that linked
  to missing ones would fail its own acceptance, so the section is absent
  rather than broken. It needs a running deployment to produce.
- **Module READMEs**: section 23.3 wants one per `apps/api` module; 7 of 18
  have one. Not in this task's artifact list, so not written here.
- **ADRs**: `docs/adr/` holds ADR-010 alone, though the specification cites
  ADR-005, ADR-006 and ADR-014 among others. Also outside this task's list.

## Queue delivery repair — 2026-09-20

The defect recorded under "M5-008 finding" is fixed, and it turned out to be
two, either of which alone stopped every queued job:

1. **BullMQ refuses a custom job id containing a colon** — its own key
   separator — and refuses one that is all digits. Every identifier the
   application builds carried a colon: `evt:<id>`, `panel:<userId>`,
   `alert:payment.late:<id>`, `notify:<dedupKey>`, `maintenance:tls-check:<s>`
   and twenty more. `packages/queues` now exports `toJobId`, which translates
   the separator at the boundary with BullMQ and prefixes an all-digit id. The
   readable form stays in `outbox_jobs.job_id`, and the mapping is one-to-one,
   so deduplication is unchanged.
2. **The relay published under `rr:q` and the workers waited on `bull`.** They
   shared a queue name and nothing else: jobs were enqueued, nothing consumed
   them, and neither side reported anything. `QUEUE_PREFIX` is now one exported
   value that both use.

Verified on a stand and in the suite:

- Before: `docker logs worker` carried "Custom Id cannot contain :" every two
  seconds, `outbox_jobs` had five unpublished rows, and `rr:q:notify:wait`
  held jobs nothing was reading.
- After: zero such errors, all five outbox rows published, and the queues
  report `notify` 2 completed, `maintenance` 2 completed, `payments` 1
  completed. The `panel` failure that remains is `PANEL_UNAVAILABLE` against
  the stand's `https://panel.invalid`, which is the correct answer there.
- `test/m1.integration.test.mjs` now runs a real job through: the outbox writes
  `notify:sub.activated:<uuid>`, the relay publishes it, and a BullMQ worker
  on the shared prefix receives it as `notify-sub.activated-<uuid>`. Both
  defects fail this test.
- `pnpm test:m1` (1), `pnpm test:m2` (1), `pnpm test:m4` (4), `pnpm test:m5`
  (3), `pnpm test:e2e` (26), `pnpm test` (21), `pnpm -r test`, `pnpm lint`,
  `pnpm format`, `pnpm typecheck`, `pnpm -r typecheck` and `pnpm build`.

### Open: an intermittent test failure

`setup.service.test.ts > accepts the environment token once` failed twice
across six full `pnpm -r test` sweeps and never in isolation, under
`--no-isolate`, or on any re-run. The test performs an argon2 hash and an
argon2 verify, which is the slowest thing in the suite, so contention is the
obvious suspect — but that was not established, and nothing was changed on a
guess. Recorded here for whoever picks it up.

## M5-008 verification — 2026-09-20

Verified on 2026-09-20. All twelve section 9.9 metrics are present in
`/metrics` on a running deployment, which is the acceptance of the task.

- `packages/metrics` declares the twelve metrics in one registry, with the
  Node.js defaults beside them. Every process registers all of them, not only
  the ones it writes: a metric with no observations costs two lines of text,
  and a dashboard should find its series whichever target answered.
- `/metrics` is served by `api` (through the proxy, and only from the compose
  network — the proxy denies the rest and `api` checks the address again, which
  is the second check section 19.7 asks for), by `worker` on `:3003` and by
  `bot` on `:3002`. Neither of those ports is published.
- The setup gate lets `/metrics` through: a deployment being set up is exactly
  when an operator wants to watch it, and the address check already applies.
- Written where the thing happens: an interceptor for the HTTP counters,
  labelled with the route template Fastify matched rather than the path;
  `packages/remnawave-sdk` for the panel, once per operation rather than per
  retry; the payments repository for events, invoices and the one entry that
  moves money into `revenue`; `NotifyService` for every attempt, sent or
  skipped; the bot ingress for each update taken off the stream; the worker for
  queue depth, sampled every fifteen seconds; the TLS reading on both the
  worker that made the handshake and the API that Prometheus scrapes; and the
  ledger audit for a disagreement it found.
- nginx serves `stub_status` on `127.0.0.1:8081` inside its container (section
  20.2) for an exporter an owner may add. Caddy already answered Prometheus on
  its admin port.
- `deploy/monitoring/` is included by `compose.yaml` and starts nothing without
  `--profile monitoring`. Neither Prometheus nor Grafana publishes a port.
  Grafana is provisioned with the datasource and `remnaray.json`, and its
  bundled plugin download is turned off — a deployment that can reach a panel
  and nothing else has to come up anyway.

### M5-008 verification evidence

- On a running nginx stand: `GET /metrics` through the proxy from inside the
  compose network returned 200 with **12** `# TYPE rr_*` lines — every name of
  section 9.9 — and from outside 403, for both methods. `bot:3002/metrics` and
  `worker:3003/metrics` each carried the same twelve.
- Live series were observed, not only declarations:
  `rr_http_requests_total{route="/api/v1/public/i18n/:lang/:namespace"}`,
  `rr_http_requests_total{route="/webhooks/:provider",status="400"}` and, with
  the worker enabled, `rr_queue_jobs` for all five queues in five states.
- `docker compose --profile nginx --profile monitoring up -d`: Prometheus
  reported `api`, `bot`, `worker` and itself `up`; Grafana answered
  `/api/health` with `database: ok` and listed the provisioned dashboard
  `remnaray` and the datasource `remnaray-prometheus`. The `caddy` target reads
  `down` under the nginx profile, which is the intended reading.
- `deploy/ci/proxy-smoke.sh nginx` and `deploy/ci/proxy-smoke.sh caddy` both
  passed all ten checks with the new `inside GET /metrics 200` row.
- `pnpm test` (21), `pnpm -r test` (api 155, metrics 5, and the rest),
  `pnpm test:m1` (1), `pnpm test:m2` (1), `pnpm test:m4` (4), `pnpm test:m5`
  (3), `pnpm test:e2e` (26), `pnpm lint`, `pnpm format`, `pnpm typecheck`,
  `pnpm -r typecheck`, `pnpm typecheck:e2e` and full `pnpm build`.
- `pnpm lighthouse` was not repeated: `apps/web` is untouched by this task, and
  it passed after the last change to it (landing RU 100/96/100).

### M5-008 finding — the queues never enqueue anything

Running the worker against the stand surfaced a defect that predates this task
and is **not** repaired in it:

```
Error: Custom Id cannot contain :
  at Job.validateOptions (bullmq/dist/cjs/classes/job.js:912)
  at .../@remnaray/queues/dist/index.js:42
```

BullMQ 6 refuses a `jobId` containing a colon, and every identifier the
application builds uses one — `evt:<id>`, `panel:<userId>`,
`alert:payment.late:<id>`, `notify:<dedupKey>`, `maintenance:tls-check:<stamp>`
and the rest, 23 sites in all. Nothing reaches a queue: no panel sync, no
notification, no broadcast chunk, no maintenance job. It is invisible to the
current tests because `RR_WORKER_ENABLED` is not set in any of them, and the
outbox relay logs the rejection and carries on.

This is the next thing to repair, before TASK-M5-009.

### M5-008 observation

`setup.service.test.ts > accepts the environment token once` failed once under
a full parallel `pnpm -r test`. See "Open: an intermittent test failure" above,
which records what is known after further attempts.

## M5-007 verification — 2026-09-20

Verified on 2026-09-20. `deploy/ci/proxy-smoke.sh` passed all ten checks of
section 22.7 against **both** profiles on a real Compose stand.

- `deploy/ci/proxy-smoke.sh <nginx|caddy>` builds the stand from `compose.yaml`
  plus `deploy/ci/compose.smoke.yaml`, seeds the section 22.3 fixture, and runs
  the ten checks. `deploy/ci/expected-status.tsv` holds the section 21.5 path
  table, read by both profiles, so a divergence is a failed row rather than two
  scripts that disagree. `deploy/ci/gen-selfsigned.sh` issues the `custom`-mode
  certificate for the stand and for the domain step 9 adds.
- The stand adds a second network, `rr_edge`. Without it there is no vantage
  outside `RR_TRUSTED_PROXIES`: a request from the host is translated to the
  compose gateway, which is inside the allowed range, so the `/metrics → 403`
  of step 4 would have passed without proving anything.
- `apps/api/src/tools/seed-dev.ts` writes the section 22.3 fixture into a
  running deployment and prints what it seeded, which is how the stand gets an
  administrator to log in as. It refuses to seed over a finished installation.
- `POST /api/internal/v1/echo-headers` answers step 5. It exists only when
  `RR_ECHO_HEADERS=true`, which the stand sets and a deployment never does.
- CI gained a `proxy-smoke` matrix over both profiles, and the `docker` job now
  builds the `caddy` and `backup` images too, with a shared Buildx cache the
  smoke job loads from.
- Step 10 runs the browser path of E2E-01 — the landing, the account, a
  purchase through the mock provider and the administration sign-in — against
  the stand. AC-171 stays on the harness, which is the only place a shop whose
  wizard has not run exists, and the administration console suite stays there
  too: it drives `/api/admin` far faster than a person and would measure the
  30r/m limit of section 19.4 rather than anything about the proxy.

### What the smoke found

Every one of these stopped the stand or broke the section 21.5 invariant, and
none of them could be seen without running the deployment end to end.

| Defect                                                                                                                                                                   | Fix                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres:18` refuses to start with a volume at `/var/lib/postgresql/data`                                                                                               | mount `pgdata:/var/lib/postgresql`, the path the image declares                                                                                                                                                                                               |
| `web` bound to the container id, so its health check never passed                                                                                                        | `ENV HOSTNAME=0.0.0.0` in `deploy/docker/web.Dockerfile`                                                                                                                                                                                                      |
| `proxy-config` could not write `proxy-conf`: Docker seeds a shared named volume from whichever image _creates_ its container first, and that is not the dependency order | `/proxy-conf` and `/uploads` are created in the app image owned by `node`, and both proxy images hand `/etc/nginx/conf.d` and `/etc/caddy` the same owner; their stock `default.conf` and `Caddyfile` are removed so a seeded volume cannot smuggle a site in |
| the proxy's fixed `172.28.0.10` is inside the automatic address pool, so the tenth service took it and the proxy could not start                                         | `ip_range` reserves it                                                                                                                                                                                                                                        |
| `proxy-config` started before `migrate` and crash-looped on a missing `settings` table                                                                                   | it now waits for `migrate`, like every other reader                                                                                                                                                                                                           |
| `proxy-reloader` could not reach the docker socket, so no reload ever happened                                                                                           | it runs as root; the socket is owned by a group whose id differs per host, and a container that may drive the Docker API is already as privileged as the host                                                                                                 |
| a webhook body naming no event reached Prisma with a null `type` and answered **500**                                                                                    | the service refuses an event with no type or invoice, and the mock provider returns `null` for such a payload (section 9.7)                                                                                                                                   |
| nginx answered a non-POST webhook with 403 (`limit_except`), Caddy with 405                                                                                              | nginx returns 405                                                                                                                                                                                                                                             |
| nginx queued the `/admin` burst instead of refusing it, so the console stalled for seconds a page while Caddy refused outright                                           | `nodelay`, like every other zone                                                                                                                                                                                                                              |
| Caddy's zones carried the nginx _rate_ without its _burst_, so a sign-in the nginx profile served was refused                                                            | the events are `rate × window + burst`                                                                                                                                                                                                                        |
| Caddy's `respond @matcher` is ordered after `handle`, so the catch-all answered first: a non-POST webhook became 307 and `/metrics` from outside became 404              | each refusal is a `handle`                                                                                                                                                                                                                                    |
| Caddy had no `/healthz` on `:80` and redirected with 308                                                                                                                 | an explicit `http://` site with the health check and a 301, and `auto_https disable_redirects`                                                                                                                                                                |
| `email` with an empty value made Caddy refuse the whole file in `custom` mode                                                                                            | the directive is emitted only when there is an address                                                                                                                                                                                                        |
| the Caddy redirect site had no TLS source and ran its `redir` onto the `tls` line                                                                                        | it takes the same certificate source, one directive per line                                                                                                                                                                                                  |

### M5-007 decisions

- Section 19.3's CSP was not implemented anywhere; step 3 of 22.7 checks for
  it, so `apps/web/lib/csp.ts` now builds exactly the policy the specification
  writes out and `apps/web/proxy.ts` sets it with a per-response nonce.
- That nonce forced a rendering change. Next.js stamps the nonce onto the
  inline scripts it emits only while it renders, so a prerendered page carries
  inline scripts the next request's nonce does not cover and the browser
  refuses them — the site rendered but never hydrated. The localized routes and
  the administration console are now `force-dynamic`. The data stays cached:
  `revalidate` on the API fetches is what section 13.2 relies on and what keeps
  the landing up when the API cannot answer, which is what 26.4 E5 checks.
  `pnpm lighthouse` after the change: landing RU 100/96/100, landing EN
  100/96/100, account accessibility 96 — all above the 13.2 thresholds.
- The specs no longer name the harness's own rows. `StackState` carries the
  brand, the plan's name and the user's username, and the stand supplies the
  same fields, so one suite reads two differently seeded shops.
- Step 9 and step 10 both sign an administrator in, and a TOTP code may be
  redeemed once per 30-second period. Both now record the period they spent in
  `e2e/.auth/totp-period`, so neither presents a code the other used.
- The stand refuses to start when a `.env` is already present, because it
  writes its own, and removes both when it finishes.

### M5-007 verification

- `deploy/ci/proxy-smoke.sh nginx` and `deploy/ci/proxy-smoke.sh caddy`: all
  ten checks passed on both, including the 15 browser tests of step 10. Run on
  a resolvable local domain, since the stand's domain has to be in the host's
  resolver for Playwright's request context; CI adds the line to `/etc/hosts`.
- `pnpm test:m5` (3), `pnpm test:m2` (1), `pnpm test:m1` (1), `pnpm test:m4`
  (4), `pnpm test` (16), `pnpm test:e2e` (26), `pnpm lighthouse`, `pnpm lint`,
  `pnpm format`, `pnpm typecheck`, `pnpm -r typecheck`, `pnpm typecheck:e2e`,
  `pnpm -r test` (api 151, web 24, bot 12, worker 4, and the rest), full
  `pnpm build`, `pnpm i18n-check`, both theme validations, and
  `docker compose config` for the `nginx`, `caddy`, `external`, `certbot` and
  smoke-overlay profiles.

### M5-007 image-size doubt — resolved on 2026-09-21

A reading of about 878 MB was recorded here against the M5-002 closure's
187,223,208 bytes, and the measurement was asked to be repeated. It was: a
clean `docker build -f deploy/docker/app.Dockerfile` gives
`docker image inspect --format '{{.Size}}'` = **188,499,066 bytes**, which is
the M5-002 figure plus everything added since. The 878 MB came from the
`DISK USAGE` column of `docker image ls`, which counts the uncompressed layers
as they sit in the store, not the image: the same row shows
`CONTENT SIZE 187MB`. The doubt is withdrawn and the section 26.1 budget of
250 MB holds.

## Latest blocker closure audit — 2026-09-20

| Task        | Status                            | Evidence                                                                                                                                                                                                                                        |
| ----------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-M5-001 | **VERIFIED locally**              | `LD_LIBRARY_PATH=... pnpm test:e2e`: 26/26 Playwright tests passed, including AC-171 setup steps and the post-completion `/setup` 404.                                                                                                          |
| TASK-M5-002 | **VERIFIED locally**              | `pnpm test:m5` passed nginx, Caddy and AC-202 checks. App image `remnaray/app:m5-verify` measured `187,223,208` bytes and web image `remnaray/web:m5-verify` `80,296,758` bytes (`docker image inspect`), under 250 MB and 300 MB respectively. |
| TASK-M5-003 | **VERIFIED**                      | `pnpm test:m5`: Caddy validation passed for supported modes.                                                                                                                                                                                    |
| TASK-M5-004 | **LOCAL VERIFIED; EXTERNAL OPEN** | Local TLS mode rendering, certificate-backed nginx validation, Compose profiles and config validation passed. The required real-domain ACME and certbot issuance/renewal checklist has no public DNS/server in this environment.                |
| TASK-M5-005 | **VERIFIED locally**              | API trusted-proxy suite passed (142 tests); the 26-test browser gate also passed.                                                                                                                                                               |
| TASK-M5-006 | **VERIFIED**                      | `pnpm test:m5`: real PostgreSQL 18 AC-202 dump, restore and 14/8 retention passed.                                                                                                                                                              |
| TASK-M5-007 | **VERIFIED** (2026-09-20)         | `deploy/ci/proxy-smoke.sh` green on both profiles; see "M5-007 verification".                                                                                                                                                                   |
| TASK-M5-008 | **VERIFIED** (2026-09-20)         | All twelve section 9.9 metrics present in `/metrics` on a running stand; see "M5-008 verification".                                                                                                                                             |
| TASK-M5-009 | **VERIFIED** (2026-09-20)         | Every relative documentation link resolves; see "M5-009 verification".                                                                                                                                                                          |

### Closure repairs and environment evidence

- `deploy/docker/app.Dockerfile` now deploys one shared production dependency
  closure through `packages/runtime`, avoiding duplicate Prisma/Nest trees.
  The image dropped from `396,071,825` bytes to `187,223,208` bytes. Runtime
  smoke checks found API, tools and Prisma configuration entrypoints.
- Next static generation uses
  `experimental.staticGenerationMaxConcurrency: 1`, documented by current
  Next.js configuration guidance, to keep the web Docker build within the
  available 7.7 GiB Docker memory while preserving all generated routes.
- Playwright system packages could not be installed system-wide because this
  WSL user has no passwordless sudo. The supported Playwright command was
  attempted: `pnpm exec playwright install --with-deps chromium`. The needed
  Ubuntu packages were downloaded with `apt-get download` and extracted to
  `$HOME/.local/share/remnaray-browser-libs`; Chromium then launched and all
  E2E and Lighthouse checks passed with that `LD_LIBRARY_PATH`.
- `pnpm lighthouse` passed: landing RU `100/96/100`, landing EN `100/96/100`,
  account accessibility `96`.
- The first web Docker build ran for `271.36s` and failed during static
  generation after repeated 60-second page retries. This was a constrained
  Docker resource failure, not a repository input failure: the same host build
  passed in `44.95s`. With the concurrency cap, the Docker build completed in
  `844.50s`, generated all 38 static pages and exported the `80,296,758` byte
  image.

### Final executable M5 verification — 2026-09-20

- `pnpm test:m5` passed on retry: 3/3 tests, including nginx TLS modes and
  reload in 939 ms, Caddy modes, and AC-202 backup/restore with 14 daily and 8
  weekly retention files. The first run's Docker Hub authorization EOF was a
  transient external registry failure and did not recur.
- `LD_LIBRARY_PATH="$HOME/.local/share/remnaray-browser-libs/usr/lib/x86_64-linux-gnu" pnpm test:e2e`
  passed 26/26 Playwright tests.
- The same browser runtime with `pnpm lighthouse` passed: landing RU
  performance 99, accessibility 96, SEO 100; landing EN 99/96/100; account
  accessibility 96.
- `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm -r typecheck`,
  `pnpm typecheck:e2e`, `pnpm format`, `pnpm i18n-check`, both theme
  validations, and all four Compose profile config checks passed.

### Remaining M5 blockers

- TASK-M5-004 remains an **external/manual validation requirement**. A user
  must provide a public server and DNS-controlled real domain, then record the
  checklist in `docs/tls.md`: nginx ACME issuance, certbot bootstrap and
  renewal reload, Caddy ACME, Caddy/certbot rejection, and the `/admin/system`
  TLS reading.
- TASK-M5-007, TASK-M5-008 and TASK-M5-009 are **implementation defects in the
  milestone state**: they remain unstarted. They were outside this blocker
  closure scope and must be implemented in dependency order after the external
  TLS gate is addressed.

## Reconciliation authority — 2026-09-20

The repository is the source of truth. HEAD at entry was `d8610a8` and the
working tree was clean. The reconciliation added the theme upload repair and
the production dependency deployment change; those changes are pending commit
below. No M6 work was started.

The prior M4 acceptance claim was not reproduced: `pnpm lighthouse` completed
the host build but then failed with `ECONNREFUSED 127.0.0.1:39185` while its
temporary runtime was unavailable. Therefore M4-003 is historical evidence,
not a fresh VERIFIED result, and M5 is not safe to advance from this session.

| Task        | Repository result                   | Evidence                                                                                                                                                                                        |
| ----------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-M5-001 | **IMPLEMENTED BUT NOT VERIFIED**    | Setup API/UI, PNG/SVG logo overrides, multipart registration, archive upload route and tests exist. `pnpm test:e2e` is blocked before tests by missing host library `libnspr4.so`.              |
| TASK-M5-002 | **INCOMPLETE**                      | `pnpm test:m5` passed nginx rendering and reload. The rebuilt app image is 396,071,825 bytes, above NFR-011's 250 MB cap; the web image build timed out during static generation inside Docker. |
| TASK-M5-003 | **VERIFIED**                        | `pnpm test:m5` passed the Caddy validation and supported-mode checks.                                                                                                                           |
| TASK-M5-004 | **BLOCKED BY EXTERNAL ENVIRONMENT** | Local mode/config checks pass, but section 25.6 requires both certificate paths against a real domain and public DNS. No such stand is available.                                               |
| TASK-M5-005 | **IMPLEMENTED BUT NOT VERIFIED**    | Trusted proxy unit coverage is included in the passing API suite; the broader E2E gate is blocked by the same missing Chromium host library.                                                    |
| TASK-M5-006 | **VERIFIED**                        | `pnpm test:m5` passed AC-202 dump, restore and 14/8 rotation against PostgreSQL 18.                                                                                                             |

### Repairs made during reconciliation

- Added `@fastify/multipart` and `yauzl` using their current documented APIs.
  The setup wizard now uploads a PNG/SVG logo when `RR_THEME_UPLOAD=true`,
  writes an atomic override under the persistent uploads volume, and resolves
  the override in API, web and bot asset paths. The admin
  `POST /api/admin/v1/themes/upload` archive route validates manifests,
  required assets, paths and archive limits.
- Added regression coverage for safe logo overrides and SVG script rejection.
- Changed the app Docker build to use production deployment closures instead
  of copying the full pnpm store. This reduced the measured image from the
  prior approximately 1.9 GB image, but it does not yet satisfy the 250 MB
  NFR-011 gate.

### Verification executed

Passed:

- `pnpm install --frozen-lockfile`
- `pnpm test` — 11 repository tests
- `pnpm -r test` — all workspace packages; API 142, web 22, bot 12, worker 4 and package suites
- `pnpm lint`
- `pnpm typecheck`; `pnpm -r typecheck`; `pnpm typecheck:e2e`
- `pnpm format`
- `pnpm i18n-check`; `pnpm theme-validate themes/manta`; `pnpm theme-validate themes/_admin`
- `pnpm build`
- `pnpm test:m5` — 3 tests passed, including nginx/Caddy proxy checks and AC-202 backup integration
- `docker compose config` for `nginx+certbot`, `caddy` and `external`, using a temporary copy of `.env.example`
- `docker build -f deploy/docker/app.Dockerfile`; tool import smoke passed; measured size failed NFR-011

Failed or externally blocked:

- `pnpm test:e2e` — 15 browser tests failed to launch because Chromium could not load `libnspr4.so`; 2 non-browser tests passed.
- `docker build -f deploy/docker/web.Dockerfile` — Next.js static generation exceeded the 60-second per-page limit in the constrained Docker environment after repeated retries. The host `pnpm build` passed.
- Real-domain M5-004 certificate checklist — blocked by absent public server/DNS/credentials.
- `pnpm lighthouse` — failed with `ECONNREFUSED 127.0.0.1:39185` after the build, so the M4 Lighthouse gate was not reproduced.

### Current Definition of Done

M5 is **NOT VERIFIED**. The CI and maintainer-review gates are not evidence in
this local checkout; the local browser gate, NFR-011 image cap, and real-domain
TLS gate remain open.

**MILESTONE M5: NOT VERIFIED**
**DO NOT PROCEED TO M6**

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

- Playwright/Chromium cannot start because this host lacks `libnspr4.so`.
- The web Docker build is constrained by this machine's Docker memory/runtime.
- The app image remains above NFR-011 after removing the full pnpm store.
- M5-004 requires a public real-domain TLS stand and manual checklist.
- Hosted GitHub Actions execution and maintainer review remain external Definition of Done gates.

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

Close the M5-001/M5-002/M5-004/M5-005 verification blockers, then start TASK-M5-007. Do not begin M6.

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

## M4-003 Lighthouse verification — historical result, not reproduced

The prior session recorded this as verified. In this reconciliation,
`pnpm lighthouse` built successfully but failed with
`ECONNREFUSED 127.0.0.1:39185`; retain the prior measurement as historical
evidence only until the runtime is available and the command passes again.

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

## M5-001 reconciliation

Implemented during reconciliation; verification is blocked by the host browser runtime.

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

### M5-001 repaired gap — the step 5 logo upload

The previously recorded missing PNG/SVG upload is now implemented. `RR_THEME_UPLOAD`
gates the setup upload route, the persistent `uploads:/uploads` volume stores
`themes/<slug>/overrides/logo.{png,svg}`, and `ThemeService` resolves the
override ahead of the shipped asset. The web route and bot asset lookup use the
same resolution. The admin archive endpoint validates a complete uploaded theme.
Fresh E2E verification is still blocked by the missing Chromium host library.

## M5-002 reconciliation

Proxy acceptance passed; the task remains incomplete because NFR-011 is not met and the Docker web-image gate is blocked.

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

## M5-004 reconciliation

Implemented locally; BLOCKED BY EXTERNAL ENVIRONMENT for the required real-domain acceptance gate.

- `acme` was already complete with TASK-M5-002: the module renders only in that
  mode, keeps its state in `proxy-acme` and renews without a reload because the
  configuration names the certificate through `$acme_certificate`.
- `certbot` is now whole. The `certbot` service renews every twelve hours and
  its `--deploy-hook` touches `/etc/letsencrypt/.renewed`, which
  `proxy-reloader` already watches; `./rr tls:issue` performs the first issue
  against the HTTP-only bootstrap configuration the renderer chooses while no
  certificate exists, then restarts `proxy-config` so the full configuration
  renders. `./rr up` adds the `certbot` profile on its own.
- `custom` needs no runtime service; both profiles name the owner's files, at
  `/etc/nginx/certs` and `/certs`.
- `maintenance.tls-check` is the one maintenance job the worker performs itself,
  because section 19.2 wants the handshake made from outside the API. It runs at
  start and daily, and posts to the new
  `POST /api/internal/v1/system/tls-result`, which keeps the reading in Valkey,
  raises `tls.expiring` below fourteen days or when the host does not answer,
  and feeds `tls.expiresAt`, `tls.daysLeft` and `tls.checkedAt` on
  `GET /api/admin/v1/system`. Verification is deliberately not enforced by the
  check: an expired certificate still has to be readable.
- `packages/config` now refuses every combination that cannot work — `none`
  outside the `external` profile, and `certbot` with Caddy — so the process
  fails at startup with the variable named instead of running a proxy that
  never gets a certificate.
- Checks: `pnpm lint`, `pnpm typecheck`, `pnpm -r typecheck`, `pnpm test` (11),
  `pnpm -r test` (api 136, web 22, bot 12, worker 2, config 5 and the remaining
  packages), `pnpm format`, full `pnpm build`, and
  `docker compose --profile nginx --profile certbot config`.

### M5-004 external gate

Section 25.6 accepts this task "на стенде с реальным доменом… (ручная
проверка, чеклист в PR)" — both issue paths exercised by hand against a real
domain. That needs a public server and DNS this repository cannot supply, so it
stays open. The checklist to run is in `docs/tls.md` under "Acceptance
checklist"; everything that can be checked without a public domain is covered
by the unit tests and the environment validation above.

### M5-004 decisions

- `apps/worker` had no tests at all; it now has Vitest with the same
  configuration the API uses, so the TLS reading is covered rather than trusted.
- The TLS reading lives in Valkey rather than in a settings key: it is an
  observation, not configuration, and `/admin/system` is its only reader.
- The earlier `RR_TLS_EXPIRES_AT` environment reading on `/admin/system` was a
  placeholder with nothing writing it; it is replaced by the real measurement.

## M5-005 reconciliation

Implemented; the trusted-proxy unit gate passed, but the broader browser verification is blocked by the host runtime.

- Acceptance: a forged `X-Forwarded-For` from outside the trusted network must
  leave the source address alone. `apps/api/src/common/trusted-proxies.test.ts`
  drives a real Fastify instance: from `203.0.113.7` with
  `x-forwarded-for: 9.9.9.9` and `RR_TRUSTED_PROXIES=172.28.0.0/16`,
  `request.ip` is **203.0.113.7**; from `172.28.0.10` it is `9.9.9.9`, which is
  the proxy legitimately naming its client; and with nothing configured no
  header is believed at all.
- `apps/api` now builds its Fastify adapter with
  `trustProxy: trustedProxies()`. Context7 confirmed the current contract: a
  comma-separated IP/CIDR string, and Fastify deliberately refuses hop-count
  trust because it cannot validate the immediate peer.
- `deploy/proxy/external/edge.conf` is the section 21.7 container: routing
  only, no TLS, no limits, no security headers, because those belong to the
  owner's proxy and a second source of the same header is a second thing to
  keep in step. `nginx -t` passes. Compose starts it under the `external`
  profile, publishing `127.0.0.1:${RR_EXTERNAL_HTTP_PORT}`, and that profile
  starts none of the `proxy-*` services.
- `GET /api/admin/v1/system` reports `proxy.trustedProxies` and
  `proxy.external` — what the last request carried: the resolved client
  address, the protocol and whether each forwarded header was present. An
  owner can see the answer before something breaks rather than after.
- `.env.example` and `scripts/init-env.sh` now write `RR_TRUSTED_PROXIES` and
  `RR_EXTERNAL_HTTP_PORT`, so the documented default reaches the process
  instead of living only in the Zod schema.
- `docs/external-proxy.md` covers the contract and the nginx, Traefik and
  Cloudflare configurations, including the Cloudflare ranges and the
  no-cache rule for `/api`, `/webhooks` and `/tg`.
- Checks: `pnpm lint`, `pnpm typecheck`, `pnpm -r typecheck`, `pnpm test` (11),
  `pnpm -r test` (api 138 and the rest), `pnpm test:e2e` (26), `pnpm format`,
  full `pnpm build`, `docker compose --profile external config`, and `nginx -t`
  on `edge.conf`.

### M5-005 decisions

- The indicator is kept in process memory, not Valkey: it describes the last
  request this process served, `/admin/system` runs in the same process, and
  writing to Valkey on every request would cost a round trip for a diagnostic.
- With `RR_TRUSTED_PROXIES` unset the API trusts nobody rather than falling
  back to the compose network. A deployment that has not said what sits in
  front of it should not believe a header anyone can send.

## M5-006 verification

Verified on 2026-09-20.

- AC-202, both halves, in `test/m5.backup.integration.test.mjs` against a real
  PostgreSQL 18: `backup-entrypoint.sh once` writes a `pg_dump -Fc -Z 6` and a
  `.last-status` line carrying the state, the file and its size; the dump is
  then read back with `pg_restore --clean --if-exists` and the schema is whole
  again. Rotation is given 30 daily, 30 archive and 12 weekly files and keeps
  exactly **14 daily, 14 archives and 8 weekly**, the newest of each.
- The weekly copy is a hard link made on Sundays, so a Sunday costs no extra
  space and the two retentions cannot argue over one file: each prunes its own
  name and the bytes go with the last one.
- `deploy/backup/Dockerfile` is `postgres:18-alpine` plus a pinned
  `minio-client`, so the S3 copy has a client and a missing package fails the
  image build rather than a backup at three in the morning. Alpine's package
  is `minio-client` and its binary is `mcli`, which the script calls.
- `.env` is never copied into a backup. It holds `RR_APP_KEY`, and an archive
  carrying both the ciphertext and its key protects nothing.
- `deploy/backup/restore.sh` performs the section 20.5 sequence and asks for
  confirmation, because `--clean` drops what is there; `RR_RESTORE_ASSUME_YES`
  skips the prompt for a script.
- The `migrate` one-shot service of section 21.1 was missing from compose
  entirely. It now applies the migrations before `api`, `bot` and `worker`
  start, and takes `backups/pre-migrate-<version>.dump` first when a pending
  migration is marked `-- reversible: no` — never on a fresh database, where
  there is nothing to dump. Its header parsing, the pending comparison and the
  dump decision are unit tested.
- `maintenance.backup-check` reads `.last-status` in the worker and reports to
  `POST /api/internal/v1/system/backup-result`, which raises `backup.failed`
  when the newest backup failed or is older than 26 hours and feeds
  `GET /api/admin/v1/system`, replacing another environment reading nothing
  ever wrote.
- Checks: the AC-202 integration test, `pnpm lint`, `pnpm typecheck`,
  `pnpm -r typecheck`, `pnpm test` (11), `pnpm -r test` (api 141, worker 4,
  web 22, bot 12 and the rest), `pnpm format`, full `pnpm build`,
  `pnpm i18n-check`, and `docker compose config` for the `nginx` and
  `external` profiles.

### M5-006 decisions

- The app image gained a pinned `postgresql18-client`, because section 20.4
  makes `migrate` take a dump and the runtime image had no `pg_dump`. It also
  carries the db package's schema, migrations and Prisma CLI, which
  `prisma migrate deploy` needs beside them.
- The entrypoint takes `once` and `rotate` subcommands rather than only the
  scheduled loop. An operator can take a backup or apply the retention on
  demand, and the acceptance test drives the same code the schedule does.
- Rotation sorts by file name, which is chronological by construction, instead
  of parsing dates out of names in shell.
