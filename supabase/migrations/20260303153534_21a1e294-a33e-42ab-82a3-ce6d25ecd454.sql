
-- Fix RLS policies: Drop restrictive and recreate as permissive
-- contact_requests
DROP POLICY IF EXISTS "Senders can view their own requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Property owners can view requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Authenticated users can send requests" ON public.contact_requests;

CREATE POLICY "Senders can view their own requests" ON public.contact_requests FOR SELECT TO authenticated USING (auth.uid() = sender_id);
CREATE POLICY "Property owners can view requests" ON public.contact_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND user_id = auth.uid()));
CREATE POLICY "Authenticated users can send requests" ON public.contact_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- favorites
DROP POLICY IF EXISTS "Users can view their own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can add favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can remove favorites" ON public.favorites;

CREATE POLICY "Users can view their own favorites" ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add favorites" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove favorites" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- properties
DROP POLICY IF EXISTS "Active properties are viewable by everyone" ON public.properties;
DROP POLICY IF EXISTS "Users can insert their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete their own properties" ON public.properties;

CREATE POLICY "Active properties are viewable by everyone" ON public.properties FOR SELECT USING (status = 'active' OR auth.uid() = user_id);
CREATE POLICY "Users can insert their own properties" ON public.properties FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own properties" ON public.properties FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own properties" ON public.properties FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- property_images
DROP POLICY IF EXISTS "Property images are viewable by everyone" ON public.property_images;
DROP POLICY IF EXISTS "Property owners can manage images" ON public.property_images;
DROP POLICY IF EXISTS "Property owners can update images" ON public.property_images;
DROP POLICY IF EXISTS "Property owners can delete images" ON public.property_images;

CREATE POLICY "Property images are viewable by everyone" ON public.property_images FOR SELECT USING (true);
CREATE POLICY "Property owners can manage images" ON public.property_images FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND user_id = auth.uid()));
CREATE POLICY "Property owners can update images" ON public.property_images FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND user_id = auth.uid()));
CREATE POLICY "Property owners can delete images" ON public.property_images FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND user_id = auth.uid()));

-- saved_searches
DROP POLICY IF EXISTS "Users can manage their own searches" ON public.saved_searches;

CREATE POLICY "Users can manage their own searches" ON public.saved_searches FOR ALL TO authenticated USING (auth.uid() = user_id);

-- user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
