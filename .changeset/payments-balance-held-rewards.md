---
'@remnaray/api': patch
---

Stop paying from the balance with held referral rewards (section 15.2): a balance payment now needs the available balance, `balance_minor` minus held rewards, and a shortfall answers 409 `INSUFFICIENT_FUNDS` instead of a 500.
