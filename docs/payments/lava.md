# Lava

Configure `shopId`, the project `secretKey`, and the additional webhook key.
Outgoing JSON is signed with HMAC-SHA256 and the incoming raw body is verified
with the additional key. Status polling uses `POST /business/invoice/status`.

Source: [Lava Business API](https://developer.lava.ru/).
