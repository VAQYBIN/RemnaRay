## What this changes

<!-- What an owner or a customer can do afterwards that they could not before,
     or what stops going wrong. One or two sentences. -->

## Why

<!-- The problem, and why this is the answer. Link the issue if there is one. -->

## Checklist

- [ ] `pnpm lint`, `pnpm format`, `pnpm typecheck`, `pnpm -r typecheck`
- [ ] `pnpm test` and `pnpm -r test`
- [ ] Tests cover the change — a unit test for a rule, an integration test for
      anything touching PostgreSQL or Valkey, a row in
      `deploy/ci/expected-status.tsv` for anything the proxy answers
- [ ] New or changed messages exist in **both** `ru` and `en`
      (`pnpm i18n-check`)
- [ ] The documentation page for the area is updated
- [ ] There is a changeset, or the change has no user-visible behaviour
- [ ] No secret, token or `.env` value appears in the diff or in a test fixture

## Anything an owner has to do

<!-- A migration that cannot be undone, a new required variable, a setting that
     changes meaning. Write "nothing" if there is nothing. -->
