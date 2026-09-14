ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS external_source text;

CREATE UNIQUE INDEX IF NOT EXISTS properties_user_external_ref_key
  ON public.properties(user_id, external_ref) WHERE external_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.broker_feed_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.broker_feed_tokens TO authenticated;
GRANT ALL ON public.broker_feed_tokens TO service_role;

ALTER TABLE public.broker_feed_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own feed token" ON public.broker_feed_tokens;
CREATE POLICY "Users can view their own feed token"
  ON public.broker_feed_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.ensure_feed_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT token INTO t FROM public.broker_feed_tokens WHERE user_id = auth.uid();
  IF t IS NULL THEN
    INSERT INTO public.broker_feed_tokens(user_id) VALUES (auth.uid()) RETURNING token INTO t;
  END IF;
  RETURN t;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_feed_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_feed_token() TO authenticated;