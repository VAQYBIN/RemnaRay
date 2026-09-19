# Auth module

The auth module implements the v1 user authentication boundary from section
9.2: Telegram Login Widget HMAC verification, five-minute `auth_date` expiry,
Valkey backed `rr_sid` sessions, one-hour HS256 bot JWTs, cookie or bearer
guards, CSRF checks, and a Valkey-backed Nest throttler storage.

Public routes are mounted under `/api/v1`; the bot token exchange is
`POST /api/internal/v1/auth/issue-token` and requires `X-Internal-Token`.
Internal and webhook routes are exempt from browser CSRF checks because they
authenticate with their own transport token or signature.
