---
'@remnaray/api': patch
---

Answer every API error with the section 9.3 envelope. A field the API refused answered 500; it is now 400 `VALIDATION_ERROR` with the path and reason of each field. Errors carry the request id the proxy logs, and a server fault carries an incident id that is logged with it.
