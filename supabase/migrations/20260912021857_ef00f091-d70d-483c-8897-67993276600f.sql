-- 1. Public-safe broker listing (no phone/whatsapp)
CREATE OR REPLACE VIEW public.brokers_public AS
SELECT
  p.user_id,
  p.full_name,
  p.commercial_name,
  p.username,
  p.avatar_url,
  p.bio,
  p.creci,
  p.instagram,
  p.facebook,
  p.youtube,
  p.tiktok,
  p.linkedin,
  p.created_at
FROM public.profiles p;

ALTER VIEW public.brokers_public SET (security_invoker = false);
GRANT SELECT ON public.brokers_public TO anon, authenticated;

-- 2. Contact details only for signed-in visitors
CREATE OR REPLACE FUNCTION public.get_broker_contact(_user_id uuid)
RETURNS TABLE (user_id uuid, phone text, whatsapp text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.phone, p.whatsapp
  FROM public.profiles p
  WHERE p.user_id = _user_id
    AND auth.uid() IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.get_broker_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_broker_contact(uuid) TO authenticated;

-- 3. Lock down direct reads on profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Signed-in users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.profiles FROM anon;

-- 4. Internal functions must not be callable anonymously
REVOKE ALL ON FUNCTION public.create_partnership_group(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_partnership_group(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sync_broker_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_or_create_property_group() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.increment_view_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_view_count(uuid) TO anon, authenticated;