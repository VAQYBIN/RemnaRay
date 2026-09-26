---
'@remnaray/api': patch
---

Apply a promo code used with a balance payment. The balance settled the invoice before the code's reservation was attached to it, so the reservation stayed open for good and the code's use count never moved; the reservation is now attached when the invoice is created.
