-- Freies Vermögen als Haushaltswert (Pooling)
-- Bestehende Paar-Profile: Partner-Startkapital in primary (profiles.free_assets)
-- summieren und den Partner-Wert auf 0 setzen. Sparquote bleibt pro Person.
--
-- Idempotent: der WHERE-Guard sorgt dafür, dass die Migration nach dem ersten
-- Lauf ein No-op ist (kein wiederholtes Aufsummieren).
UPDATE profiles
SET
  free_assets = COALESCE(free_assets, 0)
    + COALESCE((partner_profile->>'free_assets')::numeric, 0),
  partner_profile = jsonb_set(
    partner_profile,
    '{free_assets}',
    '0'::jsonb,
    true
  )
WHERE planning_mode = 'couple'
  AND partner_profile IS NOT NULL
  AND COALESCE((partner_profile->>'free_assets')::numeric, 0) <> 0;
