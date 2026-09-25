---
'@remnaray/api': patch
'@remnaray/web': patch
'@remnaray/db': patch
---

Use FR-062's `settings.fiscal.mode` values, `none` and `provider_receipt`, instead of `none`, `receipt` and `manual`. Migration 0007 maps stored values (`receipt` to `provider_receipt`, `manual` to `none`), so receipts do not switch off after the upgrade.
