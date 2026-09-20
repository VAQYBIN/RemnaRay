---
---

Build what the workspace tests import.

A package's tests import its dependencies through their `exports`, which point
at `dist`. Turbo's `test` task depended on `^test`, which builds nothing, and
CI ran `pnpm -r test` — so on a checkout that has never been built,
`@remnaray/queues` could not resolve `@remnaray/db` and its suite failed to
load. The task now depends on `^build`, and CI, `CONTRIBUTING.md` and
`scripts/ci-local.sh` run the workspace tests through turbo.

Two suites lost a test file each and the totals fell by two: vitest had been
collecting the compiled copies in `dist` as extra suites, which stopped when
those packages began excluding tests from their builds.
