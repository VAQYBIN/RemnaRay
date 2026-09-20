# Ledger module

The ledger module is the single write boundary for internal balance movements.
Each post creates one immutable transaction and one immutable double-entry
`ledger_entries` row, updates both denormalized account balances in the same
PostgreSQL transaction, locks all participating accounts in sorted ID order,
and rejects user debits below `available()`.

`available()` subtracts held referral rewards from the user account balance.
`audit()` recomputes each account from ledger entries and reports mismatches for
the maintenance worker. All amounts are `bigint` minor units.
