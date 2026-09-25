-- FR-062 and section 18: `settings.fiscal.mode` is `none` or
-- `provider_receipt`. The store wrote `receipt` for "the provider issues the
-- receipt" and `manual` for "no receipt through the provider". Left as they
-- are, the new schema would reject them and the settings would fall back to
-- `none`, silently switching receipts off.
-- reversible: yes — the inverse UPDATEs (`provider_receipt` → `receipt`).
UPDATE settings
SET value = to_jsonb('provider_receipt'::text)
WHERE key = 'fiscal.mode' AND value = to_jsonb('receipt'::text);

UPDATE settings
SET value = to_jsonb('none'::text)
WHERE key = 'fiscal.mode' AND value = to_jsonb('manual'::text);

-- The wizard keeps its payments step for a resumed run.
UPDATE setup_state
SET data = jsonb_set(
  data,
  '{payments,fiscal,mode}',
  to_jsonb(CASE data #>> '{payments,fiscal,mode}' WHEN 'receipt' THEN 'provider_receipt' ELSE 'none' END)
)
WHERE data #>> '{payments,fiscal,mode}' IN ('receipt', 'manual');
