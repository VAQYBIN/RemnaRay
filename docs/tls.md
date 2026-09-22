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
   renderer chooses it automatically while the root-only Certbot volume has no
   entry for `<domain>` in its readable certificate list, so nginx starts even
   though there is no certificate yet and `/setup` is already reachable over
   HTTP.
2. `./rr tls:issue` explicitly overrides the renewal service entrypoint and runs
   `certbot certonly --webroot`, answering the challenge from the shared
   `certbot-webroot` volume. It uses the named domain lineage and keeps a valid
   existing certificate until expiry. The renderer is restarted, the proxy is
   reloaded, and the command waits for HTTPS readiness.
3. The certificate now exists, so the full configuration renders and
   `proxy-reloader` applies it.

Renewal: the `certbot` container runs `certbot renew` every twelve hours. The
Certbot hook updates a root-owned certificate list in the separate
`certbot-state` volume and touches `/run/remnaray/certbot/.renewed`.
`proxy-reloader` watches that marker and issues a graceful `nginx -s reload`,
so no connection is dropped. `proxy-config` sees only the certificate list,
never the private key volume.

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

## TASK-M5-004 VPS acceptance procedure

Run this exact procedure from a clean checkout on the VPS. Replace nothing in
the commands: `RR_DOMAIN` and `RR_ACME_EMAIL` are read from `.env`. The real
domain must already resolve to this VPS and ports 80/tcp, 443/tcp and 443/udp
must be reachable. The procedure is deliberately destructive in step 1 and
removes this Compose project's named volumes; take a backup first if the VPS
contains data that must be kept.

### 1. Clean starting state

```sh
test -f .env
docker compose --profile nginx --profile caddy --profile external --profile certbot down -v
PROJECT="${COMPOSE_PROJECT_NAME:-remnaray}"
docker ps -a --filter "label=com.docker.compose.project=$PROJECT" \
  --format '{{.Names}} {{.Label "com.docker.compose.service"}}'
```

Expected: the `down -v` command completes and the final command prints no
RemnaRay containers. Failure: any remaining `proxy-nginx`, `proxy-caddy`,
`proxy-config` or `certbot` row means the starting state is not clean; inspect
the project label before continuing. Do not remove a container without that
label.

### 2. nginx + Certbot bootstrap and initial issuance

```sh
sed -i 's/^RR_PROXY_PROFILE=.*/RR_PROXY_PROFILE=nginx/; s/^RR_TLS_MODE=.*/RR_TLS_MODE=certbot/' .env
DOMAIN="$(sed -n 's/^RR_DOMAIN=//p' .env)"
EMAIL="$(sed -n 's/^RR_ACME_EMAIL=//p' .env)"
test -n "$DOMAIN" && test -n "$EMAIL"
./scripts/rr up
curl -fsS --max-time 10 "http://$DOMAIN/setup" -o /dev/null
./scripts/rr tls:issue
docker compose --profile nginx --profile certbot run --rm --entrypoint certbot certbot certificates
```

Expected: `./scripts/rr up` prints the HTTP bootstrap message; before issuance,
HTTP `/setup` returns 2xx; `tls:issue` prints `certbot certonly`,
finishes successfully, prints `HTTPS is ready`, and `certificates` lists the
`$DOMAIN` lineage. Failure: `up` times out or prints service logs; HTTP `/setup`
returns 5xx; output contains `certbot renew` as the issuance command; Certbot
reports an ACME challenge, DNS, email or rate-limit error; or the certificate
list has no `$DOMAIN` entry.

The command construction proof is also covered locally by
`node --test test/rr.test.mjs`: it asserts `certonly`, `--webroot`, `-d`, `-m`,
`--cert-name` and `--keep-until-expiring`, while the service remains a separate
`certbot renew` loop.

### 3. HTTPS, private-key permissions and worker health

