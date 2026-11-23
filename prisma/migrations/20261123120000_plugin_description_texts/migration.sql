-- BARY-237: a manifest's description is `{ short, about }`, in `locales` too,
-- and Barynt takes no other form. Installed manifests are rewritten once so
-- they keep validating: the short text and the page text (`about`, beside
-- the description until now) move into the description together.

-- English.
UPDATE "Plugin"
SET "manifest" = ("manifest" - 'about') || jsonb_build_object(
  'description',
  jsonb_strip_nulls(jsonb_build_object(
    'short', "manifest" -> 'description',
    'about', "manifest" -> 'about'
  ))
)
WHERE jsonb_typeof("manifest" -> 'description') = 'string';

-- The other languages; one with neither text is dropped.
UPDATE "Plugin"
SET "manifest" = jsonb_set("manifest", '{locales}', (
  SELECT COALESCE(jsonb_object_agg(lang, jsonb_build_object(
    'description',
    CASE
      WHEN jsonb_typeof(texts -> 'description') = 'object'
        THEN texts -> 'description'
      ELSE jsonb_strip_nulls(jsonb_build_object(
        'short', texts -> 'description',
        'about', texts -> 'about'
      ))
    END
  )), '{}'::jsonb)
  FROM jsonb_each("manifest" -> 'locales') AS l(lang, texts)
  WHERE texts -> 'description' IS NOT NULL OR texts -> 'about' IS NOT NULL
))
WHERE jsonb_typeof("manifest" -> 'locales') = 'object';
