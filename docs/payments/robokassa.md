# Robokassa

Configuration (JSON in the console or the setup wizard):

```json
{
  "merchantLogin": "shop",
  "password1": "…",
  "password2": "…",
  "isTest": false,
  "testPassword1": "…",
  "testPassword2": "…",
  "sno": "usn_income",
  "tax": "none"
}
```

In the Robokassa technical settings select the **MD5** hash algorithm and set
**ResultURL** to `https://<domain>/webhooks/robokassa/result` (method POST).
SuccessURL and FailURL are only where the payer is sent back and never mark
anything paid; Robokassa takes them from the technical settings, not from the
invoice.

- The payment link is built without an API call. `InvId` is the invoice's
  `numeric_id` (Robokassa takes an integer up to 2³¹ − 1) and `Shp_inv` its
  id. `SignatureValue = MD5(MerchantLogin:OutSum:InvId[:Receipt]:Password#1:Shp_inv=<id>)`.
- With receipts on (`settings.fiscal.mode`), `Receipt` is
  `{ sno, items: [{ name, quantity: 1, sum, payment_method: "full_payment",
payment_object: "service", tax }] }`, URL-encoded once; that encoded text is
  both signed and sent.
- ResultURL is checked as `MD5(OutSum:InvId:Password#2:Shp_inv=<id>)`,
  case-insensitively, and answered `text/plain` `OK<InvId>`, a repeated
  notification included.
- The status poll calls `OpStateExt` with `MD5(MerchantLogin:InvoiceID:Password#2)`;
  `State.Code = 100` is paid. Robokassa does not serve test payments there,
  so in test mode (`isTest: true`, `IsTest=1`, test passwords) payment is
  known from ResultURL only.
- The health check confirms the login and the two passwords are set; Robokassa
  has no API call to try them without a payment.

Sources: [payment interface](https://docs.robokassa.ru/ru/pay-interface),
[notifications](https://docs.robokassa.ru/ru/notifications-and-redirects),
[fiscalization](https://docs.robokassa.ru/ru/fiscalization),
[XML interfaces](https://docs.robokassa.ru/ru/xml-interfaces).
