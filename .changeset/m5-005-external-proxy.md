---
'@remnaray/api': minor
---

Add the external proxy profile (TASK-M5-005)

`RR_PROXY_PROFILE=external` starts no proxy of its own; an `edge` container
publishes a single upstream on `127.0.0.1:${RR_EXTERNAL_HTTP_PORT}` so the
owner's proxy talks to one address.

The API now reads `RR_TRUSTED_PROXIES` into Fastify's `trustProxy`, so
`X-Forwarded-*` counts only from the listed addresses and a request from
anywhere else keeps its source address whatever it claims. With nothing
configured, no forwarded header is believed at all.
`GET /api/admin/v1/system` reports what the last request carried, and
`docs/external-proxy.md` has the nginx, Traefik and Cloudflare snippets.
