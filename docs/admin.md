# Administration authentication

The admin API uses a separate `rr_asid` cookie with a 12-hour lifetime. A
password login creates a five-minute challenge, and the challenge is completed
with a six-digit TOTP. First-time admins use `POST /api/admin/v1/auth/totp/setup`
and then confirm the generated code; subsequent logins use
`POST /api/admin/v1/auth/totp`.

Mutating admin requests must include the CSRF token returned by
`GET /api/admin/v1/auth/me` in `X-CSRF-Token`, alongside the existing
same-origin request headers. Passwords use Argon2id with 64 MiB memory, three
passes, and one thread. Five failed passwords lock the account for 15 minutes;
later lockouts grow exponentially up to 24 hours.

The shared RBAC matrix lives in `packages/domain/src/rbac.ts`. Operators receive
operational permissions only; administration, settings, secret-bearing
integrations, balance debits, and anonymization remain admin-only.

Every authenticated admin mutation produces an immutable `audit_log` row. The
interceptor masks password, token, secret, cookie, authorization, TOTP, and API
key fields before writing `before` or `after` values and truncates oversized
objects.

## Administrators (FR-143)

`GET/POST /api/admin/v1/admins`, `PATCH /api/admin/v1/admins/:id`,
`POST /api/admin/v1/admins/:id/reset-password`, `.../reset-totp` and
`.../deactivate` manage administrator accounts. Only the `admin` role may call
them.

The last active `admin` cannot be deactivated or demoted to `operator`: the
request answers `409 LAST_ADMIN`. The check runs inside the same transaction as
the update and locks the remaining admin rows with `SELECT … FOR UPDATE`, so two
concurrent requests cannot each see the other as the survivor.

`reset-totp` clears the stored secret and the `totp_enabled` flag, so the next
login runs the first-login enrolment again. New and reset passwords require at
least twelve characters with a lowercase letter, an uppercase letter and a
digit.

## Audit contract

Handlers that change state return `Audited(before, after, body?)`. The
interceptor stores the state the handler read _before_ the change, stores the
resulting state, and answers the HTTP request with `body` (defaulting to
`after`). The request body is never stored as `before`; only its `reason` field
is copied into the audit row.

## Session and challenge handling

- The password failure counter is incremented by the database, so parallel
  attempts cannot overwrite each other and the fifth failure always locks.
- The TOTP enrolment secret is encrypted with `RR_APP_KEY` before it is written
  to Valkey, exactly like the stored secret.
- Deleting the login challenge is the atomic commit point for issuing a session:
  only the request whose `DEL` removed the key receives `rr_asid`, so a replayed
  code cannot mint a second session.
- CSRF applies to `/api/admin/v1/auth/*` as well. Login and TOTP requests have no
  session yet, so they are checked by origin and `X-Requested-With`; once a
  session exists, `X-CSRF-Token` is also required.

## Console

`/admin` is served without a locale prefix and always uses the neutral `_admin`
theme; its texts come from the shipped `admin.json` only, which section 18.4
keeps outside the owner's override surface. The interface language follows
`settings.locale.default` until an administrator profile language exists.

| Path                                | Content                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| `/admin/login`                      | email + password → TOTP, with first-login enrolment and a QR code     |
| `/admin`                            | FR-142 widgets, revenue and registration charts, "requires attention" |
| `/admin/users`, `/admin/users/[id]` | FR-140 search and filters; FR-141 actions behind reason modals        |
| `/admin/subscriptions`              | Status, plan and expiry filters; bulk extension up to 500 rows        |
| `/admin/payments`                   | Invoices with masked provider events, recheck, transactions, refund   |
| `/admin/plans`                      | FR-145 CRUD with ordering                                             |

`AdminShell` loads `GET /api/admin/v1/auth/me` once, keeps the CSRF token for
later mutations and hides every section the role does not carry. Server-side,
`@Roles`/`@Permissions` enforce the same matrix, so hiding a control is a
convenience rather than the boundary.

## Dashboard aggregates

Every FR-142 number is a SQL aggregate over `transactions`, `subscriptions`,
`users` and `accounts`, cached in Valkey for 60 seconds. Revenue counts
`purchase` and `topup` minus `refund`; the trial conversion is a cohort by trial
date. `test/m4.admin.integration.test.mjs` re-computes each aggregate with an
independent SQL control on fixtures (AC-142) and also covers AC-140 search and
AC-141 audited actions.

## Operator limits

`settings.operator.max_credit_minor` caps an operator's daily total credit and
`settings.operator.max_refund_minor` caps a single refund. An operator can never
debit a balance, run a bulk extension, anonymize a user or edit plans.
