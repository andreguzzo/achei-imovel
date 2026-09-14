ALTER TABLE public.properties
  ADD COLUMN sold_at timestamptz,
  ADD COLUMN closed_price numeric(15,2),
  ADD COLUMN closed_pipeline_id uuid REFERENCES public.sales_pipeline(id) ON DELETE SET NULL;

CREATE INDEX idx_properties_sold_at ON public.properties(user_id, sold_at) WHERE sold_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.track_property_closing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('sold', 'rented') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.sold_at IS NULL THEN
      NEW.sold_at := now();
    END IF;
    IF NEW.closed_price IS NULL THEN
      NEW.closed_price := coalesce(NEW.sold_price, NEW.sold_by_other_price, NEW.price);
    END IF;
  ELSIF NEW.status NOT IN ('sold', 'rented') AND OLD.status IN ('sold', 'rented') THEN
    NEW.sold_at := NULL;
    NEW.closed_price := NULL;
    NEW.closed_pipeline_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_track_property_closing
BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.track_property_closing();

UPDATE public.properties
SET sold_at = coalesce(sold_at, updated_at),
    closed_price = coalesce(closed_price, sold_price, sold_by_other_price, price)
WHERE status IN ('sold', 'rented');