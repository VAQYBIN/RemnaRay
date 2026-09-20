# TLS

`RR_TLS_MODE` decides where the certificate comes from. The renderer, the
compose profiles and the environment validation all agree on which modes a
profile can serve, so a combination that cannot work is refused at startup
rather than producing a proxy that silently never gets a certificate.

| `RR_TLS_MODE` | `nginx` | `caddy` | `external` | Certificate                                |
| ------------- | ------- | ------- | ---------- | ------------------------------------------ |
| `acme`        | yes     | yes     | no         | issued in-process, renewed automatically   |
| `certbot`     | yes     | no      | no         | the `certbot` container, HTTP-01 webroot   |
| `custom`      | yes     | yes     | no         | the owner's files in `deploy/proxy/certs/` |
| `none`        | no      | no      | yes        | RemnaRay terminates no TLS                 |

## `acme` — the default

nginx loads `nginx-module-acme`, which answers HTTP-01 on port 80 for the same
`server_name` and keeps its account and certificates in the `proxy-acme`
volume, so they survive a container being recreated. Renewal happens thirty
days before expiry and the new certificate is picked up **without a reload**,
because the configuration names it through `$acme_certificate`. Until the first
certificate arrives the module serves a temporary self-signed one: `/healthz`
over HTTP answers immediately, HTTPS warns in the browser for about a minute.

Caddy does the same thing with its own ACME client, over HTTP-01 and
TLS-ALPN-01, storing state in `caddy-data`.

Port 80 must be open in both cases. A failure is visible in
`docker compose logs proxy-nginx | grep acme`, and the previous certificate
keeps serving until its own expiry.

## `certbot`

For builds without the module, or by preference. `RR_TLS_MODE=certbot` adds the
`certbot` profile, which `./rr up` does for you.

1. `./rr up` starts nginx with the HTTP-only bootstrap configuration. The
   renderer chooses it automatically while `/etc/letsencrypt/live/<domain>/fullchain.pem`
   does not exist, so nginx starts even though there is no certificate yet and
   `/setup` is already reachable over HTTP.
2. `./rr tls:issue` runs `certbot certonly --webroot`, answering the challenge
   from the shared `certbot-webroot` volume, then restarts `proxy-config`.
3. The certificate now exists, so the full configuration renders and
   `proxy-reloader` applies it.

Renewal: the `certbot` container runs `certbot renew` every twelve hours. Its
`--deploy-hook` touches `/etc/letsencrypt/.renewed`; `proxy-reloader` watches
that file and issues a graceful `nginx -s reload`, so no connection is dropped.

Caddy rejects this mode — it manages its own certificates — and the rejection
happens in the environment validation, not at the first request.

## `custom`

Put `fullchain.pem` and `privkey.pem` in `deploy/proxy/certs/`. nginx reads
them at `/etc/nginx/certs`, Caddy at `/certs`. Renewal is the owner's job: drop
the new files in and run `./rr proxy:reload`.

## `tls-check`

`maintenance.tls-check` runs in the worker at start and once a day. It opens a
TLS connection to `RR_DOMAIN` — from outside the API, so it sees what a visitor
would be served — and reports the expiry to
`POST /api/internal/v1/system/tls-result`. Fewer than fourteen days left, or a
host that does not answer at all, raises the `tls.expiring` alert, and
`GET /api/admin/v1/system` carries the last reading as `tls.expiresAt`,
`tls.daysLeft` and `tls.checkedAt`.

Verification is deliberately not enforced by the check: a certificate that has
already expired still has to be readable, because that is the case the check
exists for.

## Acceptance checklist

Section 25.6 accepts TASK-M5-004 on a stand with a real domain, by hand. The
repository cannot supply one, so a release performs this checklist and records
the result in its pull request:

- [ ] `RR_TLS_MODE=acme`, `RR_PROXY_PROFILE=nginx`: `./rr up`, then within a
      minute `curl -sI https://<domain>/healthz` returns 200 with a
      Let's Encrypt chain (`openssl s_client -connect <domain>:443 </dev/null`).
- [ ] `docker compose logs proxy-nginx | grep acme` shows the issue, no errors.
- [ ] `RR_TLS_MODE=certbot`: `./rr up` serves `/setup` over HTTP before any
      certificate exists; `./rr tls:issue` obtains one; `https://<domain>/`
      answers afterwards without a manual restart.
- [ ] `touch` the deploy flag in `certbot-certs` and confirm `proxy-reloader`
      logs a reload and the nginx master pid is unchanged.
- [ ] `RR_PROXY_PROFILE=caddy`, `RR_TLS_MODE=acme`: the same two checks pass.
- [ ] `RR_PROXY_PROFILE=caddy`, `RR_TLS_MODE=certbot` refuses to start with a
      message naming `RR_TLS_MODE`.
- [ ] `GET /api/admin/v1/system` shows `tls.daysLeft` near 90 after an issue.
