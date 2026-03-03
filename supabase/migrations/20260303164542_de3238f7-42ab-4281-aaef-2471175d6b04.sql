
-- Add video_url to properties
ALTER TABLE public.properties ADD COLUMN video_url text;

-- Create broker_photos table for broker photo album
CREATE TABLE public.broker_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  position integer DEFAULT 0,
  is_cover boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.broker_photos ENABLE ROW LEVEL SECURITY;

-- RLS: Everyone can view broker photos
CREATE POLICY "Broker photos are viewable by everyone"
  ON public.broker_photos FOR SELECT
  USING (true);

-- RLS: Users can manage their own photos
CREATE POLICY "Users can insert their own photos"
  ON public.broker_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own photos"
  ON public.broker_photos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photos"
  ON public.broker_photos FOR DELETE
  USING (auth.uid() = user_id);

-- Create storage bucket for broker photos
INSERT INTO storage.buckets (id, name, public) VALUES ('broker-photos', 'broker-photos', true);

-- Storage RLS policies for broker-photos bucket
CREATE POLICY "Anyone can view broker photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'broker-photos');

CREATE POLICY "Authenticated users can upload broker photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'broker-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own broker photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'broker-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own broker photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'broker-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
