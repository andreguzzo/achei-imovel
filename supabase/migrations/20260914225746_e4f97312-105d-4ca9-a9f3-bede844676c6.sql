CREATE TABLE public.whatsapp_click_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  ip text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.whatsapp_click_log TO service_role;

ALTER TABLE public.whatsapp_click_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_whatsapp_click_log_lookup ON public.whatsapp_click_log (property_id, ip, created_at DESC);