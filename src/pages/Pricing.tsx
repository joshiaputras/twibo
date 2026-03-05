import Layout from '@/components/Layout';
import SEOHead from '@/components/SEOHead';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Check, X, Crown, Zap, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePricing } from '@/hooks/usePricing';
import AnchorAd from '@/components/AnchorAd';
import { useEffect, useState } from 'react';

const SaleCountdown = () => {
  const { t } = useLanguage();
  const FIXED_H = 5;
  const FIXED_M = 18;
  const [timeLeft, setTimeLeft] = useState({ hours: FIXED_H, minutes: FIXED_M, seconds: 0 });

  useEffect(() => {
    // Use a fixed target: 5h18m from start of current "session" (page load)
    const target = Date.now() + (FIXED_H * 3600000 + FIXED_M * 60000);
    const update = () => {
      const diff = Math.max(0, target - Date.now());
      setTimeLeft({
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className="mb-10 max-w-2xl mx-auto text-center">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary animate-pulse" />
        <span className="text-base font-semibold text-primary">{t.saleCountdown?.label ?? '🔥 Promo Spesial Berakhir Hari Ini!'}</span>
      </div>
      <div className="flex items-center justify-center gap-6">
        {[
          { val: pad(timeLeft.hours), label: t.saleCountdown?.hours ?? 'Hours' },
          { val: pad(timeLeft.minutes), label: t.saleCountdown?.minutes ?? 'Minutes' },
          { val: pad(timeLeft.seconds), label: t.saleCountdown?.seconds ?? 'Seconds' },
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="font-display text-4xl md:text-5xl font-bold text-gold-gradient tabular-nums">{item.val}</span>
            <span className="text-xs text-muted-foreground uppercase mt-1">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Pricing = () => {
  const { t, lang } = useLanguage();
  const { premiumPrice, originalPrice } = usePricing();
  const formatPrice = (price: number) => `Rp ${price.toLocaleString('id-ID')}`;
  const isId = lang === 'id';

  const comparison = [
    { feature: 'TWIBO Frame Editor', free: true, premium: true },
    { feature: t.pricing.privateLink, free: true, premium: true },
    { feature: t.pricing.customSlug, free: true, premium: true },
    { feature: t.pricing.share, free: true, premium: true },
    { feature: t.pricing.watermark, free: false, premium: true },
    { feature: t.pricing.ads, free: false, premium: true },
    { feature: t.pricing.stats, free: false, premium: true },
    { feature: t.pricing.customBanner ?? 'Upload Custom Banner', free: false, premium: true },
    { feature: t.pricing?.hideFromSearch ?? 'Hide from Search Engines', free: false, premium: true },
  ];

  return (
    <Layout>
      <SEOHead
        title={isId ? 'Harga & Paket TWIBO.id — Buat Twibbon Gratis atau Premium' : 'Pricing & Plans — TWIBO.id Free & Premium Twibbon Maker'}
        description={isId ? 'Bandingkan paket gratis dan premium TWIBO.id. Mulai buat twibbon gratis atau upgrade ke Premium untuk fitur tanpa watermark, tanpa iklan, dan statistik lengkap.' : 'Compare TWIBO.id free and premium plans. Start creating twibbons for free or upgrade to Premium for no watermark, no ads, and full statistics.'}
        canonical="https://twibo.id/pricing"
      />
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-gold-gradient mb-4">{t.pricing.title}</h1>
            <p className="text-muted-foreground text-lg">{t.pricing.subtitle}</p>
          </div>

          <SaleCountdown />

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-20">
            {/* Free */}
            <div className="glass rounded-2xl p-8 border-gold-subtle flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-display font-bold text-lg text-foreground">{t.pricing.free}</h2>
              </div>
              <div className="mb-6">
                <span className="font-display text-4xl font-bold text-foreground">{t.pricing.freePrice}</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {Object.values(t.pricing.freeFeatures).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0" /> {String(f)}
                  </li>
                ))}
              </ul>
              <Link to="/campaign/new">
                <Button variant="outline" className="w-full border-border hover:border-primary/50">{t.pricing.freeCta}</Button>
              </Link>
            </div>

            {/* Premium */}
            <div className="glass-strong rounded-2xl p-8 border-gold-subtle gold-glow-strong flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                SALE
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold text-lg text-foreground">{t.pricing.premium}</h2>
              </div>
              <div className="mb-6">
                <div className="mb-1">
                  <span className="text-sm text-muted-foreground line-through">{formatPrice(originalPrice)}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-4xl font-bold text-gold-gradient">{formatPrice(premiumPrice)}</span>
                  <span className="text-sm text-muted-foreground">{t.pricing.perCampaign}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {Object.values(t.pricing.premiumFeatures).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0" /> {String(f)}
                  </li>
                ))}
              </ul>
              <Link to="/campaign/new">
                <Button className="w-full gold-glow font-semibold">{t.pricing.premiumCta}</Button>
              </Link>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="max-w-2xl mx-auto">
            <h2 className="font-display text-2xl font-bold text-center text-gold-gradient mb-8">{t.pricing.comparisonTitle}</h2>
            <div className="glass rounded-2xl overflow-hidden border-gold-subtle">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-4 text-muted-foreground font-medium">{t.pricing.feature}</th>
                    <th className="p-4 text-center text-muted-foreground font-medium">{t.pricing.free}</th>
                    <th className="p-4 text-center text-primary font-medium">{t.pricing.premium}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row, i) => (
                    <tr key={i} className="border-b border-border/30 last:border-0">
                      <td className="p-4 text-foreground">{row.feature}</td>
                      <td className="p-4 text-center">
                        {typeof row.free === 'boolean' ? (
                          row.free ? <Check className="w-4 h-4 text-primary mx-auto" /> : <X className="w-4 h-4 text-muted-foreground mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">{row.free}</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {typeof row.premium === 'boolean' ? (
                          row.premium ? <Check className="w-4 h-4 text-primary mx-auto" /> : <X className="w-4 h-4 text-muted-foreground mx-auto" />
                        ) : (
                          <span className="text-primary font-medium">{row.premium}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
      <AnchorAd />
    </Layout>
  );
};

export default Pricing;
