# `custom` TLS mode

With `RR_TLS_MODE=custom` the owner brings their own certificate. Put the two
files here before `docker compose --profile nginx up -d`:

```
deploy/proxy/certs/fullchain.pem
deploy/proxy/certs/privkey.pem
```

They are mounted read-only at `/etc/nginx/certs` for the nginx profile, named
by the rendered `tls-cert.inc`, and at `/certs` for the Caddy profile, named by
the rendered `tls` directive. Renewal is the owner's job: drop the new files in and run
`./rr proxy:reload`.

Neither file is tracked by git.
