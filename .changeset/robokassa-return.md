---
'@remnaray/web': patch
---

Return Robokassa payers to their invoice page. Robokassa sends every payer to the SuccessURL and FailURL of the store's settings, and `/pay/robokassa`, which both should now point to, redirects to `/<locale>/pay/<invoice>` from the `Shp_inv` and `Culture` Robokassa appends, by GET or POST.
