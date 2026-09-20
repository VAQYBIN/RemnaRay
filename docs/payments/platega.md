# Platega

Configure `merchantId` and `secret`. RemnaRay creates a transaction with
`POST /v2/transaction/process`, then polls `GET /transaction/{id}` every 30
seconds until expiration. `CONFIRMED` is the only successful provider state;
the redirect and an unverified callback do not settle an invoice.

Source: [Platega API](https://docs.platega.io/).
