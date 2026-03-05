import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  robots?: string;
}

let cachedDefaultOgImage: string | null = null;

const SEOHead = ({ title, description, canonical, ogImage, ogType = 'website', robots }: SEOHeadProps) => {
  const [defaultOgImage, setDefaultOgImage] = useState<string>(cachedDefaultOgImage || '');

  useEffect(() => {
    if (cachedDefaultOgImage !== null) return;
    supabase
      .from('site_settings' as any)
      .select('value')
      .eq('key', 'og_image_url')
      .maybeSingle()
      .then(({ data }: any) => {
        const url = data?.value || '';
        cachedDefaultOgImage = url;
        setDefaultOgImage(url);
      });
  }, []);

  const resolvedOgImage = ogImage || defaultOgImage || 'https://twibo.id/og-image.png';

  useEffect(() => {
    document.title = title;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', ogType);
    setMeta('property', 'og:image', resolvedOgImage);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', resolvedOgImage);
    setMeta('name', 'twitter:card', 'summary_large_image');

    if (robots) {
      setMeta('name', 'robots', robots);
    } else {
      const existing = document.querySelector('meta[name="robots"]');
      if (existing) existing.remove();
    }

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
    }
  }, [title, description, canonical, resolvedOgImage, ogType, robots]);

  return null;
};

export default SEOHead;
