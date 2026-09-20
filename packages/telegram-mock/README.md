# Telegram mock

`TelegramMock` is a local HTTP Bot API implementation for bot tests. It
supports the methods used by RemnaRay's ingress, commands, callbacks, payment
boundary, and command registration flows. Tests can push updates, inspect
outgoing messages, configure a webhook, and inject one 403 or 429 response.
