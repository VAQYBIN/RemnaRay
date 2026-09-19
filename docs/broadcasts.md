# Broadcasts

## Segment DSL (section 16.3)

`packages/domain/segment.ts` compiles the JSON DSL. `compileSegment` returns a
plan: the part the `users` table can answer as a Prisma `where`, plus the
subscription, transaction and referrer conditions the repository resolves
separately (the schema has no Prisma relations).

Every operator — `eq, ne, in, not_in, lt, lte, gt, gte, null, not_null` — and
the relative dates `now±Nd/h` are covered by `segment.test.ts`. A segment can
never widen the mandatory exclusions: banned, bot-blocked, opted-out and
anonymized users are always filtered out, whatever the conditions say.

The six section 16.3 presets ship as `segmentPresets`.

## Editor

The message carries one text per enabled language, up to four buttons
(`url`, `deeplink` → `t.me/<bot>?start=…`, `callback`), an optional photo and
the `{first_name}`, `{days_left}`, `{plan}`, `{balance}` placeholders. Only the
Telegram HTML tags section 16.3 lists are accepted; anything else is rejected at
validation time. «Тест на себя» delivers to the administrator's own Telegram id.

## Sending (section 16.4)

`start` materializes the audience once into `broadcast_deliveries` with status
`pending` (migration `0004_broadcast_delivery_pending` allows that status) and
queues chunks of 500 ids. Each chunk skips deliveries that are no longer
pending, so a resumed run never messages anyone twice.

Throttling is 25 messages per second with `concurrency: 1`. A `403` marks
`users.bot_blocked_at` and records `blocked`; a `429` backs off and records
`failed`. The chunk re-reads the broadcast status every 50 messages and stops as
soon as it leaves `running`, which is what pause does. Resume queues only the
deliveries still pending.

The report gives `pending/sent/blocked/failed`, the duration, and a CSV of the
failed deliveries with their errors.

## Verification

`test/m4.broadcast.integration.test.mjs` runs against PostgreSQL 18: it checks
that blocked, opted-out and anonymized users are excluded from the audience,
pauses mid-run, resumes, and asserts that every recipient received exactly one
message and that the 403 recipient is recorded as blocked (AC-161).
