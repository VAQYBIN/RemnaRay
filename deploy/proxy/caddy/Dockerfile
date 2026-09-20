ARG CADDY_VERSION=2.11.4

FROM caddy:${CADDY_VERSION}-builder-alpine AS builder

RUN xcaddy build --with github.com/mholt/caddy-ratelimit

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
