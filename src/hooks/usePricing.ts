import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePricing = () => {
  const [premiumPrice, setPremiumPrice] = useState(50000);
  const [originalPrice, setOriginalPrice] = useState(149000);
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalMode, setPaypalMode] = useState('sandbox');
  const [paypalPriceUsd, setPaypalPriceUsd] = useState(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('site_settings' as any)
        .select('key, value')
        .in('key', ['premium_price', 'premium_original_price', 'paypal_enabled', 'paypal_client_id', 'paypal_mode', 'paypal_price_usd']);

      if (data) {
        (data as any[]).forEach((r: any) => {
          if (r.key === 'premium_price' && r.value) setPremiumPrice(Number(r.value));
          if (r.key === 'premium_original_price' && r.value) setOriginalPrice(Number(r.value));
          if (r.key === 'paypal_enabled') setPaypalEnabled(r.value === 'true');
          if (r.key === 'paypal_client_id' && r.value) setPaypalClientId(r.value);
          if (r.key === 'paypal_mode' && r.value) setPaypalMode(r.value);
          if (r.key === 'paypal_price_usd' && r.value) setPaypalPriceUsd(Number(r.value));
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  return { premiumPrice, originalPrice, paypalEnabled, paypalClientId, paypalMode, paypalPriceUsd, loading };
};
