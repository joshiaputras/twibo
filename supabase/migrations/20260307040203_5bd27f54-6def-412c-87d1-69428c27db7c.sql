-- ============ Storage: avatars ===========
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

CREATE POLICY "Anyone can view avatars" ON storage.objects
AS PERMISSIVE FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar" ON storage.objects
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar" ON storage.objects
AS PERMISSIVE FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar" ON storage.objects
AS PERMISSIVE FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============ Storage: banner-images ===========
DROP POLICY IF EXISTS "Anyone can view banner images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload banner images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update banner images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete banner images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload banner images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update banner images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete banner images" ON storage.objects;

CREATE POLICY "Anyone can view banner images" ON storage.objects
AS PERMISSIVE FOR SELECT TO public
USING (bucket_id = 'banner-images');

CREATE POLICY "Authenticated users can upload banner images" ON storage.objects
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'banner-images');

CREATE POLICY "Authenticated users can update banner images" ON storage.objects
AS PERMISSIVE FOR UPDATE TO authenticated
USING (bucket_id = 'banner-images');

CREATE POLICY "Authenticated users can delete banner images" ON storage.objects
AS PERMISSIVE FOR DELETE TO authenticated
USING (bucket_id = 'banner-images');