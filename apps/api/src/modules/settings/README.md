# Settings module

The settings module is the typed registry for the `settings` table described by
section 17.3 of the specification. `SettingsService` loads a process-local cache,
validates group patches with Zod, encrypts secret values with the `RR_APP_KEY`
AES-256-GCM envelope, and publishes `rr:settings.changed` after a committed
database transaction.

The admin API is mounted at `/api/admin/v1/settings`:

- `GET /` returns grouped settings with secret values represented by `{ "set": true|false }`.
- `PUT /` validates and persists a partial group patch.
- `GET /schema` returns registry metadata and defaults.
- `GET /export` returns a safe versioned snapshot.
- `POST /import` validates and applies a versioned snapshot while preserving secret markers.

The module intentionally does not implement authentication. The auth module adds
the admin guard and actor identity in the next M1 task that needs it.
