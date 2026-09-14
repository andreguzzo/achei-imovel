DROP POLICY IF EXISTS "identity docs own read" ON storage.objects;
CREATE POLICY "identity docs own read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'identity-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "identity docs own insert" ON storage.objects;
CREATE POLICY "identity docs own insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "identity docs own delete" ON storage.objects;
CREATE POLICY "identity docs own delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'identity-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );
