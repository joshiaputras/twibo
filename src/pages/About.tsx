import Layout from '@/components/Layout';
import SEOHead from '@/components/SEOHead';
import { useLanguage } from '@/i18n/LanguageContext';
import { Users, Target, Heart, Zap } from 'lucide-react';

const About = () => {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  return (
    <Layout>
      <SEOHead
        title={isId ? 'Tentang TWIBO.id — Platform Twibbon Maker Online Gratis' : 'About TWIBO.id — Free Online Twibbon Maker Platform'}
        description={isId ? 'Kenali TWIBO.id, platform twibbon maker yang memudahkan siapa saja untuk membuat campaign frame dan background secara online, gratis, dan tanpa ribet.' : 'Learn about TWIBO.id, a twibbon maker platform that makes it easy for anyone to create campaign frames and backgrounds online, free, and hassle-free.'}
        canonical="https://twibo.id/about"
      />
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-4xl space-y-12">
          <div className="text-center space-y-4">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-gold-gradient">
              {isId ? 'Tentang Kami' : 'About Us'}
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {isId
                ? 'TWIBO.id adalah platform twibbon maker yang memudahkan siapa saja untuk membuat campaign frame dan background secara online, gratis, dan tanpa ribet.'
                : 'TWIBO.id is a twibbon maker platform that makes it easy for anyone to create campaign frames and backgrounds online, free, and hassle-free.'}
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden border border-border bg-secondary/30 h-48 md:h-64 flex items-center justify-center">
            <span className="text-muted-foreground/40 text-sm">TWIBO.id Team</span>
          </div>

          <div className="glass-strong rounded-2xl border-gold-subtle p-6 md:p-10 space-y-6">
            <h2 className="font-display text-xl font-bold text-foreground">
              {isId ? 'Misi Kami' : 'Our Mission'}
            </h2>
            <p className="text-foreground/80 text-sm leading-relaxed">
              {isId
                ? 'Kami percaya bahwa setiap komunitas, organisasi, dan event layak memiliki tools branding yang profesional tanpa harus mengeluarkan biaya besar. TWIBO.id hadir untuk mendemokratisasi pembuatan twibbon — dari yang tadinya membutuhkan desainer, kini bisa dilakukan siapa saja dalam hitungan menit.'
                : 'We believe that every community, organization, and event deserves professional branding tools without breaking the bank. TWIBO.id is here to democratize twibbon creation — what used to require a designer can now be done by anyone in minutes.'}
            </p>
            <p className="text-foreground/80 text-sm leading-relaxed">
              {isId
                ? 'Dengan editor canvas yang powerful, sistem link privat, dan teknologi remove background otomatis, TWIBO.id menjadi solusi satu atap untuk semua kebutuhan campaign visual kamu.'
                : 'With a powerful canvas editor, private link system, and automatic background removal technology, TWIBO.id is your one-stop solution for all visual campaign needs.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Target, title: isId ? 'Fokus pada Pengguna' : 'User-Focused', desc: isId ? 'Setiap fitur dirancang untuk kemudahan pengguna, bukan kerumitan.' : 'Every feature is designed for user ease, not complexity.' },
              { icon: Zap, title: isId ? 'Cepat & Ringan' : 'Fast & Lightweight', desc: isId ? 'Proses pembuatan twibbon instan tanpa perlu install aplikasi.' : 'Instant twibbon creation without installing any app.' },
              { icon: Heart, title: isId ? 'Privasi Terjaga' : 'Privacy First', desc: isId ? 'Campaign kamu bersifat privat, hanya bisa diakses lewat link unik.' : 'Your campaign is private, accessible only via unique link.' },
              { icon: Users, title: isId ? 'Untuk Semua Orang' : 'For Everyone', desc: isId ? 'Dari komunitas kecil hingga organisasi besar, TWIBO.id cocok untuk semua.' : 'From small communities to large organizations, TWIBO.id fits all.' },
            ].map((item, i) => (
              <div key={i} className="glass rounded-xl p-5 border-gold-subtle space-y-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
