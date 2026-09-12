-- Enums
CREATE TYPE public.partnership_kind AS ENUM ('co_listing', 'sale_partnership', 'non_exclusive');
CREATE TYPE public.member_status AS ENUM ('pending', 'approved', 'declined');
CREATE TYPE public.member_role AS ENUM ('captador', 'parceiro');

-- property_groups additions
ALTER TABLE public.property_groups
  ADD COLUMN IF NOT EXISTS primary_broker_id uuid,
  ADD COLUMN IF NOT EXISTS exclusive boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_partnership_only boolean NOT NULL DEFAULT false;

-- property_group_members additions
ALTER TABLE public.property_group_members
  ADD COLUMN IF NOT EXISTS role public.member_role NOT NULL DEFAULT 'parceiro',
  ADD COLUMN IF NOT EXISTS partnership_type public.partnership_kind,
  ADD COLUMN IF NOT EXISTS status public.member_status NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS commission_split numeric,
  ADD COLUMN IF NOT EXISTS terms text,
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Backfill: first member of each group becomes captador, group primary broker
WITH firsts AS (
  SELECT DISTINCT ON (group_id) group_id, broker_id
  FROM public.property_group_members
  ORDER BY group_id, joined_at ASC
)
UPDATE public.property_groups pg
SET primary_broker_id = f.broker_id
FROM firsts f
WHERE pg.id = f.group_id AND pg.primary_broker_id IS NULL;

UPDATE public.property_group_members m
SET role = 'captador'
FROM public.property_groups pg
WHERE pg.id = m.group_id AND pg.primary_broker_id = m.broker_id;

-- Mark artificial partnership groups
UPDATE public.property_groups
SET is_partnership_only = true
WHERE canonical_address LIKE 'partnership-%';

-- RLS: members visible publicly only when approved
DROP POLICY IF EXISTS "Group members are viewable by everyone" ON public.property_group_members;
CREATE POLICY "Approved members are viewable by everyone"
ON public.property_group_members FOR SELECT
USING (status = 'approved');

CREATE POLICY "Requester and captador can view pending members"
ON public.property_group_members FOR SELECT
TO authenticated
USING (
  auth.uid() = broker_id
  OR EXISTS (
    SELECT 1 FROM public.property_groups pg
    WHERE pg.id = group_id AND pg.primary_broker_id = auth.uid()
  )
);

CREATE POLICY "Captador can update memberships of own group"
ON public.property_group_members FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.property_groups pg
    WHERE pg.id = group_id AND pg.primary_broker_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.property_groups pg
    WHERE pg.id = group_id AND pg.primary_broker_id = auth.uid()
  )
);

-- Grouping trigger: captador/approved for first member, pending for later ones
CREATE OR REPLACE FUNCTION public.find_or_create_property_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_canonical text;
  v_group_id uuid;
  v_is_new boolean := false;
