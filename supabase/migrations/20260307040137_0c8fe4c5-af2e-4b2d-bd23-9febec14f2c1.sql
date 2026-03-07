-- ============================================================
-- FIX ALL RLS POLICIES: Change RESTRICTIVE to PERMISSIVE
-- ============================================================

-- ============ site_settings ===========
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;

CREATE POLICY "Anyone can read site settings" ON public.site_settings
AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage site settings" ON public.site_settings
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ profiles ===========
DROP POLICY IF EXISTS "Anyone can read public profile info" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Anyone can read public profile info" ON public.profiles
AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.profiles
AS PERMISSIVE FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Admins can manage all profiles" ON public.profiles
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ campaigns ===========
DROP POLICY IF EXISTS "Published campaigns are publicly readable" ON public.campaigns;
DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can view all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can update all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can delete all campaigns" ON public.campaigns;

CREATE POLICY "Published campaigns are publicly readable" ON public.campaigns
AS PERMISSIVE FOR SELECT TO public USING (status = 'published');

CREATE POLICY "Users can view own campaigns" ON public.campaigns
AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all campaigns" ON public.campaigns
AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own campaigns" ON public.campaigns
AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns" ON public.campaigns
AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns" ON public.campaigns
AS PERMISSIVE FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all campaigns" ON public.campaigns
AS PERMISSIVE FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete all campaigns" ON public.campaigns
AS PERMISSIVE FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ blog_posts ===========
DROP POLICY IF EXISTS "Anyone can read published blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can manage blog posts" ON public.blog_posts;

CREATE POLICY "Anyone can read published blog posts" ON public.blog_posts
AS PERMISSIVE FOR SELECT TO public USING (status = 'published');

CREATE POLICY "Admins can manage blog posts" ON public.blog_posts
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ campaign_stats ===========
DROP POLICY IF EXISTS "Anyone can read stats for published campaigns" ON public.campaign_stats;
DROP POLICY IF EXISTS "Owners can view own campaign stats" ON public.campaign_stats;
DROP POLICY IF EXISTS "Admins can view all campaign stats" ON public.campaign_stats;

CREATE POLICY "Anyone can read stats for published campaigns" ON public.campaign_stats
AS PERMISSIVE FOR SELECT TO public
USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_stats.campaign_id AND c.status = 'published'));

CREATE POLICY "Owners can view own campaign stats" ON public.campaign_stats
AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_stats.campaign_id AND c.user_id = auth.uid()));

CREATE POLICY "Admins can view all campaign stats" ON public.campaign_stats
AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ campaign_stats_daily ===========
DROP POLICY IF EXISTS "Owners can view own daily stats" ON public.campaign_stats_daily;
DROP POLICY IF EXISTS "Admins can view all daily stats" ON public.campaign_stats_daily;

CREATE POLICY "Owners can view own daily stats" ON public.campaign_stats_daily
AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_stats_daily.campaign_id AND c.user_id = auth.uid()));

CREATE POLICY "Admins can view all daily stats" ON public.campaign_stats_daily
AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ vouchers ===========
DROP POLICY IF EXISTS "Anyone can read active vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Admins can manage vouchers" ON public.vouchers;

CREATE POLICY "Anyone can read active vouchers" ON public.vouchers
AS PERMISSIVE FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Admins can manage vouchers" ON public.vouchers
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ payments ===========
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can delete own pending payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Anyone can read paid payments by order id" ON public.payments;

CREATE POLICY "Users can view own payments" ON public.payments
AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments" ON public.payments
AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pending payments" ON public.payments
AS PERMISSIVE FOR DELETE TO authenticated
USING (auth.uid() = user_id AND status = ANY(ARRAY['pending', 'failed']));

CREATE POLICY "Admins can view all payments" ON public.payments
AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read paid payments by order id" ON public.payments
AS PERMISSIVE FOR SELECT TO public
USING (status = 'paid' AND midtrans_order_id IS NOT NULL);

-- ============ user_roles ===========
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles
AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage user roles" ON public.user_roles
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));