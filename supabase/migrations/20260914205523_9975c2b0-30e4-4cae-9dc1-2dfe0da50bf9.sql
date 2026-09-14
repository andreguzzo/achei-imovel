ALTER TABLE public.contact_requests
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS broker_notes text,
  ADD COLUMN IF NOT EXISTS broker_id uuid;

UPDATE public.contact_requests cr
SET broker_id = p.user_id
FROM public.properties p
WHERE p.id = cr.property_id AND cr.broker_id IS NULL;

CREATE OR REPLACE FUNCTION public.set_contact_request_broker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.broker_id IS NULL THEN
    SELECT p.user_id INTO NEW.broker_id FROM public.properties p WHERE p.id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_contact_request_broker ON public.contact_requests;
CREATE TRIGGER trg_set_contact_request_broker
BEFORE INSERT ON public.contact_requests
FOR EACH ROW EXECUTE FUNCTION public.set_contact_request_broker();

CREATE INDEX IF NOT EXISTS idx_contact_requests_broker_status_created
  ON public.contact_requests (broker_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.validate_contact_request_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('new','contacted','scheduled','converted','discarded') THEN
    RAISE EXCEPTION 'invalid contact request status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_contact_request_status ON public.contact_requests;
CREATE TRIGGER trg_validate_contact_request_status
BEFORE INSERT OR UPDATE ON public.contact_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_contact_request_status();

DROP POLICY IF EXISTS "Property owners can view requests" ON public.contact_requests;
CREATE POLICY "Property owners can view requests"
ON public.contact_requests FOR SELECT TO authenticated
USING (
  broker_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = contact_requests.property_id AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Property owners can update requests" ON public.contact_requests;
CREATE POLICY "Property owners can update requests"
ON public.contact_requests FOR UPDATE TO authenticated
USING (
  broker_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = contact_requests.property_id AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  broker_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = contact_requests.property_id AND p.user_id = auth.uid()
  )
);

GRANT SELECT, INSERT, UPDATE ON public.contact_requests TO authenticated;
GRANT ALL ON public.contact_requests TO service_role;