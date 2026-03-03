
-- 1) Enum for partnership status
CREATE TYPE public.partnership_status AS ENUM ('pending', 'active', 'declined', 'completed');

-- 2) Enum for pipeline stages
CREATE TYPE public.pipeline_stage AS ENUM (
  'lead', 'visit_scheduled', 'visited', 'proposal',
  'negotiation', 'documentation', 'closed_won', 'closed_lost'
);

-- 3) Property Groups
CREATE TABLE public.property_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  neighborhood text,
  property_type public.property_type NOT NULL DEFAULT 'apartment',
  area_approx numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Groups are viewable by everyone"
  ON public.property_groups FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert groups"
  ON public.property_groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4) Property Group Members
CREATE TABLE public.property_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.property_groups(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, property_id)
);

ALTER TABLE public.property_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members are viewable by everyone"
  ON public.property_group_members FOR SELECT
  USING (true);

CREATE POLICY "Brokers can insert their own memberships"
  ON public.property_group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = broker_id);

CREATE POLICY "Brokers can delete their own memberships"
  ON public.property_group_members FOR DELETE
  TO authenticated
  USING (auth.uid() = broker_id);

-- 5) Broker Partnerships
CREATE TABLE public.broker_partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.property_groups(id) ON DELETE CASCADE,
  broker_a_id uuid NOT NULL,
  broker_b_id uuid NOT NULL,
  status public.partnership_status NOT NULL DEFAULT 'pending',
  commission_split numeric DEFAULT 50,
  terms text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_partnerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view their own partnerships"
  ON public.broker_partnerships FOR SELECT
  TO authenticated
  USING (auth.uid() = broker_a_id OR auth.uid() = broker_b_id);

CREATE POLICY "Brokers can propose partnerships"
  ON public.broker_partnerships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = broker_a_id);

CREATE POLICY "Partners can update their partnerships"
  ON public.broker_partnerships FOR UPDATE
  TO authenticated
  USING (auth.uid() = broker_a_id OR auth.uid() = broker_b_id);

CREATE TRIGGER update_broker_partnerships_updated_at
  BEFORE UPDATE ON public.broker_partnerships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Sales Pipeline
CREATE TABLE public.sales_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  stage public.pipeline_stage NOT NULL DEFAULT 'lead',
  notes text,
  expected_close_date date,
  actual_close_date date,
  commission_value numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can manage their own pipeline"
  ON public.sales_pipeline FOR ALL
  TO authenticated
  USING (auth.uid() = broker_id)
  WITH CHECK (auth.uid() = broker_id);

CREATE TRIGGER update_sales_pipeline_updated_at
  BEFORE UPDATE ON public.sales_pipeline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) Sale Documents
CREATE TABLE public.sale_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.sales_pipeline(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_url text NOT NULL,
  document_type text DEFAULT 'other',
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can manage their own documents"
  ON public.sale_documents FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales_pipeline sp
    WHERE sp.id = sale_documents.pipeline_id AND sp.broker_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales_pipeline sp
    WHERE sp.id = sale_documents.pipeline_id AND sp.broker_id = auth.uid()
  ));

-- 8) Function to find or create property group + auto-add member
CREATE OR REPLACE FUNCTION public.find_or_create_property_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_canonical text;
  v_group_id uuid;
BEGIN
  -- Normalize address
  v_canonical := lower(trim(coalesce(NEW.address, '')));

  -- Skip if no address
  IF v_canonical = '' THEN
    RETURN NEW;
  END IF;

  -- Find existing group with same city + neighborhood + type + similar area
  SELECT pg.id INTO v_group_id
  FROM public.property_groups pg
  WHERE pg.city = NEW.city
    AND pg.state = NEW.state
    AND coalesce(pg.neighborhood, '') = coalesce(NEW.neighborhood, '')
    AND pg.property_type = NEW.property_type
    AND pg.canonical_address = v_canonical
    AND (
      pg.area_approx IS NULL
      OR NEW.area IS NULL
      OR abs(pg.area_approx - NEW.area) <= pg.area_approx * 0.1
    )
  LIMIT 1;

  -- Create group if not found
  IF v_group_id IS NULL THEN
    INSERT INTO public.property_groups (canonical_address, city, state, neighborhood, property_type, area_approx)
    VALUES (v_canonical, NEW.city, NEW.state, NEW.neighborhood, NEW.property_type, NEW.area)
    RETURNING id INTO v_group_id;
  END IF;

  -- Add member
  INSERT INTO public.property_group_members (group_id, property_id, broker_id)
  VALUES (v_group_id, NEW.id, NEW.user_id)
  ON CONFLICT (group_id, property_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 9) Trigger on properties insert
CREATE TRIGGER trg_auto_group_property
  AFTER INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.find_or_create_property_group();
