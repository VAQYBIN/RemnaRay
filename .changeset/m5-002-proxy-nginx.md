---
'@remnaray/api': minor
---

Add the nginx proxy profile (TASK-M5-002)

`ghcr.io/remnaray/nginx` is `nginx:1.30-alpine` plus a pinned
`nginx-module-acme`, and `deploy/proxy/nginx/` holds the section 21.3
configuration as templates. `dist/tools/render-proxy.js` renders them from
`settings.domain.*`, `settings.admin.ip_allowlist` and `.env` into the shared
`proxy-conf` volume, atomically, and publishes `rr:proxy.reload` only when the
output changed. `dist/tools/proxy-reloader.js` — the only container with the
docker socket — validates with `nginx -t` before reloading, so a broken render
never takes the site down, and reports every apply to
`POST /api/internal/v1/system/proxy-reload-result`.
