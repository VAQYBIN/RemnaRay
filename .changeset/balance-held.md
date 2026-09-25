---
'@remnaray/api': patch
'@remnaray/domain': minor
'@remnaray/web': patch
'@remnaray/bot': patch
---

Show the customer the balance they can spend. Held referral rewards (section 15.2) are subtracted from `UserMe.balance`, from the balance payment method and from the plan-change check, and are shown as pending through the new `UserMe.balanceHeld`, on the account's balance page and in the bot. A balance payment was offered for money that was then refused.
