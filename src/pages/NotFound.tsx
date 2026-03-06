import Layout from '@/components/Layout';
import SEOHead from '@/components/SEOHead';
import { useLanguage } from '@/i18n/LanguageContext';
import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout>
      <SEOHead title={`404 — ${t.notFound?.title || 'Not Found'} | TWIBO.id`} description={t.notFound?.description || ''} robots="noindex, nofollow" />
      <section className="py-24 md:py-32 flex items-center justify-center min-h-[80vh]">
        <div className="text-center px-4">
          <div className="font-display text-8xl md:text-9xl font-bold text-gold-gradient mb-4">404</div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3">
            {t.notFound?.title}
          </h1>
          <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto">
            {t.notFound?.description}
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/">
              <Button className="gold-glow font-semibold gap-2">
                <Home className="w-4 h-4" />
                {t.notFound?.home}
              </Button>
            </Link>
            <Button variant="outline" className="border-border gap-2" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4" />
              {t.notFound?.back}
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default NotFound;
