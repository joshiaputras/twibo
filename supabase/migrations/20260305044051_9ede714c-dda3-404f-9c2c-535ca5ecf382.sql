
-- Allow public read of campaign_stats for published campaigns
CREATE POLICY "Anyone can read stats for published campaigns" ON public.campaign_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_stats.campaign_id AND c.status = 'published'
    )
  );
