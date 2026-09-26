---
'@remnaray/api': patch
---

Never pay a balance invoice the balance could not cover. A refused balance payment left a pending invoice that a repeated request handed back and «Проверить» marked paid, because the balance answers every status lookup with `paid`: any customer could take a plan or a top-up for nothing. A balance invoice is now written and debited in one transaction, the check no longer polls providers without status polling, a top-up can no longer be paid from the balance, and an invoice through a provider that is not offered (disabled or without a successful healthcheck, AC-061) is refused with `PROVIDER_UNAVAILABLE`.
