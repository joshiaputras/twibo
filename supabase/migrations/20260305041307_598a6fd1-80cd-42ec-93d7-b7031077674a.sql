-- Allow anyone to read profiles (name, avatar_url are not sensitive)
-- This fixes public campaign page showing "User" for non-logged-in visitors
CREATE POLICY "Anyone can read public profile info"
ON public.profiles FOR SELECT
USING (true);