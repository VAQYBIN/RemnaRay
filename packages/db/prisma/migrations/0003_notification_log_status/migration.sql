-- Section 16.2 also records a banned recipient as `skipped`; the original CHECK
-- only allowed the three other terminal statuses.
-- reversible: restore the previous CHECK without 'skipped'.
ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_status_check;
ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_status_check
  CHECK (status IN ('sent', 'failed', 'skipped', 'skipped_blocked', 'skipped_opt_out'));
