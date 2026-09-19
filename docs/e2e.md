# End-to-end tests

`pnpm test:e2e` builds the workspace and runs Playwright against a real stack.

## What the harness starts

`e2e/setup/stack.mjs` brings up, for the whole run:

- PostgreSQL 18 and Valkey 9.1 in Testcontainers;
- `apps/api` from `dist`, against those containers;
- `apps/web` from its standalone build, pointed at the API;
- a minimal reverse proxy that routes `/api` and `/webhooks` to the API and
  everything else to `web`, so the browser sees the single origin it sees behind
  nginx or Caddy in a deployment.

It then seeds the fixtures the specs use: an administrator with a known password
and TOTP secret, one public plan, an enabled and healthy `mock` provider, brand
and bot settings, and one customer with a balance. The resolved URLs and
fixtures are written to `e2e/.stack.json`, which the specs read.

## What the specs cover

| Spec                  | Covers                                                                                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `site.spec.ts`        | landing brand, plans and CTAs; language switch; legal pages; robots and sitemap; `public/config`, `public/theme`, `public/plans`; the `/r/<code>` referral cookie                                                                                                                      |
| `account.spec.ts`     | the middleware redirect for an anonymous visitor; `/auth/tg` sign-in from the bot; the empty subscription state; the plan list with providers and the promo field; balance and history; saving settings; sign-out; a purchase with the `mock` provider confirmed by its signed webhook |
| `admin-login.spec.ts` | a wrong password; the password + TOTP flow; the redirect of an anonymous visitor to the login screen                                                                                                                                                                                   |
| `admin.spec.ts`       | the dashboard widgets and charts; user search and the card; the journal; creating a plan; the AC-061 provider gate; the system page; a forged mutation and one with a wrong CSRF token; `Disallow: /admin`                                                                             |

## Projects

A TOTP code may be redeemed once, so the suite signs in as the administrator
exactly once, in the `setup` project (`e2e/setup/admin-auth.setup.ts`), and
stores the session in `e2e/.auth/admin.json`. The `admin` project depends on
`setup` and reuses that `storageState`; the `public` project runs
unauthenticated and contains the sign-in specs themselves.

## Running locally

The browser needs the usual Chromium system libraries. `pnpm exec playwright
install --with-deps chromium` installs both, and needs root for the system
packages — which is what CI does. Without root, download the libraries into a
prefix and point the loader at it:

```sh
pnpm exec playwright install chromium
apt-get download libnss3 libnspr4 libasound2t64
dpkg-deb -x libnss3_*.deb ./pw-libs   # and the other two
LD_LIBRARY_PATH=$PWD/pw-libs/usr/lib/x86_64-linux-gnu pnpm test:e2e
```

## CI

The `e2e` job runs after `quality`, installs Chromium with its dependencies and
typechecks the suite (`pnpm typecheck:e2e`) and runs `pnpm test:e2e`; a failed
run uploads `test-results` as an artifact.
