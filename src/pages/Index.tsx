import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Link2, Paintbrush, Upload, Lock, Eye, UserX, Settings, ArrowRight } from 'lucide-react';

const FloatingCard = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={`absolute glass rounded-xl p-3 gold-glow opacity-70 ${className}`}>
    {children}
  </div>
);

const Index = () => {
  const { t } = useLanguage();

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

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-36">
        {/* Animated floating twibbon examples */}
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

        {/* Gold glow orbs */}
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
          <Link to="/signup">
            <Button size="lg" className="gold-glow-strong font-display font-semibold text-lg px-8 py-6 rounded-xl">
              {t.hero.cta}
              <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
          </Link>
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

      {/* Privacy / Why TWIBO.id */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="glass-strong rounded-3xl p-8 md:p-12 max-w-3xl mx-auto border-gold-subtle gold-glow">
            <div className="text-center mb-8">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-gold-gradient mb-3">{t.privacy.title}</h2>
              <p className="text-muted-foreground">{t.privacy.subtitle}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {privacyPoints.map((p, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <p.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{p.text}</span>
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
