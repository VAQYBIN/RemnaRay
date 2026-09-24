# Remnawave module

The module owns panel synchronization boundaries and keeps the store as the
source of truth for expiry, limits, squads, and enabled state. It records the
last panel snapshot in `panel_users`, exposes internal health/reconcile calls,
and verifies panel webhooks with the configured HMAC secret and five-minute
timestamp window.

Every panel write runs from the `panel` queue: `panel.sync-user`,
`panel.reconcile-all`, `panel.reset-traffic` (the console's "reset traffic",
`POST /api/users/{userId}/actions/reset-traffic`) and `panel.delete-user`
(section 19.5 anonymization, `DELETE /api/users/{userId}`; a 404 counts as
deleted, and the `panel_users` row goes with it). The worker fails a panel job
it does not know rather than reconciling.

The transport and mock are in `packages/remnawave-sdk` and
`packages/remnawave-mock`. ADR-010 records the v3.4.4 numeric panel identifier
incompatibilities; live compatibility remains a mapping concern for the later
panel integration work.
