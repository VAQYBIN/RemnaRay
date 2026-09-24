# The API

One API serves both channels. The bot and the site are thin clients over it,
which is why a rule exists once and behaves the same wherever a customer meets
it.

`apps/api/openapi.json` is generated from the Zod contracts in
`packages/domain` — OpenAPI 3.1, 135 paths — so it cannot drift from what the
code accepts. Regenerate it with `pnpm --filter @remnaray/api build`.

## The four surfaces

| Prefix                             | Who calls it                                    | How it authenticates                                      |
| ---------------------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| `/api/v1/...`                      | the site, and anyone reading the public catalog | a session cookie for `/me`, nothing for the public routes |
| `/api/admin/v1/...`                | the administration console                      | administrator session plus `X-CSRF-Token`                 |
| `/api/internal/v1/...`             | the bot and the worker                          | `X-Internal-Token`, and only from the compose network     |
| `/webhooks/...`, `/tg/webhook/...` | payment providers, the panel, Telegram          | the provider's own signature — never a session            |

`/api/docs` serves the document when `RR_API_DOCS=true`; the proxy answers 404
for it otherwise, in both profiles.

## The rules that apply everywhere

- **Errors** are `{ "error": { "code": "...", "message": "..." } }` with the
  code carrying the meaning. The table of codes and statuses is section 9.3 of
  the specification.
- **Money** is integer minor units, never a float. A price of 299 ₽ is
  `29900`.
- **Idempotency**: anything that creates an invoice takes an
  `Idempotency-Key`; sending the same key twice returns the first answer
  instead of charging twice.
- **Mutations from a browser** need `X-Requested-With: RemnaRay` and either
  `Sec-Fetch-Site: same-origin` or a matching `Origin`. Webhooks are exempt —
  they authenticate by signature.
- **Rate limits** apply at the proxy by zone and again per user inside the API;
  both answer 429.

## Health and metrics

```
GET /api/v1/health          liveness, no dependencies
GET /api/v1/health/ready    database, Valkey, panel, migrations, setup
GET /metrics                Prometheus text, from the internal network only
```

[`monitoring.md`](monitoring.md) lists the twelve metrics and what writes them.

## Outgoing webhooks

RemnaRay can call you when something happens (section 9.8). Up to five
recipients go in the `webhooks.outgoing` setting (Settings → Store in the
console, a JSON array; the value is secret, so it is written whole):

```json
[
  {
    "url": "https://example.com/hook",
    "secret": "…",
    "events": ["payment.succeeded"],
    "enabled": true
  }
]
```

Events: `user.created`, `subscription.activated` (a purchase, trial, plan
change, invitee bonus or an administrator's extension), `subscription.expired`,
`payment.succeeded` (money taken for an invoice, including one credited to the
balance), `payment.refunded`, `referral.rewarded`. The body is

```json
{
  "id": "01J…",
  "type": "payment.succeeded",
  "createdAt": "2026-09-18T10:00:00.000Z",
  "data": {
    "userId": "…",
    "telegramId": 123,
    "transactionId": "…",
    "invoiceId": "…",
    "type": "purchase",
    "amountMinor": 29900,
    "currency": "RUB",
    "provider": "yookassa",
    "planId": "…"
  }
}
```

with `X-RemnaRay-Signature: sha256=<hex HMAC-SHA256 of the raw body with the
recipient's secret>`, `X-RemnaRay-Event` and `X-RemnaRay-Delivery` (the event
`id`; deduplicate on it). Any 2xx within 10 s is delivered; anything else,
a redirect included, is retried 1 min, 5 min, 30 min, 2 h and 12 h later with
the same body. The event is recorded in the transaction that causes it and
sent after it commits, from the `webhooks` queue; a recipient removed or
unsubscribed before a retry is not called again. No delivery table is kept:
failures are logged and counted in `rr_outgoing_webhook_failures_total`.
