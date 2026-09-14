-- 1. PLANS ------------------------------------------------------------------
UPDATE public.subscription_plans SET active = false WHERE slug IN ('free','basic','pro','premium');

INSERT INTO public.subscription_plans (slug, name, description, price_cents, max_properties, features, sort_order, highlighted, active)
VALUES
  ('owner', 'Proprietário', 'Para quem vende ou aluga o próprio imóvel', 0, 1,
   '["1 anúncio do seu imóvel","Fotos e vídeo","Contatos por WhatsApp e formulário","Simulador de financiamento"]'::jsonb,
   0, false, true),
  ('corretor', 'Corretor', 'Para o corretor autônomo com CRECI validado', 7990, NULL,
   '["Anúncios ilimitados","Selo de corretor verificado","Gestão de vendas e pipeline","Gestão de locação e cobranças","Parcerias entre corretores","Relatórios e agenda","Exportação de posts para redes sociais"]'::jsonb,
   1, true, true),
  ('imobiliaria', 'Imobiliária', 'Para equipes, com vários usuários e permissões', 15990, NULL,
   '["Tudo do plano Corretor","Vários usuários na mesma conta","Permissões por funcionalidade","Imóveis da imobiliária com corretor responsável","Convites por e-mail","Relatórios consolidados"]'::jsonb,
   2, false, true)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      price_cents = EXCLUDED.price_cents,
      max_properties = EXCLUDED.max_properties,
      features = EXCLUDED.features,
      sort_order = EXCLUDED.sort_order,
      highlighted = EXCLUDED.highlighted,
      active = true;

-- 2. PROFILES ---------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('owner','broker','agency');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('unverified','pending','manual_review','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type public.account_type NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- existing users with a CRECI already act as brokers
UPDATE public.profiles
SET account_type = 'broker',
    verification_status = 'approved',
    verified_at = coalesce(verified_at, now())
WHERE creci IS NOT NULL AND trim(creci) <> '';

-- broker role now requires an approved verification
CREATE OR REPLACE FUNCTION public.sync_broker_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.account_type IN ('broker','agency')
     AND NEW.verified_at IS NOT NULL
     AND NEW.creci IS NOT NULL AND trim(NEW.creci) <> '' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'broker'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'broker'::app_role;
  END IF;
  RETURN NEW;
END;
$function$;

-- keep signup metadata (account type) on the profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_type public.account_type := 'owner';
BEGIN
  IF (NEW.raw_user_meta_data->>'account_type') IN ('owner','broker','agency') THEN
    v_type := (NEW.raw_user_meta_data->>'account_type')::public.account_type;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, account_type)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), v_type);
  RETURN NEW;
END;
$function$;

-- 3. ONE LISTING FOR OWNER ACCOUNTS ----------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_owner_listing_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_type public.account_type;
  v_count integer;
BEGIN
  SELECT account_type INTO v_type FROM public.profiles WHERE user_id = NEW.user_id;
  IF v_type IS DISTINCT FROM 'owner' THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO v_count FROM public.properties WHERE user_id = NEW.user_id;
  IF v_count >= 1 THEN
    RAISE EXCEPTION 'owner_listing_limit';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_owner_listing_limit ON public.properties;
CREATE TRIGGER trg_owner_listing_limit
BEFORE INSERT ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_listing_limit();

-- 4. IDENTITY VERIFICATION -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.identity_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'creci',
  status public.verification_status NOT NULL DEFAULT 'pending',
  professional_doc_path text,
  personal_doc_path text,
  claimed_name text,
  claimed_creci text,
  claimed_document text,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric,
  reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.identity_verifications TO authenticated;
GRANT ALL ON public.identity_verifications TO service_role;
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own verifications select" ON public.identity_verifications;
CREATE POLICY "own verifications select" ON public.identity_verifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "own verifications insert" ON public.identity_verifications;
CREATE POLICY "own verifications insert" ON public.identity_verifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin verifications update" ON public.identity_verifications;
CREATE POLICY "admin verifications update" ON public.identity_verifications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_identity_verifications_updated_at ON public.identity_verifications;
CREATE TRIGGER update_identity_verifications_updated_at
BEFORE UPDATE ON public.identity_verifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_identity_verifications_user ON public.identity_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_status ON public.identity_verifications(status);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_creci ON public.identity_verifications(claimed_creci);

-- 5. AGENCIES --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  cnpj text,
  creci text,
  phone text,
  city text,
  state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agency_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.agency_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agencies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_invites TO authenticated;
GRANT ALL ON public.agencies TO service_role;
GRANT ALL ON public.agency_members TO service_role;
GRANT ALL ON public.agency_invites TO service_role;

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT a.id FROM public.agencies a WHERE a.owner_user_id = auth.uid()
  UNION
  SELECT m.agency_id FROM public.agency_members m
  WHERE m.user_id = auth.uid() AND m.status = 'active'
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.is_agency_owner(_agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.agencies a
    WHERE a.id = _agency_id AND a.owner_user_id = auth.uid()
  )
$function$;

CREATE OR REPLACE FUNCTION public.has_agency_permission(_perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.agencies a WHERE a.owner_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.agency_members m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND coalesce((m.permissions ->> _perm)::boolean, false)
  )
$function$;

REVOKE EXECUTE ON FUNCTION public.current_agency_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_agency_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_agency_permission(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_owner_listing_limit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_agency_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_agency_permission(text) TO authenticated;

DROP POLICY IF EXISTS "agency read" ON public.agencies;
CREATE POLICY "agency read" ON public.agencies
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid()
         OR id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid() AND status = 'active')
         OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "agency insert" ON public.agencies;
CREATE POLICY "agency insert" ON public.agencies
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "agency update" ON public.agencies;
CREATE POLICY "agency update" ON public.agencies
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "agency delete" ON public.agencies;
CREATE POLICY "agency delete" ON public.agencies
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "members read" ON public.agency_members;
CREATE POLICY "members read" ON public.agency_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_agency_owner(agency_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "members manage" ON public.agency_members;
CREATE POLICY "members manage" ON public.agency_members
  FOR ALL TO authenticated
  USING (public.is_agency_owner(agency_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_agency_owner(agency_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "invites manage" ON public.agency_invites;
CREATE POLICY "invites manage" ON public.agency_invites
  FOR ALL TO authenticated
  USING (public.is_agency_owner(agency_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_agency_owner(agency_id) OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_agencies_updated_at ON public.agencies;
CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON public.agencies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_agency_members_updated_at ON public.agency_members;
CREATE TRIGGER update_agency_members_updated_at BEFORE UPDATE ON public.agency_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. AGENCY-OWNED PROPERTIES ----------------------------------------------
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_properties_agency ON public.properties(agency_id);

DROP POLICY IF EXISTS "agency team can view properties" ON public.properties;
CREATE POLICY "agency team can view properties" ON public.properties
  FOR SELECT TO authenticated
  USING (agency_id IS NOT NULL AND agency_id = public.current_agency_id());

DROP POLICY IF EXISTS "agency team can update properties" ON public.properties;
CREATE POLICY "agency team can update properties" ON public.properties
  FOR UPDATE TO authenticated
  USING (agency_id IS NOT NULL AND agency_id = public.current_agency_id() AND public.has_agency_permission('imoveis'))
  WITH CHECK (agency_id IS NOT NULL AND agency_id = public.current_agency_id() AND public.has_agency_permission('imoveis'));
