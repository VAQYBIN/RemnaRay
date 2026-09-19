# Telegram bot

The bot uses grammY with a Valkey-backed per-user session (`tg:sess:<userId>`),
the 20 updates per ten seconds anti-spam limit, and ICU messages from the API.
In webhook mode the API validates Telegram's secret path and header, appends
updates to the `tg:updates` stream, and the bot acknowledges each entry only
after its middleware finishes. Entries pending for more than 60 seconds are
reclaimed with `XAUTOCLAIM`. Polling mode uses grammY runner and preserves
Telegram's pending updates when switching modes.

The bot subscribes to `rr:settings.changed`; changing `bot.*` or `domain.*`
reloads commands and the ingress transport without a process restart.

Screen handlers call the internal API facade for user state, subscriptions,
plans, invoices, referrals, and balance data. Subscription QR images are
generated in memory and sent as PNGs; no subscription or payment rules live in
the bot process.
