ALTER VIEW public.brokers_public SET (security_invoker = true);

CREATE POLICY "Public can view broker public fields"
ON public.profiles
FOR SELECT
TO anon
USING (true);

GRANT SELECT (
  user_id, full_name, commercial_name, username, avatar_url, bio, creci,
  instagram, facebook, youtube, tiktok, linkedin, created_at
) ON public.profiles TO anon;