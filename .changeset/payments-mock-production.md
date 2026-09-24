---
'@remnaray/api': patch
'@remnaray/config': patch
---

Register the `mock` payment provider only when `RR_PAYMENTS_MOCK=true` (section 22.4). Previously it was always registered and bypassed the enabled check, so any signed-in customer could mark their own invoice paid with the public default webhook secret.

⚠ Breaking: a `.env` created by an earlier `scripts/init-env.sh` contains `RR_PAYMENTS_MOCK=true`; set it to `false` (or remove it) on every live deployment before upgrading.
