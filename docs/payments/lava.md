# Lava

Configure `shopId`, the project `secretKey`, and the additional webhook key.
Outgoing JSON is signed with HMAC-SHA256 and the incoming raw body is verified
with the additional key. Status polling uses `POST /business/invoice/status`.
«Проверить» signs `POST /business/invoice/get-available-tariffs` with the
`shopId` and succeeds on `status_check: true`, so wrong keys fail the check.

Source: [Lava Business API](https://developer.lava.ru/).
