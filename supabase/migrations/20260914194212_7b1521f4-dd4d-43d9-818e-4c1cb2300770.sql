DROP POLICY IF EXISTS "Public can view broker public fields" ON public.profiles;
DROP POLICY IF EXISTS "Signed-in users can view profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

REVOKE SELECT ON public.profiles FROM anon;