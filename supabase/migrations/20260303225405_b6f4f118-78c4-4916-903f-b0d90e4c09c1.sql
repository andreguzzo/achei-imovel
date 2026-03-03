
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users can see their own messages
CREATE POLICY "Users can view own support messages"
ON public.support_messages FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can create support messages
CREATE POLICY "Users can create support messages"
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can see all support messages
CREATE POLICY "Admins can view all support messages"
ON public.support_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update support messages (reply)
CREATE POLICY "Admins can update support messages"
ON public.support_messages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
