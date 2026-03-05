import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

let cachedValue: boolean | null = null;

export function useAdsenseEnabled() {
  const [enabled, setEnabled] = useState(cachedValue ?? true);

  useEffect(() => {
    if (cachedValue !== null) { setEnabled(cachedValue); return; }
    supabase
      .from('site_settings' as any)
      .select('value')
      .eq('key', 'adsense_enabled')
      .maybeSingle()
      .then(({ data }: any) => {
        const val = data?.value !== 'false';
        cachedValue = val;
        setEnabled(val);
      });
  }, []);

  return enabled;
}
