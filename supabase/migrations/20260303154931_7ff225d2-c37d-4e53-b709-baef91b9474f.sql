
-- The trigger uses SECURITY DEFINER so it bypasses RLS.
-- Remove the overly permissive INSERT policy since only the trigger should create groups.
DROP POLICY "Authenticated users can insert groups" ON public.property_groups;
