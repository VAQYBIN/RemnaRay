---
---

Generate the Prisma client when the workspace is installed.

`@remnaray/db` exports its types from `src/generated/prisma`, which is
generated and not committed, so on a fresh checkout every type-aware lint rule
that touches a Prisma call resolved to `any` and `pnpm lint` reported 3173
errors. A root `postinstall` generates the client, which fixes the CI quality
gate, `pnpm typecheck:e2e` and the first `pnpm lint` after a clone alike.
