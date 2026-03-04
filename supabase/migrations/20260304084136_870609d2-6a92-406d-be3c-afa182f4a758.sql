
-- Fix ALL RLS policies: drop RESTRICTIVE and recreate as PERMISSIVE

-- ==================== CAMPAIGNS ====================
DROP POLICY IF EXISTS "Admins can delete all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can update all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can view all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Published campaigns are publicly readable" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaigns;

CREATE POLICY "Admins can view all campaigns" ON public.campaigns FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update all campaigns" ON public.campaigns FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete all campaigns" ON public.campaigns FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Published campaigns are publicly readable" ON public.campaigns FOR SELECT USING (status = 'published');
CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);

-- ==================== CAMPAIGN_STATS ====================
DROP POLICY IF EXISTS "Admins can view all campaign stats" ON public.campaign_stats;
DROP POLICY IF EXISTS "Owners can view own campaign stats" ON public.campaign_stats;
DROP POLICY IF EXISTS "System can update campaign stats" ON public.campaign_stats;
DROP POLICY IF EXISTS "System can upsert campaign stats" ON public.campaign_stats;

CREATE POLICY "Admins can view all campaign stats" ON public.campaign_stats FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owners can view own campaign stats" ON public.campaign_stats FOR SELECT USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_stats.campaign_id AND c.user_id = auth.uid()));

-- ==================== PAYMENTS ====================
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;

CREATE POLICY "Admins can view all payments" ON public.payments FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);

-- ==================== USER_ROLES ====================
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());

-- ==================== SITE_SETTINGS ====================
DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;

CREATE POLICY "Admins can manage site settings" ON public.site_settings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT USING (true);

-- ==================== PROFILES ====================
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
