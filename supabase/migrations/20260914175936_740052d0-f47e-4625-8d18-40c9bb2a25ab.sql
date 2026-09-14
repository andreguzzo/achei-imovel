ALTER TABLE public.rental_payment_settings
  ADD COLUMN IF NOT EXISTS api_key text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS webhook_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '');

ALTER TABLE public.rental_charges
  ADD COLUMN IF NOT EXISTS provider_charge_id text,
  ADD COLUMN IF NOT EXISTS pix_payload text,
  ADD COLUMN IF NOT EXISTS boleto_url text;

CREATE UNIQUE INDEX IF NOT EXISTS rental_payment_settings_webhook_token_key
  ON public.rental_payment_settings (webhook_token);

CREATE OR REPLACE FUNCTION public.rental_daily_maintenance()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.rental_contracts;
  v_month date := date_trunc('month', current_date)::date;
  v_next date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_charges numeric;
  v_total numeric;
  v_due date;
  v_m date;
  v_count integer := 0;
BEGIN
  FOR c IN SELECT * FROM public.rental_contracts WHERE status = 'active' LOOP
    v_charges := coalesce(c.condo_fee, 0) + coalesce(c.iptu, 0) + coalesce(c.other_charges, 0);
    v_total := coalesce(c.rent_amount, 0) + v_charges;

    FOREACH v_m IN ARRAY ARRAY[v_month, v_next] LOOP
      CONTINUE WHEN v_m < date_trunc('month', c.start_date)::date
                 OR v_m > date_trunc('month', c.end_date)::date;

      v_due := v_m + (least(c.due_day, extract(day from (v_m + interval '1 month' - interval '1 day'))::int) - 1);

      INSERT INTO public.rental_charges (
        contract_id, broker_id, competence, due_date,
        rent_amount, charges_amount, total_amount,
        admin_fee_amount, payout_amount
      ) VALUES (
        c.id, c.broker_id, v_m, v_due,
        coalesce(c.rent_amount, 0), v_charges, v_total,
        round(coalesce(c.rent_amount, 0) * coalesce(c.admin_fee_percent, 0) / 100, 2),
        coalesce(c.rent_amount, 0) - round(coalesce(c.rent_amount, 0) * coalesce(c.admin_fee_percent, 0) / 100, 2)
      )
      ON CONFLICT (contract_id, competence) DO NOTHING;

      IF FOUND THEN
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.rental_charges
  SET status = 'overdue'
  WHERE status = 'pending' AND due_date < current_date;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rental_daily_maintenance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rental_daily_maintenance() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'rental-daily-maintenance',
  '10 6 * * *',
  $$SELECT public.rental_daily_maintenance();$$
);