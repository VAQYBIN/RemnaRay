---
'@remnaray/api': minor
'@remnaray/worker': minor
'@remnaray/config': patch
---

Complete the TLS modes and add `tls-check` (TASK-M5-004)

The `certbot` container renews every twelve hours and its deploy flag is what
`proxy-reloader` already watches; `./rr tls:issue` performs the first issue
against the HTTP-only bootstrap configuration the renderer chooses while no
certificate exists.

`maintenance.tls-check` runs in the worker at start and daily, opens a TLS
connection to `RR_DOMAIN` from outside the API and reports the expiry, which
raises `tls.expiring` below fourteen days and feeds `GET /api/admin/v1/system`.

The environment validation now refuses every combination that cannot work:
`none` outside the external profile, and `certbot` with Caddy, which issues its
own certificates.
