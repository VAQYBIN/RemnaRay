---
---

Read the panel's paged collections instead of assuming lists.

Remnawave answers `GET /api/internal-squads` with
`{response:{total,internalSquads:[…]}}` and `GET /api/hwid/devices/{id}` with
`{response:{total,devices:[…]}}`, so unwrapping the envelope leaves a page,
not an array. Step 3 of the setup wizard failed against every real panel with
`squads.map is not a function`; `packages/remnawave-mock` had imitated the
client's assumption rather than the panel, so no test could see it.

`DELETE /api/users/{id}` answers 204 with no body, which the client parsed
unconditionally, and an error page from a proxy in front of the panel now
reaches the caller as its message instead of a JSON parse error. Verified
against the official v3.4.4 document, SHA-256 `bebc3455…f69396`.
