import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePricing = () => {
  const [premiumPrice, setPremiumPrice] = useState(50000);
  const [originalPrice, setOriginalPrice] = useState(149000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('site_settings' as any)
        .select('key, value')
        .in('key', ['premium_price', 'premium_original_price']);

      if (data) {
        (data as any[]).forEach((r: any) => {
          if (r.key === 'premium_price' && r.value) setPremiumPrice(Number(r.value));
          if (r.key === 'premium_original_price' && r.value) setOriginalPrice(Number(r.value));
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  return { premiumPrice, originalPrice, loading };
};
