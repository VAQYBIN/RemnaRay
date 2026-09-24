---
'@remnaray/web': patch
---

Open the account from the bot in the visitor's language: `/auth/tg` now follows the section 13.1 order `rr_lang` → `Accept-Language` → default. next-intl 4 sets `rr_lang` only when the locale differs from the browser's language, so an English visitor used to land on `/ru/account`.
