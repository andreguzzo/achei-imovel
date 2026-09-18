ALTER VIEW public.brokers_public SET (security_invoker = false);
GRANT SELECT ON public.brokers_public TO anon, authenticated;
SELECT pg_notify('pgrst','reload schema');