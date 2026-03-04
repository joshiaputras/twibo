import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FeaturedCampaign {
  id: string;
  name: string;
  slug: string;
  design_json: any;
}

export const useFeaturedCampaigns = () => {
  const [campaigns, setCampaigns] = useState<FeaturedCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('campaigns' as any)
        .select('id, name, slug, design_json')
        .eq('is_featured', true)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(20);

      setCampaigns((data as any[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  return { campaigns, loading };
};
