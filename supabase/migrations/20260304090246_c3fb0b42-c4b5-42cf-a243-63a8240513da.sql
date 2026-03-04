
-- Create daily stats table for chart data
CREATE TABLE IF NOT EXISTS public.campaign_stats_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  supporters_count integer NOT NULL DEFAULT 0,
  downloads_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, date)
);

ALTER TABLE public.campaign_stats_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own daily stats" ON public.campaign_stats_daily FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_stats_daily.campaign_id AND c.user_id = auth.uid()));

CREATE POLICY "Admins can view all daily stats" ON public.campaign_stats_daily FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Update increment function to also track daily stats
CREATE OR REPLACE FUNCTION public.increment_campaign_stats(_slug text, _event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _campaign_id uuid;
BEGIN
  SELECT c.id INTO _campaign_id
  FROM public.campaigns c
  WHERE c.slug = _slug AND c.status = 'published'
  LIMIT 1;

  IF _campaign_id IS NULL THEN RETURN; END IF;

  -- Update total stats
  INSERT INTO public.campaign_stats (campaign_id, supporters_count, downloads_count)
  VALUES (
    _campaign_id,
    CASE WHEN _event = 'supporter' THEN 1 ELSE 0 END,
    CASE WHEN _event = 'download' THEN 1 ELSE 0 END
  )
  ON CONFLICT (campaign_id)
  DO UPDATE SET
    supporters_count = campaign_stats.supporters_count + CASE WHEN _event = 'supporter' THEN 1 ELSE 0 END,
    downloads_count = campaign_stats.downloads_count + CASE WHEN _event = 'download' THEN 1 ELSE 0 END,
    updated_at = now();

  -- Update daily stats
  INSERT INTO public.campaign_stats_daily (campaign_id, date, supporters_count, downloads_count)
  VALUES (
    _campaign_id,
    CURRENT_DATE,
    CASE WHEN _event = 'supporter' THEN 1 ELSE 0 END,
    CASE WHEN _event = 'download' THEN 1 ELSE 0 END
  )
  ON CONFLICT (campaign_id, date)
  DO UPDATE SET
    supporters_count = campaign_stats_daily.supporters_count + CASE WHEN _event = 'supporter' THEN 1 ELSE 0 END,
    downloads_count = campaign_stats_daily.downloads_count + CASE WHEN _event = 'download' THEN 1 ELSE 0 END;
END;
$$;
