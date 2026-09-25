---
'@remnaray/api': patch
---

`proxy-reloader` keeps a reload result the API refused, as it refuses every internal call until the setup wizard finishes, and sends it again until it reaches `audit_log`; a refused configuration's `proxy.config_invalid` alert is no longer lost.
