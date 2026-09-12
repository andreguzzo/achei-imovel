REVOKE EXECUTE ON FUNCTION public.find_property_group(text, text, text, property_type, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_group_membership(uuid, uuid, partnership_kind, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.respond_group_membership(uuid, boolean, partnership_kind, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.detach_property_group(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_property_group(text, text, text, property_type, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_group_membership(uuid, uuid, partnership_kind, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_group_membership(uuid, boolean, partnership_kind, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detach_property_group(uuid) TO authenticated;
