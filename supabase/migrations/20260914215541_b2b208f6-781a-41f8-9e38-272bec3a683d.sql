-- 1) consent_log
CREATE TABLE public.consent_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  visitor_id text,
  consent_type text NOT NULL,
  document_version text NOT NULL,
  ip text,
  user_agent text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.consent_log TO authenticated;
GRANT ALL ON public.consent_log TO service_role;

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consents"
  ON public.consent_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all consents"
  ON public.consent_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_consent_log_user ON public.consent_log (user_id, created_at DESC);

-- 2) deletion_requests
CREATE TABLE public.deletion_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.deletion_requests TO authenticated;
GRANT ALL ON public.deletion_requests TO service_role;

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deletion requests"
  ON public.deletion_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can request their own deletion"
  ON public.deletion_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all deletion requests"
  ON public.deletion_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update deletion requests"
  ON public.deletion_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_deletion_requests_status ON public.deletion_requests (status, created_at DESC);

CREATE TRIGGER update_deletion_requests_updated_at
  BEFORE UPDATE ON public.deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) sensitive_access_log
CREATE TABLE public.sensitive_access_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid NOT NULL,
  record_type text NOT NULL,
  record_id uuid,
  field_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sensitive_access_log TO authenticated;
GRANT ALL ON public.sensitive_access_log TO service_role;

ALTER TABLE public.sensitive_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sensitive access log"
  ON public.sensitive_access_log FOR SELECT TO authenticated
  USING (auth.uid() = actor_id);

CREATE POLICY "Users can log their own sensitive access"
  ON public.sensitive_access_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "Admins can view all sensitive access"
  ON public.sensitive_access_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_sensitive_access_actor ON public.sensitive_access_log (actor_id, created_at DESC);

-- 4) social tokens no longer stored in plain text
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS access_token_encrypted text;
ALTER TABLE public.social_accounts DROP COLUMN IF EXISTS access_token;