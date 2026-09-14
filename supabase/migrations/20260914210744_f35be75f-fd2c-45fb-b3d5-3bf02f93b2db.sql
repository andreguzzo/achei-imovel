CREATE TABLE public.buyer_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL,
  agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  email text,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  budget_min numeric,
  budget_max numeric,
  financing_type text,
  urgency text NOT NULL DEFAULT 'pesquisando',
  status text NOT NULL DEFAULT 'ativo',
  notes text,
  last_contact_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_buyer_leads_broker ON public.buyer_leads (broker_id, status, created_at DESC);
CREATE INDEX idx_buyer_leads_agency ON public.buyer_leads (agency_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_leads TO authenticated;
GRANT ALL ON public.buyer_leads TO service_role;

ALTER TABLE public.buyer_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers manage their own buyer leads"
ON public.buyer_leads FOR ALL TO authenticated
USING (broker_id = auth.uid())
WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Agency members with sales permission view agency buyer leads"
ON public.buyer_leads FOR SELECT TO authenticated
USING (
  agency_id IS NOT NULL
  AND agency_id = public.current_agency_id()
  AND public.has_agency_permission('vendas')
);

CREATE POLICY "Agency members with sales permission update agency buyer leads"
ON public.buyer_leads FOR UPDATE TO authenticated
USING (
  agency_id IS NOT NULL
  AND agency_id = public.current_agency_id()
  AND public.has_agency_permission('vendas')
)
WITH CHECK (
  agency_id IS NOT NULL
  AND agency_id = public.current_agency_id()
  AND public.has_agency_permission('vendas')
);

CREATE TRIGGER update_buyer_leads_updated_at
BEFORE UPDATE ON public.buyer_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();