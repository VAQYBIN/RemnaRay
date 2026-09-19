# Robokassa

Configure `merchantLogin`, `password1`, `password2`, and the selected hash
algorithm. `ResultURL` callbacks are form encoded; the signature uses the
merchant login, amount, invoice identifier, and password #2. A valid callback
receives `OK<InvId>`. The adapter preserves receipt data for the Robocheki
format when fiscalization is enabled.

Sources: [payment interface](https://docs.robokassa.ru/ru/pay-interface), [notifications](https://docs.robokassa.ru/ru/notifications-and-redirects).
