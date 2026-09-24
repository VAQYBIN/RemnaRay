#!/usr/bin/env sh
set -eu

umask 077
env_file=${1:-.env}

if [ -e "$env_file" ]; then
  printf '%s already exists; refusing to overwrite.\n' "$env_file" >&2
  exit 1
fi

printf 'Domain: '
read -r domain
printf 'ACME email: '
read -r acme_email
printf 'PostgreSQL password: '
stty -echo
read -r postgres_password
stty echo
printf '\n'

app_key=$(openssl rand -base64 32 | tr -d '\n')
internal_token=$(openssl rand -base64 32 | tr -d '\n')
setup_token=$(openssl rand -base64 24 | tr -d '\n')

cat > "$env_file" <<ENV
RR_DOMAIN=$domain
RR_ACME_EMAIL=$acme_email
RR_PROXY_PROFILE=nginx
RR_TLS_MODE=acme
RR_APP_KEY=$app_key
RR_SETUP_TOKEN=$setup_token
RR_INTERNAL_TOKEN=$internal_token
POSTGRES_PASSWORD=$postgres_password
POSTGRES_USER=remnaray
POSTGRES_DB=remnaray
VALKEY_URL=redis://valkey:6379/0
RR_TRUSTED_PROXIES=172.28.0.0/16
RR_EXTERNAL_HTTP_PORT=8080
RR_LOG_LEVEL=info
RR_PAYMENTS_MOCK=false
ENV
chmod 600 "$env_file"
printf 'Created %s with mode 600.\n' "$env_file"
printf 'RR_SETUP_TOKEN=%s\n' "$setup_token"
