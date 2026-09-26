# Customer support in the bot

«Поддержка» in the bot (FR-124) shows `brand.support_contact` (a `@username`
or a URL). When `brand.support_forward_chat_id` names the operators' chat, the
customer can also write a message there, and an operator's answer comes back
to the customer in the bot, in their language.

## The operators' chat

Create a Telegram group for the operators, add the shop's bot and set the
group's id (`-100…`) in «Настройки» → «brand» → `support_forward_chat_id`.

- **A forum supergroup** (topics enabled) gives every customer a topic of their
  own, named after them with their Telegram id. Everything an operator writes in
  that topic goes to the customer. The bot must be an administrator with the
  «Управление темами» right; bot administrators receive every message of the
  group, which is how the answers reach it. Without the right, messages arrive
  in the general topic and the administrators get a `support.topics` alert.
- **A plain group**: each message arrives as `#support <id> @username` and the
  operator answers with Telegram's «Ответить» on it. The bot sees such replies
  even in privacy mode. An answer works for 30 days after the question.

If the customer blocked the bot, the operator gets «Не доставлено покупателю»
in reply. Only text is relayed. A customer whose message could not be
delivered to the operators is told so instead of «передано».

The links between topics, messages and customers are kept in Valkey
(`rr:support:*`).
