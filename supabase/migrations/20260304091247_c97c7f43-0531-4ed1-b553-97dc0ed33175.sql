
-- Fix ALL RLS policies: change from RESTRICTIVE to PERMISSIVE

-- ============ PROFILES ============
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ============ CAMPAIGNS ============
DROP POLICY IF EXISTS "Admins can view all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can update all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can delete all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Published campaigns are publicly readable" ON public.campaigns;
DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaigns;

CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Published campaigns are publicly readable" ON public.campaigns FOR SELECT
  USING (status = 'published');

CREATE POLICY "Admins can view all campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own campaigns" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all campaigns" ON public.campaigns FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete all campaigns" ON public.campaigns FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ USER_ROLES ============
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ PAYMENTS ============
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;

CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments" ON public.payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ CAMPAIGN_STATS ============
DROP POLICY IF EXISTS "Admins can view all campaign stats" ON public.campaign_stats;
DROP POLICY IF EXISTS "Owners can view own campaign stats" ON public.campaign_stats;

CREATE POLICY "Owners can view own campaign stats" ON public.campaign_stats FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_stats.campaign_id AND c.user_id = auth.uid()));

CREATE POLICY "Admins can view all campaign stats" ON public.campaign_stats FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ CAMPAIGN_STATS_DAILY ============
DROP POLICY IF EXISTS "Owners can view own daily stats" ON public.campaign_stats_daily;
DROP POLICY IF EXISTS "Admins can view all daily stats" ON public.campaign_stats_daily;

CREATE POLICY "Owners can view own daily stats" ON public.campaign_stats_daily FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_stats_daily.campaign_id AND c.user_id = auth.uid()));

CREATE POLICY "Admins can view all daily stats" ON public.campaign_stats_daily FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ SITE_SETTINGS ============
DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;

CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage site settings" ON public.site_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
