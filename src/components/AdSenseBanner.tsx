import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const AdSenseBanner = () => {
  const [adId, setAdId] = useState('');

  useEffect(() => {
    supabase
      .from('site_settings' as any)
      .select('value')
      .eq('key', 'adsense_id')
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.value) setAdId(data.value);
      });
  }, []);

  useEffect(() => {
    if (!adId) return;

    // Load AdSense script if not already loaded
    const existingScript = document.querySelector(
      'script[src*="pagead2.googlesyndication.com"]'
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adId}`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    // Push ad
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      // already pushed
    }
  }, [adId]);

  if (!adId) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-center">
        <p className="text-xs text-muted-foreground">— Advertisement —</p>
        <div className="h-16 flex items-center justify-center">
          <span className="text-muted-foreground/40 text-xs">Google AdSense</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-center">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={adId}
        data-ad-slot="auto"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdSenseBanner;
