CREATE TABLE public.social_post_exports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  format text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_exports TO authenticated;
GRANT ALL ON public.social_post_exports TO service_role;
ALTER TABLE public.social_post_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers manage own social exports"
ON public.social_post_exports FOR ALL TO authenticated
USING (broker_id = auth.uid())
WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Admins view social exports"
ON public.social_post_exports FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete social exports"
ON public.social_post_exports FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_social_post_exports_property ON public.social_post_exports(property_id);
CREATE INDEX idx_social_post_exports_broker ON public.social_post_exports(broker_id);

CREATE TABLE public.social_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text NOT NULL,
  username text,
  page_id text,
  access_token text,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_id, provider, external_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers manage own social accounts"
ON public.social_accounts FOR ALL TO authenticated
USING (broker_id = auth.uid())
WITH CHECK (broker_id = auth.uid());