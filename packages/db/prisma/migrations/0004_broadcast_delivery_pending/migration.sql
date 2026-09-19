-- Section 16.4 materializes the audience as `pending` deliveries before the
-- chunks run, which the original CHECK did not allow.
-- reversible: restore the previous CHECK without 'pending'.
ALTER TABLE broadcast_deliveries DROP CONSTRAINT IF EXISTS broadcast_deliveries_status_check;
ALTER TABLE broadcast_deliveries
  ADD CONSTRAINT broadcast_deliveries_status_check
  CHECK (status IN ('pending', 'sent', 'blocked', 'failed'));
