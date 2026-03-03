
-- Private property data (owner info, notes) - only visible to property owner
CREATE TABLE public.property_private_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_name text,
  owner_phone text,
  owner_cpf text,
  owner_address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id)
);

ALTER TABLE public.property_private_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only property owner can manage private data"
  ON public.property_private_data FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE properties.id = property_private_data.property_id
        AND properties.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE properties.id = property_private_data.property_id
        AND properties.user_id = auth.uid()
    )
  );

-- Private documents table
CREATE TABLE public.property_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  document_type text DEFAULT 'other',
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only property owner can manage documents"
  ON public.property_documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Storage bucket for private property documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-documents', 'property-documents', false);

-- Storage RLS: only property owner can manage their docs
CREATE POLICY "Users can upload property documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their property documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their property documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'property-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Trigger for updated_at
CREATE TRIGGER update_property_private_data_updated_at
  BEFORE UPDATE ON public.property_private_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