BEGIN
  v_canonical := lower(trim(coalesce(NEW.address, '')));
  IF v_canonical = '' THEN
    RETURN NEW;
  END IF;

  SELECT pg.id INTO v_group_id
  FROM public.property_groups pg
  WHERE pg.is_partnership_only = false
    AND pg.city = NEW.city
    AND pg.state = NEW.state
    AND coalesce(pg.neighborhood, '') = coalesce(NEW.neighborhood, '')
    AND pg.property_type = NEW.property_type
    AND pg.canonical_address = v_canonical
    AND (
      pg.area_approx IS NULL
      OR NEW.area IS NULL
      OR abs(pg.area_approx - NEW.area) <= pg.area_approx * 0.1
    )
  LIMIT 1;

  IF v_group_id IS NULL THEN
    INSERT INTO public.property_groups (canonical_address, city, state, neighborhood, property_type, area_approx, primary_broker_id)
    VALUES (v_canonical, NEW.city, NEW.state, NEW.neighborhood, NEW.property_type, NEW.area, NEW.user_id)
    RETURNING id INTO v_group_id;
    v_is_new := true;
  END IF;

  INSERT INTO public.property_group_members (group_id, property_id, broker_id, role, status, requested_by, approved_at)
  VALUES (
    v_group_id,
    NEW.id,
    NEW.user_id,
    CASE WHEN v_is_new THEN 'captador'::member_role ELSE 'parceiro'::member_role END,
    CASE
      WHEN v_is_new THEN 'approved'::member_status
      WHEN EXISTS (SELECT 1 FROM public.property_groups pg WHERE pg.id = v_group_id AND pg.primary_broker_id = NEW.user_id) THEN 'approved'::member_status
      ELSE 'pending'::member_status
    END,
    NEW.user_id,
    CASE WHEN v_is_new THEN now() ELSE NULL END
  )
  ON CONFLICT (group_id, property_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Duplicate detection for the create-listing flow
CREATE OR REPLACE FUNCTION public.find_property_group(
  _address text,
  _city text,
  _state text,
  _property_type property_type,
  _area numeric DEFAULT NULL
)
RETURNS TABLE(
  group_id uuid,
  primary_broker_id uuid,
  primary_broker_name text,
  exclusive boolean,
  member_count bigint,
  sample_property_id uuid,
  sample_title text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    pg.id,
    pg.primary_broker_id,
    pr.full_name,
    pg.exclusive,
    (SELECT count(*) FROM public.property_group_members m WHERE m.group_id = pg.id AND m.status = 'approved'),
    (SELECT m.property_id FROM public.property_group_members m WHERE m.group_id = pg.id AND m.status = 'approved' ORDER BY m.joined_at LIMIT 1),
    (SELECT p.title FROM public.property_group_members m JOIN public.properties p ON p.id = m.property_id
       WHERE m.group_id = pg.id AND m.status = 'approved' ORDER BY m.joined_at LIMIT 1)
  FROM public.property_groups pg
  LEFT JOIN public.profiles pr ON pr.user_id = pg.primary_broker_id
  WHERE auth.uid() IS NOT NULL
    AND pg.is_partnership_only = false
    AND lower(trim(coalesce(_city, ''))) = lower(trim(pg.city))
    AND lower(trim(coalesce(_state, ''))) = lower(trim(pg.state))
    AND pg.property_type = _property_type
    AND pg.canonical_address = lower(trim(coalesce(_address, '')))
    AND (
      pg.area_approx IS NULL OR _area IS NULL
      OR abs(pg.area_approx - _area) <= pg.area_approx * 0.1
    )
  LIMIT 1
$function$;

REVOKE EXECUTE ON FUNCTION public.find_property_group(text, text, text, property_type, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_property_group(text, text, text, property_type, numeric) TO authenticated;

-- Request membership on an existing consolidated listing
CREATE OR REPLACE FUNCTION public.request_group_membership(
  _group_id uuid,
  _property_id uuid,
  _partnership_type partnership_kind,
  _commission_split numeric DEFAULT NULL,
  _terms text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id = _property_id AND p.user_id = v_uid) THEN
    RAISE EXCEPTION 'property does not belong to caller';
  END IF;

  INSERT INTO public.property_group_members
    (group_id, property_id, broker_id, role, status, partnership_type, commission_split, terms, requested_by)
  VALUES
    (_group_id, _property_id, v_uid, 'parceiro', 'pending', _partnership_type, _commission_split, _terms, v_uid)
  ON CONFLICT (group_id, property_id) DO UPDATE
    SET partnership_type = EXCLUDED.partnership_type,
        commission_split = EXCLUDED.commission_split,
        terms = EXCLUDED.terms,
        status = 'pending'
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.request_group_membership(uuid, uuid, partnership_kind, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_group_membership(uuid, uuid, partnership_kind, numeric, text) TO authenticated;

-- Captador responds to a membership request
CREATE OR REPLACE FUNCTION public.respond_group_membership(
  _member_id uuid,
  _approve boolean,
  _partnership_type partnership_kind DEFAULT NULL,
  _commission_split numeric DEFAULT NULL,
  _terms text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.property_group_members m
    JOIN public.property_groups pg ON pg.id = m.group_id
    WHERE m.id = _member_id AND pg.primary_broker_id = v_uid
  ) THEN
    RAISE EXCEPTION 'only the listing broker can respond';
  END IF;

  UPDATE public.property_group_members
  SET status = CASE WHEN _approve THEN 'approved'::member_status ELSE 'declined'::member_status END,
      partnership_type = coalesce(_partnership_type, partnership_type),
      commission_split = coalesce(_commission_split, commission_split),
      terms = coalesce(_terms, terms),
      approved_at = CASE WHEN _approve THEN now() ELSE NULL END
  WHERE id = _member_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.respond_group_membership(uuid, boolean, partnership_kind, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.respond_group_membership(uuid, boolean, partnership_kind, numeric, text) TO authenticated;

-- Allow the captador to toggle exclusivity of their group
CREATE POLICY "Captador can update own group"
ON public.property_groups FOR UPDATE
TO authenticated
USING (primary_broker_id = auth.uid())
WITH CHECK (primary_broker_id = auth.uid());
