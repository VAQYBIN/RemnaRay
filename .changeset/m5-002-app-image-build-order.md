---
'@remnaray/api': patch
'@remnaray/web': patch
---

Build the workspace packages before the applications in both images

`@remnaray/domain` is consumed from its build output — by the API's OpenAPI
generation and by every `apps/web` import — so a plain `pnpm --filter … build`
left both image builds failing on a missing `dist`. Both now run their
application through Turbo, which builds the workspace dependencies first.

The web image also carries `locales/` and `themes/` into the build stage,
because prerendering reads them, and points `INTERNAL_API_URL` at a closed port
while it builds, so the fallback every prerendered page takes is refused at
once rather than left to whatever the builder's resolver does with `api`.
