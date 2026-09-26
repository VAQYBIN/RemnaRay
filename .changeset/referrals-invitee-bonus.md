---
'@remnaray/api': patch
'@remnaray/web': patch
'@remnaray/domain': patch
---

Load the referral page again. The invitee bonus is stored as `{ type, value }`, and the API turned it into a number, which came out as `null` and failed the page. It is now sent as stored, and the page states the reward for each referral mode (a fixed reward was described as a percentage) together with the invited customer's bonus.
