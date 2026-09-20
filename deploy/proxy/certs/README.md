# `custom` TLS mode

With `RR_TLS_MODE=custom` the owner brings their own certificate. Put the two
files here before `docker compose --profile nginx up -d`:

```
deploy/proxy/certs/fullchain.pem
deploy/proxy/certs/privkey.pem
```

They are mounted read-only at `/etc/nginx/certs` and named by the rendered
`tls-cert.inc`. Renewal is the owner's job: drop the new files in and run
`./rr proxy:reload`.

Neither file is tracked by git.
