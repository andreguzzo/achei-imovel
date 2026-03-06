-- Admin policies for deleting user-related data during user/property deletion

-- Admins can delete any favorites (for user/property cleanup)
CREATE POLICY "Admins can delete any favorites"
ON public.favorites FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete any saved searches (for user cleanup)
CREATE POLICY "Admins can delete any saved searches"
ON public.saved_searches FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete any contact requests (for property cleanup)
CREATE POLICY "Admins can delete any contact requests"
ON public.contact_requests FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete any property documents (for property cleanup)
CREATE POLICY "Admins can delete any property documents"
ON public.property_documents FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete any property private data (for property cleanup)
CREATE POLICY "Admins can delete any property private data"
ON public.property_private_data FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete any property group members (for property cleanup)
CREATE POLICY "Admins can delete any property group members"
ON public.property_group_members FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete any property images
CREATE POLICY "Admins can delete any property images"
ON public.property_images FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));
