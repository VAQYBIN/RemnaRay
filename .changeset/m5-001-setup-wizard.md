---
'@remnaray/api': minor
'@remnaray/web': minor
'@remnaray/telegram-mock': patch
---

Add the initial setup wizard (TASK-M5-001)

`/api/setup/v1/*` implements the eight steps of section 17.4: the setup token
with its fifteen-minute lockout, the administrator with TOTP enrolment, the
domain, the panel and bot checks, the brand, the first plan with the trial, the
payment providers, and the launch that flips `setup.completed`, queues the panel
reconciliation and publishes the section 17.6 channels.

`SetupGuard` answers `SETUP_NOT_COMPLETED` 503 everywhere but the wizard and the
health probes while the setup is pending, and `SETUP_ALREADY_COMPLETED` 404 on
the wizard once it is done. The site's proxy redirects every path to `/setup`
until then, and `/setup` becomes a 404 page afterwards.
