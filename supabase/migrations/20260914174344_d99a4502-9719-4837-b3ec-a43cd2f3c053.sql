CREATE TABLE public.rental_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'manual',
  provider_account_id text,
  provider_connected_at timestamptz,
  auto_charge_enabled boolean NOT NULL DEFAULT false,
  pix_key text,
  pix_key_type text,
  beneficiary_name text,
  beneficiary_city text,
  bank_name text,
  bank_agency text,
  bank_account text,
  instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_payment_settings TO authenticated;
GRANT ALL ON public.rental_payment_settings TO service_role;
ALTER TABLE public.rental_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers manage their payment settings"
  ON public.rental_payment_settings FOR ALL TO authenticated
  USING (broker_id = auth.uid()) WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Admins view payment settings"
  ON public.rental_payment_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rental_payment_settings_updated_at
  BEFORE UPDATE ON public.rental_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rental_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.rental_contracts(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL,
  name text NOT NULL,
  document_type text,
  file_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_documents TO authenticated;
GRANT ALL ON public.rental_documents TO service_role;
ALTER TABLE public.rental_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers manage their rental documents"
  ON public.rental_documents FOR ALL TO authenticated
  USING (broker_id = auth.uid()) WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Admins view rental documents"
  ON public.rental_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_rental_documents_contract ON public.rental_documents(contract_id);
CREATE INDEX idx_rental_payment_settings_broker ON public.rental_payment_settings(broker_id);