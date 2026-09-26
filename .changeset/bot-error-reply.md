---
'@remnaray/bot': patch
---

Answer and log failed bot updates (FR-127). The bot handles updates with `bot.handleUpdate`, which throws to its caller instead of calling `bot.catch`, and the stream consumer discarded the error: nothing was logged, the customer saw no reply, and the update was run again every minute. A failed update now goes to the error handler, which logs the cause with the incident id the customer is shown, and is acknowledged.
