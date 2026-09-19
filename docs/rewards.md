# Referrals and promo codes

## Accrual (section 15.2)

`RewardsService` runs inside the payment transaction, so a reward can never
exist without its source. The rules it applies:

- only `purchase` and `topup` sources, and `topup` only when
  `settings.referral.count_topups` is on;
- `min_source_amount_minor` filters small payments out;
- `percent_first` and `fixed_first` accrue on the first paid transaction only,
  `percent_all` accrues while `all_months` has not elapsed since attribution;
- `max_rewards_per_day` caps a referrer's daily accruals and queues an
  administrator alert when the cap is hit;
- the accrual is idempotent on `source_transaction_id`.

`hold_hours` marks a reward `held`. `ledger.available()` subtracts held rewards,
so they cannot be spent; `POST /api/internal/v1/rewards/release-held` is the
`maintenance.referral-release` cron.

Refunding the source reverses the reward: fully when the refund is full, and
proportionally rounded down otherwise. Administrators can reverse manually from
`/admin/referrals`.

The invitee bonus is granted at sign-up or on the first payment, depending on
`settings.referral.invitee_bonus_trigger`. `days` extends a live subscription or
creates one with the trial limits; `balance` posts `promo_expense → user`.

## Attribution (section 15.3)

The bot attributes `/start ref_<code>` on creation, or within 24 hours of a
sign-up that has no attribution and no payments. The site sets `rr_ref` for 30
days from `/r/<code>`, and `POST /api/v1/auth/telegram` turns that cookie into
the same start payload. A self-referral is ignored silently, and a banned
referrer's code never attributes.

## Promo codes (section 15.5)

Creating an invoice reserves the slot under a `SELECT … FOR UPDATE` on the promo
code row, so two concurrent buyers can never oversell `max_uses`: the loser gets
`PROMO_EXHAUSTED` (AC-155). The reservation carries the discount onto the
invoice, becomes `applied` and bumps `used_count` when the invoice is paid, and
is `released` when the invoice is canceled, underpaid or fails.

Codes are stored uppercase; user input is trimmed, uppercased and folded
(`O→0`, `I→1`, `L→1`), and both forms are looked up. Batch generation uses the
section 15.6 alphabet `[A-HJ-NP-Z2-9]` with an optional prefix.

Section 14.2 limits an operator to `max_uses ≤ 100` and forbids `bonus_balance`.

## Verification

`test/m4.rewards.integration.test.mjs` runs against PostgreSQL 18 and covers
AC-152 (one reward for two purchases under `percent_first`), AC-153 (reversal on
refund, balance restored, held rewards not spendable) and AC-155 (the promo code
race).
