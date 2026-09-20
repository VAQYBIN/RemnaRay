-- reversible: restore the original immutable trigger if this migration is rolled back.
DROP TRIGGER IF EXISTS payment_events_immutable ON payment_events;
DROP FUNCTION IF EXISTS payment_events_guard();

CREATE OR REPLACE FUNCTION payment_events_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF to_jsonb(NEW) - ARRAY['processed_at','process_error'] <> to_jsonb(OLD) - ARRAY['processed_at','process_error'] THEN
    RAISE EXCEPTION 'payment_events are immutable except processing markers' USING ERRCODE = '27000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payment_events_immutable BEFORE UPDATE OR DELETE ON payment_events FOR EACH ROW EXECUTE FUNCTION payment_events_guard();
