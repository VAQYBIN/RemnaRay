ARG CADDY_VERSION=2.11.4
# `caddy-ratelimit` has one tag, v0.1.0, far behind; without a version xcaddy
# builds whatever its default branch holds that day, so a rebuild could ship
# something no build before it used. Pinned to the default branch's head as of
# 2026-09-25 (a commit of 2026-06-12), which `go get` accepts as a version;
# moving it is a change of its own.
ARG CADDY_RATELIMIT_VERSION=5625512f24f6f59d6f64fb3aafe5eecff0b286db

FROM caddy:${CADDY_VERSION}-builder-alpine AS builder
ARG CADDY_RATELIMIT_VERSION

RUN xcaddy build --with "github.com/mholt/caddy-ratelimit@${CADDY_RATELIMIT_VERSION}"

FROM caddy:${CADDY_VERSION}-alpine

COPY --from=builder /usr/bin/caddy /usr/bin/caddy

RUN caddy list-modules | grep -Fx 'http.handlers.rate_limit'

# `proxy-conf` is one named volume shared with the app image, which renders
# into it as the unprivileged `node` user. Docker seeds an empty named volume
# from whichever image *creates* its container first, and that order is not the
# dependency order, so the directory has to arrive with the same owner
# whichever image wins. `node` is uid 1000 in `node:24-alpine`.
ARG APP_UID=1000

# The stock Caddyfile goes with it: seeded into the shared volume it would
# serve a placeholder site for ever after.
RUN rm -f /etc/caddy/Caddyfile && chown "${APP_UID}:${APP_UID}" /etc/caddy
