#!/bin/sh
set -eu

# Only this root process and nginx have the certificate volume. Publish names,
# never certificates/keys, to the unprivileged renderer's read-only state mount.
sync_state() {
  python3 - <<'PY'
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

state = Path('/run/remnaray/certbot')
state.mkdir(parents=True, exist_ok=True)
domains = sorted(p.name for p in Path('/etc/letsencrypt/live').glob('*')
                 if (p / 'fullchain.pem').is_file() and (p / 'privkey.pem').is_file())
with NamedTemporaryFile(mode='w', dir=state, delete=False) as output:
    json.dump(domains, output)
    temporary = output.name
os.chmod(temporary, 0o644)
os.replace(temporary, state / 'certificates.json')
PY
}

case "${1:-renew-loop}" in
  sync) sync_state ;;
  deploy)
    sync_state
    touch /run/remnaray/certbot/.renewed
    ;;
  renew-loop)
    sync_state
    trap 'exit 0' TERM INT
    while :; do
      certbot renew --webroot -w /var/www/certbot \
        --deploy-hook 'sh /scripts/certbot.sh deploy' || echo 'Certbot renewal failed; retry in 12h' >&2
      sleep 12h & wait $!
    done
    ;;
  *) echo 'Usage: certbot.sh {sync|deploy|renew-loop}' >&2; exit 2 ;;
esac
