---
'@remnaray/api': patch
---

Send the payer back to the invoice page `/pay/<id>` instead of `/pay/success` or `/pay/fail`, which the site read as an invoice named "success", and give Lava the real webhook address `https://<domain>/webhooks/lava` instead of a path below the return page, where no Lava notification ever arrived.
