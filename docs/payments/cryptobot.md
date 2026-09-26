# CryptoBot

Configure the Crypto Pay API token. The adapter creates a fiat RUB invoice,
whose `amount` is the decimal string of roubles (`"299.00"` for 29900 kopecks),
and checks the `crypto-pay-api-signature` HMAC header on callbacks. The provider
invoice payload is retained without the API token; `paid_asset` is provider
payload data and must remain available for payment reporting. «Проверить»
calls `getMe`, which exists to test the app token.

Source: [Crypto Pay API](https://help.send.tg/en/articles/10279948-crypto-pay-api)
(moved from help.crypt.bot; read 2026-09-26).
