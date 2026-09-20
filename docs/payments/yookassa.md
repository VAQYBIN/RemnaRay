# YooKassa

Configure `shopId`, `secretKey`, optional fiscal settings, and the documented
YooKassa notification IP ranges. RemnaRay sends `POST /v3/payments` with
`capture=true`, the invoice identifier in `metadata.invoiceId`, and an
`Idempotence-Key`. A callback is never trusted for the final state by itself:
the adapter fetches `GET /v3/payments/{id}` before applying it.

Sources: [payment creation](https://yookassa.ru/developers/payment-acceptance/getting-started/quick-start), [webhooks](https://yookassa.ru/developers/using-api/webhooks).
