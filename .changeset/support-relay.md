---
'@remnaray/api': patch
'@remnaray/bot': patch
---

Relay operators' answers back to customers (FR-124). Without an operators' chat, «Поддержка» shows the support contact instead of pretending to pass the message on. With one, each customer gets a topic of their own in a forum supergroup, or a reply-able message in a plain group, and whatever an operator writes there reaches the customer in the bot. A message that could not be delivered is reported to the customer.
