ALTER TABLE public.campaigns ADD COLUMN is_featured boolean NOT NULL DEFAULT false;

-- Allow anyone to read featured campaigns (for homepage carousel)
CREATE POLICY "Anyone can read featured campaigns"
ON public.campaigns
FOR SELECT
USING (is_featured = true AND status = 'published');