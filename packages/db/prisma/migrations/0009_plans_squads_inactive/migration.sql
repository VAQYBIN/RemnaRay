-- Follow-up to 0008. PostgreSQL checks a NOT VALID constraint on every later
-- UPDATE of a row, so a plan that already had no squads could no longer be
-- deleted, deactivated or reordered, while it stayed on sale and took every
-- squad away from its buyers. Such a plan is taken off sale here, and the
-- check allows empty squads only on a plan that is inactive or deleted: it can
-- never be sold, and the owner can still give it squads and activate it.
-- reversible: yes — UPDATE plans SET is_active = true WHERE id IN (the plans
-- listed by this migration's NOTICE); restore 0008's constraint.
DO $$
DECLARE
  slugs text;
BEGIN
  SELECT string_agg(slug, ', ') INTO slugs
  FROM plans WHERE cardinality(squads) = 0 AND is_active AND deleted_at IS NULL;
  IF slugs IS NOT NULL THEN
    RAISE NOTICE 'plans without squads taken off sale: %', slugs;
  END IF;
END $$;

UPDATE plans SET is_active = false, updated_at = now()
WHERE cardinality(squads) = 0 AND is_active AND deleted_at IS NULL;

ALTER TABLE plans DROP CONSTRAINT plans_squads_nonempty;
ALTER TABLE plans ADD CONSTRAINT plans_squads_nonempty
  CHECK (cardinality(squads) > 0 OR NOT is_active OR deleted_at IS NOT NULL);
