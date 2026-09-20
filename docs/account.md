# Customer account

The account lives at `/<locale>/account` and is protected by `proxy.ts`: a
request without `rr_sid` is redirected to `/<locale>?login=1`.

## Pages and states

| Path                 | Content                                                           | Empty state                                          |
| -------------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| `/account`           | Status, expiry, traffic, subscription link, QR, client deep links | «У вас нет подписки» with the trial and plan actions |
| `/account/plans`     | Plan cards, provider radio (balance first), promo code preview    | «Тарифов пока нет»                                   |
| `/account/balance`   | Balance, presets, custom amount, cursor-paginated history         | «Операций пока нет»                                  |
| `/account/referrals` | Links, statistics, terms, masked invited users                    | «Пока никого»                                        |
| `/account/devices`   | HWID list, removal when the owner allows it                       | «Устройств нет»                                      |
| `/account/settings`  | Language, receipt email, marketing, anonymization request         | —                                                    |
| `/pay/[invoiceId]`   | Status, countdown, payment and check actions                      | —                                                    |

Every page renders through `ResourceSection`, which owns the three states of
section 13.4: `LoadingState` (skeletons), `Empty` and `FailureState` (localized
error code plus `requestId`). `useResource` caches a read for 15 seconds;
mutations call `invalidate(prefix)` instead of updating optimistically, because
the values are money.

`test/account-pages.test.tsx` renders each page against a mocked API and asserts
all three states (AC-133); `test/pay-page.test.tsx` covers the payment page
behaviour from FR-134.

## Authentication

- Telegram Login Widget on the landing page posts to `POST /api/v1/auth/telegram`
  and refreshes the route. The bot username comes from
  `GET /api/v1/public/config`, so `/setdomain` is the only manual step.
- From the bot, «Открыть кабинет» opens `/auth/tg?token=<jwt>`. The route
  handler exchanges the token through the API and forwards the `Set-Cookie`
  before redirecting into `/<locale>/account`.
- «Выйти» posts `POST /api/v1/auth/logout`, drops the cached resources and
  returns to the landing page.

## API

`/api/v1/me/*` and `/api/internal/v1/me/*` are the same operations backed by one
`MeService` (sections 9.4 and 9.5). The public controller resolves the user from
the session cookie, the internal one from `X-Acting-User`. Money is transported
as `{ amountMinor, currency }` with `amountMinor` as a JSON number.

`POST /api/v1/me/anonymize-request` does not anonymize anything by itself: per
section 19.5 it records `users.anonymize.requested` in the immutable audit log,
from where an administrator performs the anonymization. The administrator alert
for that request is scheduled with the notification work in TASK-M4-007.
