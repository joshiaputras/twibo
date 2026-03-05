import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Link2, Paintbrush, Upload, Lock, Eye, UserX, Settings, ArrowRight, Check, Crown, Zap, Star, Sparkles, Heart, Image, ChevronRight } from 'lucide-react';
import { usePricing } from '@/hooks/usePricing';
import { useFeaturedCampaigns } from '@/hooks/useFeaturedCampaigns';
import { useRef, useState } from 'react';
import { extractPreviewMeta } from '@/utils/campaignDesign';
import { Skeleton } from '@/components/ui/skeleton';

const FloatingCard = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={`absolute glass rounded-xl p-3 gold-glow opacity-70 ${className}`}>
    {children}
  </div>
);

const Index = () => {
  const { t } = useLanguage();
  const { premiumPrice, originalPrice } = usePricing();
  const { campaigns: featuredCampaigns, loading: featuredLoading } = useFeaturedCampaigns();
  const [isPaused, setIsPaused] = useState(false);

  // Triple the campaigns to ensure seamless loop - translateX(-33.333%) = exactly 1 set
  const triplicatedCampaigns = featuredCampaigns.length > 0
    ? [...featuredCampaigns, ...featuredCampaigns, ...featuredCampaigns]
    : [];

  const steps = [
    { icon: Paintbrush, title: t.howItWorks.step1Title, desc: t.howItWorks.step1Desc },
    { icon: Link2, title: t.howItWorks.step2Title, desc: t.howItWorks.step2Desc },
    { icon: Upload, title: t.howItWorks.step3Title, desc: t.howItWorks.step3Desc },
  ];

  const features = [
    { icon: Paintbrush, title: t.features.frameTwibbon, desc: t.features.frameDesc },
    { icon: Settings, title: t.features.bgTwibbon, desc: t.features.bgDesc },
    { icon: Link2, title: t.features.privateLink, desc: t.features.privateLinkDesc },
    { icon: UserX, title: t.features.noAccount, desc: t.features.noAccountDesc },
  ];

  const privacyPoints = [
    { icon: Eye, text: t.privacy.point1 },
    { icon: Link2, text: t.privacy.point2 },
    { icon: Shield, text: t.privacy.point3 },
    { icon: Lock, text: t.privacy.point4 },
  ];

  const useCases = [
    { icon: Heart, title: 'Komunitas & Organisasi', desc: 'Buat campaign branding untuk anggota komunitas, alumni, atau organisasi sosial.' },
    { icon: Star, title: 'Event & Acara', desc: 'Frame foto untuk konferensi, seminar, wisuda, atau perayaan spesial.' },
    { icon: Sparkles, title: 'Brand & Marketing', desc: 'Tingkatkan brand awareness dengan frame campaign yang dibagikan oleh supporter.' },
  ];

  const formatPrice = (price: number) => `Rp ${price.toLocaleString('id-ID')}`;

  // Animation: scroll exactly 1/3 of the track (one full set of campaigns)
  const itemWidth = 256; // w-[240px] + gap
  const oneSetWidth = featuredCampaigns.length * itemWidth;
  const speed = 40; // pixels per second
  const duration = oneSetWidth / speed;

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-36">
        <FloatingCard className="top-20 left-[8%] animate-float hidden lg:block">
          <div className="w-16 h-16 rounded-lg bg-primary/20 flex items-center justify-center">
            <Paintbrush className="w-8 h-8 text-primary" />
          </div>
        </FloatingCard>
        <FloatingCard className="top-32 right-[10%] animate-float-delay hidden lg:block">
          <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30" />
        </FloatingCard>
        <FloatingCard className="bottom-24 left-[15%] animate-float-delay hidden lg:block">
          <div className="w-14 h-14 rounded-md bg-primary/15 flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary" />
          </div>
        </FloatingCard>
        <FloatingCard className="bottom-16 right-[12%] animate-float hidden lg:block">
          <div className="w-18 h-18 rounded-lg bg-primary/10 p-2">
            <div className="w-12 h-12 rounded bg-primary/20" />
          </div>
        </FloatingCard>

        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-gold" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/3 rounded-full blur-3xl animate-pulse-gold" style={{ animationDelay: '2s' }} />

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6 text-sm text-primary border-gold-subtle">
            <Shield className="w-4 h-4" />
            {t.hero.badge}
          </div>
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            <span className="text-gold-gradient">{t.hero.title}</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            {t.hero.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button size="lg" className="gold-glow-strong font-display font-semibold text-lg px-8 py-6 rounded-xl">
                {t.hero.cta}
                <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="font-display font-semibold text-lg px-8 py-6 rounded-xl border-border hover:border-primary/50">
                {t.pricing?.title ?? 'Lihat Harga'}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Image showcase / visual section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="glass rounded-2xl border-gold-subtle overflow-hidden aspect-square flex items-center justify-center">
              <div className="text-center p-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Paintbrush className="w-10 h-10 text-primary" />
                </div>
                <p className="text-sm text-foreground font-semibold">Desain Frame</p>
                <p className="text-xs text-muted-foreground mt-1">Canvas editor yang powerful</p>
              </div>
            </div>
            <div className="glass rounded-2xl border-gold-subtle overflow-hidden aspect-square flex items-center justify-center">
              <div className="text-center p-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <p className="text-sm text-foreground font-semibold">Upload & Gabungkan</p>
                <p className="text-xs text-muted-foreground mt-1">Supporter upload foto langsung</p>
              </div>
            </div>
            <div className="glass rounded-2xl border-gold-subtle overflow-hidden aspect-square flex items-center justify-center">
              <div className="text-center p-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Image className="w-10 h-10 text-primary" />
                </div>
                <p className="text-sm text-foreground font-semibold">Hasil Profesional</p>
                <p className="text-xs text-muted-foreground mt-1">Download langsung dalam HD</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Campaigns Carousel */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gold-gradient mb-3">
              Campaign Gratis untuk Kamu
            </h2>
            <p className="text-muted-foreground">Langsung pakai frame campaign populer berikut ini</p>
          </div>

          {featuredLoading ? (
            <div className="flex gap-4 overflow-hidden pb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shrink-0 w-[200px] md:w-[240px]">
                  <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                    <Skeleton className="aspect-square w-full" />
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : featuredCampaigns.length > 0 ? (
            <div
              className="overflow-hidden"
              style={{
                maskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
              }}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <div
                className="flex gap-4 w-max carousel-track"
                style={{
                  animationDuration: `${duration}s`,
                  animationPlayState: isPaused ? 'paused' : 'running',
                }}
              >
                {triplicatedCampaigns.map((fc, i) => {
                  const previewMeta = extractPreviewMeta(fc.design_json);
                  const previewUrl = previewMeta.previewImageDataUrl;

                  return (
                    <Link
                      key={`${fc.id}-${i}`}
                      to={`/c/${fc.slug}`}
                      className="shrink-0 w-[200px] md:w-[240px] group"
                    >
                      <div className="glass rounded-2xl border-gold-subtle overflow-hidden hover:gold-glow transition-shadow">
                        <div className="aspect-square bg-secondary/30 flex items-center justify-center overflow-hidden">
                          {previewUrl ? (
                            <img src={previewUrl} alt={fc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <Image className="w-12 h-12 text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold text-foreground truncate">{fc.name}</p>
                          <p className="text-xs text-primary flex items-center gap-1 mt-1">
                            Gunakan <ChevronRight className="w-3 h-3" />
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gold-gradient mb-3">{t.howItWorks.title}</h2>
            <p className="text-muted-foreground">{t.howItWorks.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <div key={i} className="glass rounded-2xl p-6 text-center border-gold-subtle gold-glow group hover:scale-[1.02] transition-transform">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>
                <div className="text-xs text-primary font-semibold mb-2">0{i + 1}</div>
                <h3 className="font-display font-semibold text-lg mb-2 text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gold-gradient mb-3">{t.features.title}</h2>
            <p className="text-muted-foreground">{t.features.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {features.map((f, i) => (
              <div key={i} className="glass rounded-2xl p-6 border-gold-subtle hover:gold-glow transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold mb-2 text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gold-gradient mb-3">
              Cocok Untuk Siapa?
            </h2>
            <p className="text-muted-foreground">TWIBO.id digunakan oleh ribuan komunitas dan organisasi</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {useCases.map((uc, i) => (
              <div key={i} className="glass rounded-2xl p-6 border-gold-subtle hover:gold-glow transition-shadow text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <uc.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2 text-foreground">{uc.title}</h3>
                <p className="text-sm text-muted-foreground">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - Dynamic */}
      <section className="py-20" id="pricing">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gold-gradient mb-3">{t.pricing.title}</h2>
            <p className="text-muted-foreground">{t.pricing.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free */}
            <div className="glass rounded-2xl p-8 border-gold-subtle flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-display font-bold text-lg text-foreground">{t.pricing.free}</h3>
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
                <h3 className="font-display font-bold text-lg text-foreground">{t.pricing.premium}</h3>
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
                <Button className="w-full gold-glow-strong font-semibold">{t.pricing.premiumCta}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="glass-strong rounded-3xl p-8 md:p-12 border-gold-subtle max-w-4xl mx-auto text-center">
            <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gold-gradient mb-3">{t.privacy.title}</h2>
            <p className="text-muted-foreground mb-8">{t.privacy.subtitle}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
              {privacyPoints.map((p, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                  <p.icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground/80">{p.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
