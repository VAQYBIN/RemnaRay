# Installing RemnaRay

One RemnaRay serves one Remnawave panel. The target is a shop that takes money
within half an hour of the first command.

## What you need

|                  | Minimum                                                                                    | Recommended           |
| ---------------- | ------------------------------------------------------------------------------------------ | --------------------- |
| CPU / RAM / disk | 1 vCPU / 2 GB / 20 GB SSD                                                                  | 2 vCPU / 4 GB / 40 GB |
| OS               | Ubuntu 22.04+ or Debian 12+, Docker Engine 27+, Compose 2.20+                              | Ubuntu 24.04 LTS      |
| Open ports       | `80/tcp`, `443/tcp`, `443/udp` (HTTP/3, optional)                                          | and `22`              |
| DNS              | an `A` record for your domain pointing at the server, TTL ≤ 300 while installing           | plus `AAAA` on IPv6   |
| Clock            | NTP — webhook signatures and TOTP both depend on it                                        |                       |
| Panel            | Remnawave 2.8.0+, reachable over HTTPS, with an API token that may manage users and squads |                       |

You also need a Telegram bot token from [@BotFather](https://t.me/BotFather).

## Install

```sh
git clone https://github.com/VAQYBIN/remnaray-astra && cd remnaray-astra
./scripts/init-env.sh
./scripts/rr up
```

`init-env.sh` asks for the domain, the ACME email and a database password,
generates `RR_APP_KEY`, `RR_INTERNAL_TOKEN` and `RR_SETUP_TOKEN`, writes `.env`
with mode `600` and prints the setup token. **Keep `.env` somewhere else as
well**: it holds the key everything else is encrypted with, and the backups
deliberately do not contain it.

`./scripts/rr up` reads the profile out of `.env`, so you never type
`--profile` yourself. First start: the images pull in one to three minutes, the
migrations take seconds, and the certificate arrives in another thirty to
sixty. Then open `https://<your domain>/setup` and follow the eight steps —
[`setup.md`](setup.md) describes each one.

When the wizard finishes, `/setup` answers 404 and `RR_SETUP_TOKEN` can be
removed from `.env`.

## The seven variables

Everything else is configured from the administration console and lives in the
database. `.env` carries only secrets and infrastructure:

| Variable            | What it is                                                   |
| ------------------- | ------------------------------------------------------------ |
| `RR_DOMAIN`         | the public domain, without a scheme                          |
| `RR_ACME_EMAIL`     | where Let's Encrypt writes about expiry (`RR_TLS_MODE=acme`) |
| `RR_PROXY_PROFILE`  | `nginx`, `caddy` or `external`                               |
| `RR_APP_KEY`        | encrypts every secret in the database — losing it loses them |
| `RR_SETUP_TOKEN`    | one-time, for the wizard                                     |
| `RR_INTERNAL_TOKEN` | how the bot and the worker authenticate to the API           |
| `POSTGRES_PASSWORD` | the database password                                        |

`.env.example` documents the optional ones with comments.

## Choosing a proxy profile

| Profile    | TLS                                           | When                                                   |
| ---------- | --------------------------------------------- | ------------------------------------------------------ |
| `nginx`    | ACME module, certbot, or your own certificate | the default; nothing else on the server uses 80/443    |
| `caddy`    | its own ACME client, or your own certificate  | you prefer Caddy, or want HTTP/3 with no extra thought |
| `external` | none — RemnaRay terminates no TLS             | something else already owns 80/443                     |

Switching is one variable and `./scripts/rr up`; nothing else changes.
[`proxy.md`](proxy.md) explains how the configuration is generated,
[`tls.md`](tls.md) covers the certificate modes, and
[`external-proxy.md`](external-proxy.md) has ready snippets for nginx on the
host, Traefik and Cloudflare.

## Hardening

- **Keep `.env` off the backups.** An archive holding both the ciphertext and
  its key protects nothing, which is why `backup` never copies it.
- **Set `RR_TRUSTED_PROXIES`** to the addresses whose `X-Forwarded-*` headers
  you believe. Behind your own proxy that is `127.0.0.1/32` or your provider's
  ranges; with the bundled proxies the compose subnet is right. Unset means
  nobody is believed, which is the safe default and not the useful one.
- **Restrict the console** with the administration allowlist in Settings →
  Security if your administrators have fixed addresses.
- **Take a backup before the first upgrade** and check you can restore it:
  [`backup.md`](backup.md).

## Afterwards

- [`admin.md`](admin.md) — the console
- [`theming.md`](theming.md) — your brand without a fork
- [`i18n.md`](i18n.md) — the texts
- [`payments/README.md`](payments/README.md) — the providers
- [`monitoring.md`](monitoring.md) — metrics and the optional dashboards
- [`upgrade.md`](upgrade.md) — staying current
- [`troubleshooting.md`](troubleshooting.md) — when something does not answer
