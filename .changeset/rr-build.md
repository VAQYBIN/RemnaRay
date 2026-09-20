---
---

Build the deployment images from a source checkout.

`compose.yaml` names published images rather than build contexts, so a
checkout ahead of the last release — or a fork that has published nothing —
stopped at `error from registry: denied` with no documented way forward.
`./scripts/rr build` builds `app`, `web`, `backup` and the proxy of the active
profile under exactly the tags compose resolves to, so `up` then pulls
nothing. `docs/install.md` and `docs/troubleshooting.md` say when it is needed.
