
-- Add banner_url column to campaigns table
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS banner_url text DEFAULT null;

-- Create banner-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('banner-images', 'banner-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for banner-images bucket
CREATE POLICY "Anyone can read banner images"
ON storage.objects FOR SELECT
USING (bucket_id = 'banner-images');

CREATE POLICY "Authenticated users can upload banner images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'banner-images');

CREATE POLICY "Users can update their own banner images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'banner-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own banner images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'banner-images' AND (storage.foldername(name))[1] = auth.uid()::text);
