import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

let faviconLoaded = false;

export function useDynamicFavicon() {
  useEffect(() => {
    if (faviconLoaded) return;
    faviconLoaded = true;

    supabase
      .from('site_settings' as any)
      .select('value')
      .eq('key', 'favicon_url')
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.value) {
          let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = data.value;
          link.type = data.value.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
        }
      });
  }, []);
}
