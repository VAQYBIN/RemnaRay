# `nginx-module-acme` is published only by nginx.org, and only for the exact
# nginx patch it was built against (section 21.3). Both versions are pinned, so
# a drifting base image fails this build in CI instead of the owner's server.
ARG NGINX_VERSION=1.30.5
ARG ALPINE_VERSION=v3.24

FROM nginx:${NGINX_VERSION}-alpine

ARG ALPINE_VERSION
ARG NGINX_ACME_VERSION=1.30.5.0.4.1-r1

# The base image already ships nginx.org's signing key in /etc/apk/keys.
RUN printf 'https://nginx.org/packages/alpine/%s/main\n' "${ALPINE_VERSION}" \
      >> /etc/apk/repositories \
    && apk add --no-cache "nginx-module-acme=${NGINX_ACME_VERSION}" \
    && test -f /usr/lib/nginx/modules/ngx_http_acme_module.so \
    && rm -rf /var/cache/apk/*

# `proxy-conf` is one named volume shared with the app image, which renders
# into it as the unprivileged `node` user. Docker seeds an empty named volume
# from whichever image *creates* its container first, and that order is not the
# dependency order, so the directory has to arrive with the same owner
# whichever image wins. `node` is uid 1000 in `node:24-alpine`.
ARG APP_UID=1000

# These are the paths nginx writes into. The stock `default.conf` goes too: a
# default server seeded into the shared volume would answer for every host the
# rendered configuration does not name.
RUN mkdir -p /var/cache/nginx/acme /var/cache/nginx/proxy /var/www/certbot /etc/nginx/certs \
    && chown -R nginx:nginx /var/cache/nginx \
    && rm -f /etc/nginx/conf.d/default.conf \
    && chown "${APP_UID}:${APP_UID}" /etc/nginx/conf.d

# The rendered configuration is the whole configuration (section 21.2), so the
# stock /etc/nginx/nginx.conf is never read.
CMD ["nginx", "-c", "/etc/nginx/conf.d/nginx.conf", "-g", "daemon off;"]
