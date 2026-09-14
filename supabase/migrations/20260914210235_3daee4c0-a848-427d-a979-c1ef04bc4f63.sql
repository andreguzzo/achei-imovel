ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS reference_code text;

CREATE SEQUENCE IF NOT EXISTS public.property_reference_seq START 1;

CREATE OR REPLACE FUNCTION public.set_property_reference_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_code IS NULL OR NEW.reference_code = '' THEN
    NEW.reference_code := 'AB-' || lpad(nextval('public.property_reference_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_property_reference_code ON public.properties;
CREATE TRIGGER trg_set_property_reference_code
BEFORE INSERT ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.set_property_reference_code();

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.properties
  WHERE reference_code IS NULL
)
UPDATE public.properties p
SET reference_code = 'AB-' || lpad(ordered.rn::text, 5, '0')
FROM ordered
WHERE ordered.id = p.id;

SELECT setval('public.property_reference_seq', GREATEST((SELECT count(*) FROM public.properties), 1));

CREATE UNIQUE INDEX IF NOT EXISTS properties_reference_code_key ON public.properties (reference_code);

REVOKE EXECUTE ON FUNCTION public.set_property_reference_code() FROM anon, authenticated;