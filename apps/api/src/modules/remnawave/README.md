# Remnawave module

The module owns panel synchronization boundaries and keeps the store as the
source of truth for expiry, limits, squads, and enabled state. It records the
last panel snapshot in `panel_users`, exposes internal health/reconcile calls,
and verifies panel webhooks with the configured HMAC secret and five-minute
timestamp window.

Every panel write runs from the `panel` queue: `panel.sync-user`,
`panel.reconcile-all`, `panel.reset-traffic` (the console's "reset traffic";
a paid renewal of the same plan, section 10.4; a paid plan change, FR-023,
which carries the new limit as `ifUsedAboveBytes` and resets only when the
panel reports more used; `POST /api/users/{userId}/actions/reset-traffic`) and `panel.delete-user`
(section 19.5 anonymization, `DELETE /api/users/{userId}`; a 404 counts as
deleted, and the `panel_users` row goes with it). The worker fails a panel job
it does not know rather than reconciling.

A trial starts `provisioning` with a `panel.sync-user` queued (FR-010, EX-01).
The sync that reaches the panel makes it `active`, emits
`subscription.activated` and sends the customer `sub.activated` with the link.
Each reconciliation queues another sync for a subscription still
`provisioning`, since a sync's own retries end within about an hour; after
24 h it becomes `provisioning_failed` and the administrators get the
`provisioning.failed` alert.

The transport and mock are in `packages/remnawave-sdk` and
`packages/remnawave-mock`. ADR-010 records the v3.4.4 numeric panel identifier
incompatibilities; live compatibility remains a mapping concern for the later
panel integration work.
