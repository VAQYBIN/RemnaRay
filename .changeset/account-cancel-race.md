---
'@remnaray/api': patch
---

Never mark a paid invoice canceled. Canceling from the account now updates only a still-pending invoice in one transaction with the promocode release, so a payment applied between the check and the update keeps the invoice paid and the cancel answers 409 `INVOICE_NOT_PENDING`.
