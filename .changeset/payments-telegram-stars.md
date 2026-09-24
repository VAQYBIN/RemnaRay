---
'@remnaray/api': patch
'@remnaray/bot': patch
'@remnaray/web': patch
'@remnaray/telegram-mock': patch
---

Implement Telegram Stars payments (sections 9.5 and 11.3.6). The bot now sends Stars invoices for `/start inv_<id>`, answers `pre_checkout_query` through `POST /api/internal/v1/stars/precheckout` (pending, unexpired, the payer's own invoice, exact amount) and records `successful_payment` through `POST /api/internal/v1/stars/successful-payment`, idempotent by `telegram_payment_charge_id`; a payment the API cannot record is redelivered. Prices follow `price_overrides.XTR ?? ceil(price × starsPerRub)`, the payload is `inv_<invoiceId>` and the bot token comes from `bot.token`. Invoice lifetimes now come from `invoice.ttl_minutes` and `invoice.ttl_minutes_crypto`.

Apply a payment event once even when deliveries race: `applyEvent` locks the event row and re-checks it inside the transaction.

A payment for a canceled invoice is credited to the balance like EX-02 (`payment.after_cancel` alert), and a second, distinct Telegram Stars charge for an invoice already paid is credited to the balance (`payment.duplicate` alert); a further `paid` event for a settled invoice of any other provider is an EX-03 duplicate.

Fix reading stored provider configuration: payments decrypted `config_enc` with `JSON.parse`, which threw for every provider configured in the console or the setup wizard, so none of them could create an invoice.

⚠ Breaking: the Stars provider configuration is now `{"starsPerRub": <number>}`; the former `botToken` and `starAmount` fields are ignored.
