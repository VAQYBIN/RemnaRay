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
