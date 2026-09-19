# Users module

The users module owns the Telegram user upsert boundary. It validates the
internal bot payload, stores Telegram identifiers as PostgreSQL `BIGINT`,
creates the v1 Telegram `channel_identity`, allocates an eight-character
referral code, and records a valid referral attribution in the same database
transaction as the user.

`POST /api/internal/v1/users/upsert` accepts `telegramId`, optional profile
fields, and a `startPayload`. The supported payloads are `ref_<code>`,
`promo_<code>`, and `plan_<slug>`; other payloads are ignored. The endpoint
returns the user summary plus `created`, `attributed`, and `promoReserved`
flags. Authentication of the internal API is added by the auth task.
