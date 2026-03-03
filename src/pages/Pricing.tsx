import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Check, X, Crown, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const Pricing = () => {
  const { t } = useLanguage();

  const comparison = [
    { feature: t.pricing.editor, free: t.pricing.basic, premium: t.pricing.full },
    { feature: t.pricing.watermark, free: false, premium: true },
    { feature: t.pricing.ads, free: false, premium: true },
    { feature: t.pricing.stats, free: false, premium: true },
    { feature: t.pricing.customSlug, free: true, premium: true },
    { feature: t.pricing.share, free: true, premium: true },
    { feature: t.pricing.bgRemoval, free: true, premium: true },
  ];

  return (
    <Layout>
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-gold-gradient mb-4">{t.pricing.title}</h1>
            <p className="text-muted-foreground text-lg">{t.pricing.subtitle}</p>
          </div>

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
                    <Check className="w-4 h-4 text-primary shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/signup">
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
                <span className="text-sm text-muted-foreground line-through mr-2">{t.pricing.premiumOriginal}</span>
                <span className="font-display text-4xl font-bold text-gold-gradient">{t.pricing.premiumPrice}</span>
                <span className="text-sm text-muted-foreground">{t.pricing.perCampaign}</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {Object.values(t.pricing.premiumFeatures).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/signup">
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
    </Layout>
  );
};

export default Pricing;
