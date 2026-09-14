CREATE TABLE public.owner_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  summary text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.owner_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_reports TO authenticated;
GRANT ALL ON public.owner_reports TO service_role;

ALTER TABLE public.owner_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone with the link can read a report"
  ON public.owner_reports FOR SELECT
  USING (true);

CREATE POLICY "Brokers manage their own reports"
  ON public.owner_reports FOR ALL
  TO authenticated
  USING (auth.uid() = broker_id)
  WITH CHECK (auth.uid() = broker_id);

CREATE INDEX idx_owner_reports_property ON public.owner_reports(property_id, created_at DESC);

CREATE TRIGGER update_owner_reports_updated_at
BEFORE UPDATE ON public.owner_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Aggregated-only price comparison; never returns rows for samples smaller than 5
CREATE OR REPLACE FUNCTION public.similar_price_stats(
  _city text,
  _state text,
  _property_type property_type,
  _listing_type listing_type,
  _area numeric
)
RETURNS TABLE(sample_count bigint, avg_price numeric, median_price numeric, avg_price_per_area numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sample AS (
    SELECT p.price, p.area
    FROM public.properties p
    WHERE p.status = 'active'
      AND lower(p.city) = lower(_city)
      AND p.state = _state
      AND p.property_type = _property_type
      AND p.listing_type = _listing_type
      AND p.price > 0
      AND (
        _area IS NULL
        OR (p.area IS NOT NULL AND p.area BETWEEN _area * 0.7 AND _area * 1.3)
      )
  )
  SELECT count(*)::bigint,
         round(avg(price), 2),
         round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price)::numeric, 2),
         round(avg(price / NULLIF(area, 0)), 2)
  FROM sample
  HAVING count(*) >= 5
$$;

REVOKE ALL ON FUNCTION public.similar_price_stats(text, text, property_type, listing_type, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.similar_price_stats(text, text, property_type, listing_type, numeric) TO authenticated;