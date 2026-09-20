# Payment providers

RemnaRay treats the database invoice and `payment_events` row as the source of
truth. A provider callback is authenticated, normalized to `ProviderEvent`,
stored before processing, and applied idempotently. Provider secrets are stored
in encrypted `payment_providers.config_enc` values.

The provider adapters follow the current provider contracts:

- [YooKassa](./yookassa.md) uses Basic authentication, `Idempotence-Key`, IP
  allowlisting, and status re-fetch before a `paid` event is applied.
- [Robokassa](./robokassa.md) uses `ResultURL`, the configured hash algorithm,
  and `OK<InvId>` acknowledgements.
- [Lava](./lava.md) verifies incoming HMAC-SHA256 signatures with the
  additional webhook key.
- [Platega](./platega.md) polls `GET /transaction/{id}` because polling is the
  source of truth.
- [CryptoBot](./cryptobot.md) verifies `crypto-pay-api-signature`.
- Telegram Stars are handled through the bot update flow; the API adapter
  creates `createInvoiceLink` links and accepts only `successful_payment` as
  proof of payment.

Provider configuration is deliberately incomplete until an administrator
enables the provider and records a successful health check.
