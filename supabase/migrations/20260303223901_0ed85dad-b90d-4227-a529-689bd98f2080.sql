
-- 1. Function to safely increment view_count (anyone can call, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.increment_view_count(_property_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE properties
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = _property_id;
END;
$$;

-- 2. Function to create partnership group (SECURITY DEFINER, bypasses RLS)
CREATE OR REPLACE FUNCTION public.create_partnership_group(_broker_a uuid, _broker_b uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  INSERT INTO property_groups (canonical_address, city, state)
  VALUES ('partnership-' || _broker_a || '-' || _broker_b, 'N/A', 'N/A')
  RETURNING id INTO v_group_id;
  RETURN v_group_id;
END;
$$;
