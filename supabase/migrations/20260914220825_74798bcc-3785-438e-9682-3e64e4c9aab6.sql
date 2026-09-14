DROP POLICY IF EXISTS "Anyone with the link can read a report" ON public.owner_reports;
REVOKE SELECT ON public.owner_reports FROM anon;

ALTER TABLE public.owner_reports
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days');

UPDATE public.owner_reports SET share_token = encode(gen_random_bytes(24), 'hex') WHERE share_token IS NULL;

ALTER TABLE public.owner_reports
  ALTER COLUMN share_token SET DEFAULT encode(gen_random_bytes(24), 'hex'),
  ALTER COLUMN share_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS owner_reports_share_token_key ON public.owner_reports (share_token);