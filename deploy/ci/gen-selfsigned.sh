#!/usr/bin/env sh
# Section 22.7: the smoke stand terminates TLS with `RR_TLS_MODE=custom`, so it
# needs a certificate before the proxy starts. ACME cannot be used — the stand
# has no public domain — and a certificate is still required, because a smoke
# run that skipped TLS would not exercise the configuration a deployment uses.
set -eu

domain=${1:-rr.test}
out=${2:-deploy/proxy/certs}
extra=${RR_SMOKE_EXTRA_DOMAIN:-www.$domain}

mkdir -p "$out"

# Both names in one certificate: step 9 adds `extra_domains` while the stand is
# running, and the redirect server it renders has to present a valid chain too.
openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
  -keyout "$out/privkey.pem" \
  -out "$out/fullchain.pem" \
  -subj "/CN=$domain" \
  -addext "subjectAltName=DNS:$domain,DNS:$extra" \
  >/dev/null 2>&1

chmod 644 "$out/fullchain.pem"
chmod 600 "$out/privkey.pem"

printf 'Wrote a self-signed certificate for %s and %s to %s\n' "$domain" "$extra" "$out"
