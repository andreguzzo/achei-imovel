CREATE TABLE public.pipeline_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id uuid NOT NULL REFERENCES public.sales_pipeline(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL,
  activity_type text NOT NULL,
  description text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_activities TO authenticated;
GRANT ALL ON public.pipeline_activities TO service_role;

ALTER TABLE public.pipeline_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can manage their own pipeline activities"
ON public.pipeline_activities FOR ALL TO authenticated
USING (auth.uid() = broker_id)
WITH CHECK (auth.uid() = broker_id);

CREATE INDEX idx_pipeline_activities_pipeline ON public.pipeline_activities(pipeline_id, occurred_at DESC);
CREATE INDEX idx_pipeline_activities_broker ON public.pipeline_activities(broker_id);

ALTER TABLE public.sales_pipeline
  ADD COLUMN next_action text,
  ADD COLUMN next_action_date date,
  ADD COLUMN last_activity_at timestamptz;

CREATE INDEX idx_sales_pipeline_next_action ON public.sales_pipeline(broker_id, next_action_date) WHERE next_action_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_pipeline_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sales_pipeline
  SET last_activity_at = GREATEST(coalesce(last_activity_at, NEW.occurred_at), NEW.occurred_at)
  WHERE id = NEW.pipeline_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_pipeline_last_activity
AFTER INSERT ON public.pipeline_activities
FOR EACH ROW EXECUTE FUNCTION public.touch_pipeline_last_activity();