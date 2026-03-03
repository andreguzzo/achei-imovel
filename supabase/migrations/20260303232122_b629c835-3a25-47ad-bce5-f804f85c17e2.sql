-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete properties
CREATE POLICY "Admins can delete all properties"
ON public.properties
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete property images (needed for cascade)
CREATE POLICY "Admins can delete property images"
ON public.property_images
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));