# When something does not answer

Organised by what you see. Every command assumes you are in the repository
directory on the server.

## The certificate never arrives

`https://<domain>/` warns, or the connection is refused, more than two minutes
after `./scripts/rr up`.

```sh
docker compose logs proxy-nginx | grep acme     # or: logs proxy-caddy
```

- **Port 80 is closed.** Both ACME paths answer the challenge on 80. A firewall
  or another process holding it stops issuance, and nothing else reports why.
  `ss -lntp | grep ':80'`.
- **DNS does not point here yet.** `dig +short <domain>` must return this
  server. Let's Encrypt resolves the name itself; a record that is correct in
  your registrar but not yet propagated fails.
- **The rate limit.** Let's Encrypt allows five failures per account, per
  hostname, per hour. After a run of failures, wait an hour rather than
  retrying.
- **A module-less image.** `RR_TLS_MODE=certbot` is the path for builds without
  `nginx-module-acme`: `./scripts/rr tls:issue` obtains the first certificate
  while nginx serves `/setup` over HTTP.

Until a certificate exists, the `acme` mode serves a temporary self-signed one,
so a browser warning in the first minute is expected. [`tls.md`](tls.md) has
the full matrix.

## The bot says nothing

- **Check the mode.** Settings → Bot shows whether the webhook is registered
  and what Telegram last reported. A webhook whose URL is wrong is silent, not
  an error.
- **The webhook needs a public HTTPS URL.** Telegram will not deliver to an IP
  address or to a self-signed certificate. On a stand, switch the bot to long
  polling.
- **The token changed.** The bot reloads on a settings change; if it does not,
  `docker compose logs bot | tail`.
- **Nothing is consuming the queue.** The bot answers `/health` on `:3002` and
  reports `ready`. A bot that is `ready: false` has no token or cannot reach
  the API.

```sh
docker compose logs bot --tail 50
docker compose exec -T api wget -qO- http://127.0.0.1:3000/api/v1/health/ready
```

## The panel answers 401

Settings → Panel → **Check** says what the panel said.

- The API token was revoked, or was copied with a trailing space.
- The token belongs to a user who may not manage users and squads.
- The panel is behind Cloudflare Access or basic auth: put the extra headers in
  `settings.panel.extra_headers` rather than in front of the whole deployment.

A panel that is unreachable rather than refusing shows as `PANEL_UNAVAILABLE`.
Purchases still complete; the subscription is queued and activates when the
panel returns.

## Webhooks do not arrive

- **Look for the event first.** Administration → Payments → the invoice shows
  every event the provider sent, including ones whose signature failed.
- **The URL registered with the provider** must be
  `https://<domain>/webhooks/<provider>`, over HTTPS, with no trailing slash.
- **Not a POST.** Both proxy profiles answer a non-POST webhook with 405; some
  provider dashboards "test" with a GET and report it as a failure.
- **The signature secret** in the console must match the one in the provider's
  dashboard. A mismatch records the event with `signatureOk: false` and answers
  400, which is visible in the same list.
- **An IP allowlist.** YooKassa is verified against its published ranges as
  well as by a second status request; a webhook from outside them is refused on
  purpose.

## Behind my own proxy, everything thinks it is HTTP

Settings → System shows, for the last request, the client address the API
resolved and whether `X-Forwarded-For` and `X-Forwarded-Proto` arrived. If they
did not, or the address is your proxy rather than the visitor:

- Your proxy must send `Host`, `X-Forwarded-For`, `X-Real-IP` and
  `X-Forwarded-Proto: https`.
- `RR_TRUSTED_PROXIES` must contain your proxy's address — `127.0.0.1/32` on
  the same host, or your provider's ranges. **Unset means no header is
  believed**, which is safe and looks exactly like a misconfigured proxy.
- Behind Cloudflare, add its ranges and let the API read `CF-Connecting-IP`.

[`external-proxy.md`](external-proxy.md) has snippets for nginx, Traefik and
Cloudflare.

## A container will not start

```sh
docker compose ps
docker compose logs <service> --tail 100
```

- **Nothing starts and every image says `error from registry: denied`.** The
  images are not published for this checkout. Build them once with
  `./scripts/rr build` — [`install.md`](install.md#running-from-a-source-checkout)
  explains when that is needed.
- **`postgres` refuses to start** after an upgrade of the image across a major
  version. PostgreSQL 18 keeps its data in a version-specific directory; the
  volume belongs at `/var/lib/postgresql`, which is what `compose.yaml` mounts.
  A volume from an older layout needs `pg_upgrade` or a dump and restore.
- **`migrate` exits non-zero.** Its log names the migration. Nothing else
  starts, which is deliberate.
- **`proxy-nginx` is unhealthy** with `nginx.conf` not found: `proxy-config`
  has not rendered yet. Its own log says why — usually that it cannot reach
  PostgreSQL.

## Queues fill up and nothing is delivered

Settings → System lists every queue and its depth, and the optional monitoring
profile graphs them. A queue with a growing `waiting` count and no `completed`
means the worker is not running:

```sh
docker compose logs worker --tail 50
docker compose exec -T worker wget -qO- http://127.0.0.1:3003/health
```

## A setting in the console does not take effect

Almost everything applies within five seconds without a restart. The exceptions
are the variables in `.env`, which are read at start: the domain, the proxy
profile, the TLS mode and the keys. Change those and run `./scripts/rr up`.

A domain change re-renders the proxy configuration and reloads it within
fifteen seconds; Settings → Journal records the result, including a
configuration that was refused.

## Still stuck

Open an issue with the version, the proxy profile and the log lines around the
problem. Please redact tokens and anything from `.env`, and send security
problems through [`SECURITY.md`](../SECURITY.md) instead.
