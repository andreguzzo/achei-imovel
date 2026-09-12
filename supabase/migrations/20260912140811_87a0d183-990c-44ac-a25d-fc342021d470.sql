-- 1. subscription_plans
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  max_properties integer,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  stripe_product_id text,
  stripe_price_id text,
  sort_order integer NOT NULL DEFAULT 0,
  highlighted boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert plans"
  ON public.subscription_plans FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update plans"
  ON public.subscription_plans FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete plans"
  ON public.subscription_plans FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.subscription_plans (slug, name, description, price_cents, max_properties, features, stripe_product_id, stripe_price_id, sort_order, highlighted, active) VALUES
  ('free', 'Gratuito', 'Para começar a anunciar', 0, 3, '["Até 3 imóveis ativos","Dashboard básico","Agenda de compromissos"]'::jsonb, NULL, NULL, 0, false, true),
  ('basic', 'Básico', 'Para corretores autônomos', 4990, 10, '["Até 10 imóveis ativos","Dashboard completo","Pipeline de vendas","Relatórios"]'::jsonb, 'prod_U57EjwvR20lpGK', 'price_1T6wzyRZflpUnPI8eHlq6pUi', 1, false, true),
  ('pro', 'Pro', 'Para quem quer escalar', 9990, 50, '["Até 50 imóveis ativos","Tudo do Básico","Parcerias entre corretores","Prioridade no suporte"]'::jsonb, 'prod_U57EjdIuFxyNGv', 'price_1T6x0FRZflpUnPI81C5BzNFT', 2, true, true),
  ('premium', 'Premium', 'Para imobiliárias e equipes', 19990, NULL, '["Imóveis ilimitados","Tudo do Pro","Destaques nas buscas","Suporte prioritário 24h"]'::jsonb, 'prod_U57EV6GbFjgqCP', 'price_1T6x0VRZflpUnPI816Ekf7tf', 3, false, true);

-- 2. subscription_overrides
CREATE TABLE public.subscription_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_slug text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  source text NOT NULL DEFAULT 'manual',
  cancelled_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_overrides TO authenticated;
GRANT ALL ON public.subscription_overrides TO service_role;

ALTER TABLE public.subscription_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own override"
  ON public.subscription_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert overrides"
  ON public.subscription_overrides FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update overrides"
  ON public.subscription_overrides FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete overrides"
  ON public.subscription_overrides FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscription_overrides_updated_at
  BEFORE UPDATE ON public.subscription_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. subscription_audit_log
CREATE TABLE public.subscription_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  target_email text,
  admin_id uuid,
  action text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_audit_log TO authenticated;
GRANT ALL ON public.subscription_audit_log TO service_role;

ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.subscription_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_subscription_audit_log_target ON public.subscription_audit_log (target_user_id, created_at DESC);

-- 4. account suspension
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;