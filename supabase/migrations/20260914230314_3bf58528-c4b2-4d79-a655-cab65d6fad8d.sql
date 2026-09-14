DELETE FROM public.contact_requests WHERE request_type = 'whatsapp' AND email = 'whatsapp@abitzo.lead' AND created_at < now();
DELETE FROM public.whatsapp_click_log WHERE created_at < now();