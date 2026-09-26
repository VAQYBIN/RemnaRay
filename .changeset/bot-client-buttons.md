---
'@remnaray/bot': patch
'@remnaray/web': patch
---

Open subscription clients from the bot through the site. Telegram URL buttons accept only http(s) and tg:// links, so the `happ://` button made the whole «Клиенты» screen fail. The bot now shows one button per configured client, and each opens `/<locale>/open/<client>`, which hands the subscription link from the URL fragment to the client's deep link.
