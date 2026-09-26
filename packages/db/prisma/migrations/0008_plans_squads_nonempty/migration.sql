-- Section 8: `plans.squads` is `NOT NULL, CHECK cardinality(squads) > 0`.
-- The panel receives a plan's squads as the customer's `activeInternalSquads`,
-- so a plan without any takes every squad away from the customers who buy it.
-- NOT VALID enforces the check on every new or changed plan without failing
-- the upgrade of a shop that already has such a plan; the console marks it
-- for the owner to give it squads, after which
-- `ALTER TABLE plans VALIDATE CONSTRAINT plans_squads_nonempty` succeeds.
-- reversible: yes — ALTER TABLE plans DROP CONSTRAINT plans_squads_nonempty;
ALTER TABLE plans
  ADD CONSTRAINT plans_squads_nonempty CHECK (cardinality(squads) > 0) NOT VALID;
