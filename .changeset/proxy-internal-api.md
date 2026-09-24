---
'@remnaray/api': patch
---

Stop publishing the bot's and worker's API. Both proxy profiles and the external `edge` now answer `/api/internal/*` themselves with 404 instead of forwarding it to the API, which left every internal endpoint guarded by the internal token alone; only the section 22.7 smoke stand routes it. The Caddy profile's `/api/docs` denial, which never applied because `respond` runs after `handle`, is now a `handle` as well.
