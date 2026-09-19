# Subscriptions module

The subscriptions module owns the store-side lifecycle: one live subscription
per user, one-time trial eligibility, purchase activation, renewal from the
current expiry, grace/expired transitions, and quote/apply plan changes.

Payment providers and panel synchronization call the repository after their
own confirmed events. The maintenance endpoint exposes the idempotent expiry
pass for the worker cron.