```sh
curl -fsS --max-time 20 "https://$DOMAIN/healthz"
openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" </dev/null 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates
docker compose --profile nginx --profile certbot run --rm --entrypoint sh certbot \
  -c 'stat -c "%U:%G %a %n" "/etc/letsencrypt/live/$RR_DOMAIN/privkey.pem"'
if grep -nE '^(RR_WORKER_ENABLED|RR_VALKEY_HOST|RR_VALKEY_PORT)=' .env; then
  echo 'unexpected undocumented worker variable' >&2
  exit 1
fi
docker compose exec worker wget -qO- http://127.0.0.1:3003/health
docker compose exec proxy-nginx nginx -t
```

Expected: `/healthz` returns `ok`; the certificate subject is `$DOMAIN` and
the issuer is a public Let's Encrypt issuer; the private key has ordinary
Certbot root-only permissions such as `root:root 600` (the exact owner/mode is
reported); no undocumented worker variable is printed; worker health returns
`{"status":"ok","service":"worker"}`; and nginx says `syntax is ok` and
`test is successful`. No `chown`, `chmod` or group change is performed.
Failure: HTTPS cannot connect, the chain is not the issued domain, the key
requires a manual permission change, any undocumented worker variable exists,
worker health fails, or `nginx -t` fails.

### 4. nginx → caddy without manual container deletion

```sh
sed -i 's/^RR_PROXY_PROFILE=.*/RR_PROXY_PROFILE=caddy/; s/^RR_TLS_MODE=.*/RR_TLS_MODE=acme/' .env
./scripts/rr down
./scripts/rr up
docker ps --filter "label=com.docker.compose.project=${PROJECT}" \
  --format '{{.Label "com.docker.compose.service"}}' | sort -u
curl -fsS --max-time 20 "https://$DOMAIN/healthz"
```

Expected: `down` completes without `-v`; `up` prints the bounded readiness
messages, including `HTTPS is ready`; the service list contains `proxy-caddy`
and contains no `proxy-nginx`; HTTPS returns `ok`. Failure: a stale
`proxy-nginx` row remains, the operator is told to delete a container, startup
returns before the HTTPS readiness message, or the request fails. The wrapper
removes only containers carrying this Compose project's proxy service labels.

### 5. caddy → nginx and stale-container confirmation

```sh
sed -i 's/^RR_PROXY_PROFILE=.*/RR_PROXY_PROFILE=nginx/; s/^RR_TLS_MODE=.*/RR_TLS_MODE=acme/' .env
./scripts/rr down
./scripts/rr up
docker ps --filter "label=com.docker.compose.project=${PROJECT}" \
  --format '{{.Label "com.docker.compose.service"}}' | sort -u
curl -fsS --max-time 20 "https://$DOMAIN/healthz"
```

Expected: the list contains `proxy-nginx`, contains no `proxy-caddy` and has no
stale proxy service; `up` reports HTTPS readiness and the request returns `ok`.
Failure: either proxy service from the old profile remains, readiness times out,
or HTTPS is unavailable. `docker ps` must be filtered by the project label as
shown; unrelated Docker projects must not appear or be changed.

### 6. Renewal is a separate path

```sh
sed -i 's/^RR_TLS_MODE=.*/RR_TLS_MODE=certbot/' .env
./scripts/rr down
./scripts/rr up
docker compose --profile nginx --profile certbot exec certbot \
  certbot renew --dry-run --webroot -w /var/www/certbot
docker compose --profile nginx --profile certbot logs --tail=100 certbot proxy-reloader
```

Expected: the renewal command reports a successful dry run or that renewal is
not yet due, and its command is `renew`; logs show no renewal error. A real
renewal deploy hook updates `certbot-state` and touches `.renewed`, then
`proxy-reloader` performs a graceful reload. Failure: the command invokes
`certonly`, the dry run fails, the hook cannot write its marker, or the
reloader reports a failed nginx test.

Record the command output and the five service-list/certificate observations in
the release evidence. This repository must not mark TASK-M5-004 VERIFIED until
both the nginx/Certbot path above and the caddy HTTPS switch have actually
passed against the real VPS/domain.
