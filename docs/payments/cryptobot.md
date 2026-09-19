# CryptoBot

Configure the Crypto Pay API token. The adapter creates a fiat RUB invoice and
checks the `crypto-pay-api-signature` HMAC header on callbacks. The provider
invoice payload is retained without the API token; `paid_asset` is provider
payload data and must remain available for payment reporting.

Source: [Crypto Pay API](https://help.crypt.bot/crypto-pay-api).
