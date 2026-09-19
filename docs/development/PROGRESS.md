# RemnaRay Development Progress

## Current milestone

M0

## Current task

TASK-M0-002 — package version matrix and Renovate policy.

## Completed tasks

- TASK-M0-001 — initialized the pnpm/Turborepo monorepo, TypeScript 7.0.2
  compiler setup, ESLint 10 flat config, Prettier, Husky, lint-staged,
  commitlint, Changesets, and empty application/package shells.

## Verification

TASK-M0-001 verified on 2026-09-19:

- `pnpm install --frozen-lockfile` passed with pnpm 11.26.0.
- `pnpm test` passed: 3 repository tooling checks.
- `pnpm lint` passed with ESLint 10.10.0.
- `pnpm typecheck` passed with TypeScript 7.0.2.
- `pnpm format` passed with Prettier 3.9.8.

The supported execution environment is available: Node.js 24.21.0, pnpm
11.26.0, Docker 29.7.2, and Docker Compose v5.5.0. The initial WSL2/Docker
blocker is resolved.

## Important decisions

- The root compiler remains TypeScript 7.0.2 as required by section 6.1.
- Current `typescript-eslint` 8.70.0 rejects TypeScript 7.0.2. The shared
  `@remnaray/eslint-config` package therefore runs its parser tooling with a
  local TypeScript 6.0.3 dependency, following RISK-001's tool-only fallback;
  application code still uses the root TypeScript 7 compiler.
- `@eslint/js` is pinned to its current ESLint 10 companion version 10.0.1;
  the specification's 10.10.0 pin applies to `eslint` itself.
- pnpm added `minimumReleaseAgeExclude` entries for the pinned Turborepo
  packages while generating the lockfile; these are retained so frozen
  installs remain reproducible with pnpm 11.26.0.

## Definition of Done review

- Section 25.9: tooling acceptance checks, tests, documentation and Changeset
  are present. No application FR, locales, OpenAPI, migration or secret
  handling changed in this infrastructure task.
- Maintainer review and hosted CI/proxy-smoke remain external gates; CI and
  proxy applications are scheduled later in M0 and are not claimed as passed.

## Known blockers

None for TASK-M0-001. The corrected Git policy allowed the frozen install
and Husky activation (`core.hooksPath=.husky/_`). Lint, typecheck, all three
tests and formatting passed again on 2026-09-19. Nested `node_modules/` are
ignored and this handoff file is now included in version control.

## Next

TASK-M0-002 — add the complete section 6.1 dependency matrix, pin the latest
24.x `@types/node`, add `.npmrc`/`packageManager` checks and Renovate 24.6
exceptions, then verify `pnpm ls --depth 0` and commit the task.
