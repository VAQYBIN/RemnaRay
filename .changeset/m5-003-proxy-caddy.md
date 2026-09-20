---
'@remnaray/api': minor
---

Add the Caddy proxy profile (TASK-M5-003)

`deploy/proxy/caddy/Caddyfile.tmpl` is the section 21.4 configuration, rendered
by the same `render-proxy` into the same `proxy-conf` volume and applied by the
same `proxy-reloader`, so the two profiles differ only in which containers run.

`ghcr.io/remnaray/caddy` carries `caddy-ratelimit` with the nginx zone numbers.
An owner who prefers the official image gets a Caddyfile without the
`rate_limit` blocks — the documented degradation — and
`GET /api/admin/v1/system` now reports it. Caddy manages its own certificates,
so the profile supports `acme` and `custom` and refuses `certbot`.
