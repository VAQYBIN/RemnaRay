---
'@remnaray/api': patch
'@remnaray/remnawave-sdk': patch
---

Sync the panel after every console, bot and bonus change to a subscription: the console's extension, set-plan (with the FR-023 traffic reset) and bulk extension, the bot's `/admin_extend` and an invitee's bonus days, none of which reached the panel. A ban now disables the panel user (FR-141), and ban and unban are single transactions. The panel client sends a JSON content type only with a body, which the action routes do not have.
