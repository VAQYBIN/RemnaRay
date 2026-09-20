---
---

Publish the images `compose.yaml` actually pulls.

`release.yml` and `rebuild.yml` pushed `ghcr.io/<owner>/remnaray-<image>`
while `compose.yaml` pulls `ghcr.io/remnaray/<image>` (section 7.1), so a
released deployment would have found nothing at the name it asked for. Both
workflows now publish under the name compose resolves to, and both build the
`backup` image, which every profile starts and neither workflow shipped.
