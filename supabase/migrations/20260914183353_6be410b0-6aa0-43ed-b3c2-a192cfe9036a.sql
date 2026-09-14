UPDATE public.subscription_plans SET stripe_product_id = 'prod_VGB2BXlzkpC8sg', stripe_price_id = 'price_1UFegKRZflpUnPI8SesjqOeu' WHERE slug = 'corretor';
UPDATE public.subscription_plans SET stripe_product_id = 'prod_VGB3Pk77HcLibm', stripe_price_id = 'price_1UFeh7RZflpUnPI8YKgv5A60' WHERE slug = 'imobiliaria';

CREATE TABLE public.billing_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  email text NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text NOT NULL UNIQUE,
  plan_slug text,
  status text NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.billing_subscriptions TO authenticated;
GRANT ALL ON public.billing_subscriptions TO service_role;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscription" ON public.billing_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all subscriptions" ON public.billing_subscriptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_billing_subscriptions_user ON public.billing_subscriptions(user_id);
CREATE INDEX idx_billing_subscriptions_email ON public.billing_subscriptions(lower(email));

CREATE TABLE public.billing_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  email text NOT NULL,
  stripe_customer_id text,
  stripe_invoice_id text UNIQUE,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_subscription_id text,
  plan_slug text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'brl',
  status text NOT NULL,
  description text,
  payment_method text,
  receipt_url text,
  livemode boolean NOT NULL DEFAULT false,
  period_start timestamptz,
  period_end timestamptz,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.billing_transactions TO authenticated;
GRANT ALL ON public.billing_transactions TO service_role;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own transactions" ON public.billing_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all transactions" ON public.billing_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_billing_transactions_updated_at
  BEFORE UPDATE ON public.billing_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_billing_transactions_occurred ON public.billing_transactions(occurred_at DESC);
CREATE INDEX idx_billing_transactions_email ON public.billing_transactions(lower(email));
CREATE INDEX idx_billing_transactions_status ON public.billing_transactions(status);