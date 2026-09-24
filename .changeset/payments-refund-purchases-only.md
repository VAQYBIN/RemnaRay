---
'@remnaray/api': patch
---

Refund only purchases to the balance (FR-066, EX-05). Refunding a top-up paid the same money into the balance a second time; it is now refused, and a refund above the amount left answers 409 `CONFLICT` (AC-066) instead of a 500.
