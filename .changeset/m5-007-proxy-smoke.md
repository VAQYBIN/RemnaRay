---
---

Smoke both proxy profiles against a real deployment in CI, so the section 21.5
invariant — the choice of proxy changes nothing a client can see — is a fact
rather than an intention. `web` now sets the section 19.3 Content-Security-Policy
with a per-response nonce.
