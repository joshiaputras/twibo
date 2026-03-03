-- Admin capabilities and campaign stats tracking

-- 1) Allow admins to update/delete campaigns (for admin CRUD)
CREATE POLICY "Admins can update all campaigns"
ON public.campaigns
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete all campaigns"
ON public.campaigns
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Allow admins to fully manage profiles and user roles (for admin user actions)
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Stats table for supporters/download counters
CREATE TABLE IF NOT EXISTS public.campaign_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  supporters_count integer NOT NULL DEFAULT 0,
  downloads_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_stats_campaign_unique UNIQUE (campaign_id)
);

ALTER TABLE public.campaign_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own campaign stats"
ON public.campaign_stats
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id = campaign_stats.campaign_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all campaign stats"
ON public.campaign_stats
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "System can upsert campaign stats"
ON public.campaign_stats
FOR INSERT
WITH CHECK (false);

CREATE POLICY "System can update campaign stats"
ON public.campaign_stats
FOR UPDATE
USING (false)
WITH CHECK (false);

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS update_campaign_stats_updated_at ON public.campaign_stats;
CREATE TRIGGER update_campaign_stats_updated_at
BEFORE UPDATE ON public.campaign_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Security definer function to increment stats from public page (supports anon visitors)
CREATE OR REPLACE FUNCTION public.increment_campaign_stats(_slug text, _event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _campaign_id uuid;
BEGIN
  SELECT c.id INTO _campaign_id
  FROM public.campaigns c
  WHERE c.slug = _slug
    AND c.status = 'published'
  LIMIT 1;

  IF _campaign_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.campaign_stats (campaign_id, supporters_count, downloads_count)
  VALUES (
    _campaign_id,
    CASE WHEN _event = 'supporter' THEN 1 ELSE 0 END,
    CASE WHEN _event = 'download' THEN 1 ELSE 0 END
  )
  ON CONFLICT (campaign_id)
  DO UPDATE SET
    supporters_count = public.campaign_stats.supporters_count + CASE WHEN _event = 'supporter' THEN 1 ELSE 0 END,
    downloads_count = public.campaign_stats.downloads_count + CASE WHEN _event = 'download' THEN 1 ELSE 0 END,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_campaign_stats(text, text) TO anon, authenticated;