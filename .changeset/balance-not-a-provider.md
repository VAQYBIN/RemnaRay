---
'@remnaray/api': patch
'@remnaray/web': patch
'@remnaray/bot': patch
---

Keep the built-in balance out of the payment providers. The setup wizard offered it as a provider to configure, and the row it wrote appeared as a second payment method that the site's top-up used, paying the top-up from the balance itself. The wizard no longer offers it, an existing row is ignored, and top-ups on the site and in the bot let the customer choose a provider.
