
-- Auto-assign broker role when CRECI is set
CREATE OR REPLACE FUNCTION public.sync_broker_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.creci IS NOT NULL AND trim(NEW.creci) != '' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'broker'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'broker'::app_role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_broker_role
AFTER INSERT OR UPDATE OF creci ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_broker_role();
