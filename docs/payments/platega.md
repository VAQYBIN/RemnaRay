# Platega

Configure `merchantId` and `secret`. RemnaRay creates a transaction with
`POST /v2/transaction/process`, then polls `GET /transaction/{id}` every 30
seconds until expiration. `CONFIRMED` is the only successful provider state;
the redirect and an unverified callback do not settle an invoice.
«Проверить» calls `GET /balance/all`, which answers 401 to wrong credentials.

Source: [Platega API](https://docs.platega.io/).
