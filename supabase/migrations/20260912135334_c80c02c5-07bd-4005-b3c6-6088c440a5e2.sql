CREATE OR REPLACE FUNCTION public.detach_property_group(_property_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prop public.properties;
  v_group_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_prop FROM public.properties WHERE id = _property_id AND user_id = v_uid;
  IF v_prop.id IS NULL THEN
    RAISE EXCEPTION 'property does not belong to caller';
  END IF;

  DELETE FROM public.property_group_members WHERE property_id = _property_id AND broker_id = v_uid;

  INSERT INTO public.property_groups (canonical_address, city, state, neighborhood, property_type, area_approx, primary_broker_id)
  VALUES (
    lower(trim(coalesce(v_prop.address, ''))) || ' #' || left(_property_id::text, 8),
    v_prop.city, v_prop.state, v_prop.neighborhood, v_prop.property_type, v_prop.area, v_uid
  )
  RETURNING id INTO v_group_id;

  INSERT INTO public.property_group_members (group_id, property_id, broker_id, role, status, requested_by, approved_at)
  VALUES (v_group_id, _property_id, v_uid, 'captador', 'approved', v_uid, now());

  RETURN v_group_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.detach_property_group(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.detach_property_group(uuid) TO authenticated;
