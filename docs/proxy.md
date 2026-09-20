# The proxy profiles

RemnaRay ships its own reverse proxy so the owner never writes a proxy
configuration. `RR_PROXY_PROFILE` chooses one of `nginx` (the default),
`caddy` or `external`, and `./rr up` starts exactly that set of containers
(section 21.1).

## How a configuration reaches nginx

```
settings.domain.* ─┐
settings.admin.ip_allowlist ─┼─► proxy-config ──► proxy-conf volume ──► proxy-nginx
.env ─┘                 (render-proxy.js)        │
                                                 └─► rr:proxy.reload ──► proxy-reloader
```

- `proxy-config` runs `dist/tools/render-proxy.js --watch`. It renders
  `deploy/proxy/<profile>` into the shared `proxy-conf` volume, writing each
  file to a `.tmp` name and renaming it, so nginx never reads a half-written
  file. It publishes `rr:proxy.reload` only when the output actually changed.
- `proxy-reloader` is the only container with the docker socket, mounted
  read-only. On `rr:proxy.reload` it runs `nginx -t` inside `proxy-nginx` and
  reloads only if that passes, so a broken render never takes the site down.
  Every outcome is reported to `POST /api/internal/v1/system/proxy-reload-result`,
  which writes `audit_log(action=proxy.reload)` and raises the
  `proxy.config_invalid` alert on a refusal.
- certbot's `--deploy-hook` touches `/etc/letsencrypt/.renewed`; the reloader
  watches that file and reloads gracefully after a renewal.

## Templates

`deploy/proxy/nginx/` holds the whole configuration:

| File                       | Rendered as         | Notes                                            |
| -------------------------- | ------------------- | ------------------------------------------------ |
| `nginx.conf.tmpl`          | `nginx.conf`        | the main file; nginx is started with `-c` on it  |
| `site.conf.tmpl`           | `site.conf`         | the `:80` redirect and the `:443` shop           |
| `site-bootstrap.conf.tmpl` | `site.conf`         | HTTP only, while certbot has no certificate yet  |
| `tls-<mode>.inc.tmpl`      | `tls-<mode>.inc`    | http-level TLS setup; only `acme` needs anything |
| `tls-cert-<mode>.inc.tmpl` | `tls-cert.inc`      | the certificate directives of the active mode    |
| `ratelimits.inc`           | copied              | the section 19.2 zones                           |
| `security-headers.inc`     | copied              | the section 19 response headers                  |
| `common-proxy.inc`         | copied              | the upstream headers and timeouts                |
| `custom.d/*.conf`          | copied, never wiped | the owner's single extension point               |

Placeholders are `{{NAME}}` and nothing else is interpreted: `DOMAIN`,
`EXTRA_DOMAINS`, `ACME_EMAIL`, `TLS_MODE`, `DOCKER_CIDR`, `ADMIN_ALLOWLIST`,
`ADMIN_ALLOWLIST_BLOCK`, `API_DOCS_BLOCK`, `LOAD_MODULE_BLOCK`,
`EXTRA_DOMAINS_SUFFIX` and `EXTRA_DOMAINS_SERVER`.

The `extra_domains` redirect server is emitted only when there are extra
domains: an empty `server_name` would make nginx redirect every unmatched host.
The administration allowlist and the `/api/docs` denial are emitted only when
they apply, so an empty setting leaves no stray `deny all;` behind.

## TLS modes

| `RR_TLS_MODE` | Certificate                                             |
| ------------- | ------------------------------------------------------- |
| `acme`        | `nginx-module-acme` issues and renews it over HTTP-01   |
| `certbot`     | the `certbot` container, files under `/etc/letsencrypt` |
| `custom`      | the owner's files in `deploy/proxy/certs/`              |
| `none`        | `external` profile only; RemnaRay terminates no TLS     |

`acme` is the default. `load_module modules/ngx_http_acme_module.so;` is
rendered only for that mode, so the other two run on a stock nginx. OCSP
stapling is enabled for `certbot` only: the ACME module serves the certificate
through variables, which stapling does not support, and a `custom` certificate
may be self-signed.

## The image

`deploy/proxy/nginx/Dockerfile` is `nginx:1.30-alpine` plus
`nginx-module-acme`, both pinned. The module is published only by nginx.org and
only for the exact nginx patch it was built against, so a base image that moves
ahead of the module fails the build in CI rather than on the owner's server.
The base image already carries nginx.org's signing key.

## Tests

`pnpm test:m5` builds the image, asserts the module is in it, renders the
configuration for `acme`, `certbot` and `custom` and runs `nginx -t` on each,
then changes `settings.domain.main` and measures the time until the rendered
configuration carries the new domain and the reloader has reported a successful
apply — the section 25.6 budget is fifteen seconds. `nginx -t` loads the
certificate files, so the test mounts a throwaway self-signed pair for the two
modes that name real paths.

`apps/api/src/tools/proxy-render.test.ts` covers the rendering itself:
placeholder substitution, the per-mode file set, the bootstrap configuration,
the conditional blocks and the atomic write.
