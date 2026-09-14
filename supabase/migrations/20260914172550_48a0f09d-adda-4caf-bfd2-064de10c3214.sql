-- Enums
CREATE TYPE public.rental_contract_status AS ENUM ('draft', 'active', 'notice', 'ended');
CREATE TYPE public.rental_charge_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.rental_guarantee AS ENUM ('none', 'fiador', 'caucao', 'seguro_fianca', 'titulo_capitalizacao');
CREATE TYPE public.rental_index AS ENUM ('none', 'igpm', 'ipca', 'inpc');
CREATE TYPE public.rental_inspection_type AS ENUM ('entrada', 'saida');

-- Contracts
CREATE TABLE public.rental_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  property_label text,
  tenant_name text NOT NULL,
  tenant_email text,
  tenant_phone text,
  tenant_cpf text,
  owner_name text,
  owner_phone text,
  rent_amount numeric NOT NULL,
  condo_fee numeric NOT NULL DEFAULT 0,
  iptu numeric NOT NULL DEFAULT 0,
  other_charges numeric NOT NULL DEFAULT 0,
  admin_fee_percent numeric NOT NULL DEFAULT 0,
  adjustment_index public.rental_index NOT NULL DEFAULT 'igpm',
  next_adjustment_date date,
  guarantee_type public.rental_guarantee NOT NULL DEFAULT 'none',
  guarantee_details text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  due_day integer NOT NULL DEFAULT 5,
  status public.rental_contract_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_contracts TO authenticated;
GRANT ALL ON public.rental_contracts TO service_role;
ALTER TABLE public.rental_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers manage their rental contracts"
  ON public.rental_contracts FOR ALL TO authenticated
  USING (broker_id = auth.uid()) WITH CHECK (broker_id = auth.uid());
CREATE POLICY "Admins manage all rental contracts"
  ON public.rental_contracts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rental_contracts_updated_at
  BEFORE UPDATE ON public.rental_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Charges
CREATE TABLE public.rental_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.rental_contracts(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL,
  competence date NOT NULL,
  due_date date NOT NULL,
  rent_amount numeric NOT NULL DEFAULT 0,
  charges_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric,
  paid_at date,
  status public.rental_charge_status NOT NULL DEFAULT 'pending',
  admin_fee_amount numeric NOT NULL DEFAULT 0,
  payout_amount numeric NOT NULL DEFAULT 0,
  payment_link text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, competence)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_charges TO authenticated;
GRANT ALL ON public.rental_charges TO service_role;
ALTER TABLE public.rental_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers manage their rental charges"
  ON public.rental_charges FOR ALL TO authenticated
  USING (broker_id = auth.uid()) WITH CHECK (broker_id = auth.uid());
CREATE POLICY "Admins manage all rental charges"
  ON public.rental_charges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rental_charges_updated_at
  BEFORE UPDATE ON public.rental_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_rental_charges_broker_due ON public.rental_charges (broker_id, due_date);
CREATE INDEX idx_rental_charges_contract ON public.rental_charges (contract_id);

-- Inspections
CREATE TABLE public.rental_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.rental_contracts(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL,
  inspection_type public.rental_inspection_type NOT NULL,
  inspection_date date NOT NULL DEFAULT current_date,
  notes text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_inspections TO authenticated;
GRANT ALL ON public.rental_inspections TO service_role;
ALTER TABLE public.rental_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers manage their rental inspections"
  ON public.rental_inspections FOR ALL TO authenticated
  USING (broker_id = auth.uid()) WITH CHECK (broker_id = auth.uid());
CREATE POLICY "Admins manage all rental inspections"
  ON public.rental_inspections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rental_inspections_updated_at
  BEFORE UPDATE ON public.rental_inspections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generate monthly charges for a contract, from a given month up to end_date
CREATE OR REPLACE FUNCTION public.generate_rental_charges(_contract_id uuid, _from date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  c public.rental_contracts;
  v_month date;
  v_last date;
  v_charges numeric;
  v_total numeric;
  v_due date;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO c FROM public.rental_contracts WHERE id = _contract_id;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'contract not found';
  END IF;
  IF c.broker_id <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  v_month := date_trunc('month', coalesce(_from, c.start_date))::date;
  v_last := date_trunc('month', c.end_date)::date;
  v_charges := coalesce(c.condo_fee, 0) + coalesce(c.iptu, 0) + coalesce(c.other_charges, 0);
  v_total := coalesce(c.rent_amount, 0) + v_charges;

  WHILE v_month <= v_last LOOP
    v_due := v_month + (least(c.due_day, extract(day from (v_month + interval '1 month' - interval '1 day'))::int) - 1);

    INSERT INTO public.rental_charges (
      contract_id, broker_id, competence, due_date,
      rent_amount, charges_amount, total_amount,
      admin_fee_amount, payout_amount
    ) VALUES (
      c.id, c.broker_id, v_month, v_due,
      coalesce(c.rent_amount, 0), v_charges, v_total,
      round(coalesce(c.rent_amount, 0) * coalesce(c.admin_fee_percent, 0) / 100, 2),
      coalesce(c.rent_amount, 0) - round(coalesce(c.rent_amount, 0) * coalesce(c.admin_fee_percent, 0) / 100, 2)
    )
    ON CONFLICT (contract_id, competence) DO NOTHING;

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;

    v_month := (v_month + interval '1 month')::date;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_rental_charges(uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION public.generate_rental_charges(uuid, date) TO authenticated;