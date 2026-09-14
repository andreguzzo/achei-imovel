ALTER TABLE public.property_private_data
  ADD COLUMN IF NOT EXISTS authorization_type text,
  ADD COLUMN IF NOT EXISTS authorization_start date,
  ADD COLUMN IF NOT EXISTS authorization_end date,
  ADD COLUMN IF NOT EXISTS commission_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS authorization_file_path text,
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS owner_notes text;

CREATE INDEX IF NOT EXISTS idx_property_private_data_auth_end
  ON public.property_private_data (authorization_end)
  WHERE authorization_end IS NOT NULL;