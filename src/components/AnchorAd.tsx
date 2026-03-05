import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X } from 'lucide-react';

const AnchorAd = () => {
  const [adId, setAdId] = useState('');
  const [dismissed, setDismissed] = useState(false);

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

  if (dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-3xl px-4 pb-2">
        <div className="relative rounded-t-xl border border-b-0 border-border bg-background/95 backdrop-blur-sm shadow-lg p-3">
          <button
            onClick={() => setDismissed(true)}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center hover:bg-destructive/20 transition-colors"
            aria-label="Close ad"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
          {adId ? (
            <ins
              className="adsbygoogle"
              style={{ display: 'block' }}
              data-ad-client={adId}
              data-ad-slot="auto"
              data-ad-format="horizontal"
              data-full-width-responsive="true"
            />
          ) : (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">— Advertisement —</p>
              <div className="h-12 flex items-center justify-center">
                <span className="text-muted-foreground/40 text-xs">Google AdSense</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnchorAd;
