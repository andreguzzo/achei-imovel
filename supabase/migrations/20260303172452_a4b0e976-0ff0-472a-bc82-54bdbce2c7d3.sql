
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS suites integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sold_commission numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sold_by_other_price numeric DEFAULT NULL;
