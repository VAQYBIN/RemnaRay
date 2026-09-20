---
---

Publish the images on demand, and let a deployment point at them.

The smallest supported server cannot build them: on 1 vCPU and 2 GB the
Next.js build alone runs a quarter of an hour and may not finish. The new
`images` workflow builds the five images in Actions and pushes them under a
tag the owner chooses, without making a release, and `RR_REGISTRY` points a
deployment at any namespace — so a fork runs its own build in CI and pulls it.
`RR_REGISTRY` defaults to `ghcr.io/remnaray`, which is what the published
release has always been.

GHCR refuses an uppercase namespace and `github.repository_owner` keeps the
account's own spelling, so `release.yml` and `rebuild.yml` would have pushed to
a name they could not create for any owner whose login is not all lowercase.
Every workflow now lowercases it.
