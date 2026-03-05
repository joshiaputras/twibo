import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Mail, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Contact = () => {
  const { lang } = useLanguage();
  const isId = lang === 'id';

  return (
    <Layout>
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-3xl space-y-10">
          <div className="text-center space-y-4">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-gold-gradient">
              {isId ? 'Hubungi Kami' : 'Contact Us'}
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {isId
                ? 'Punya pertanyaan, saran, atau butuh bantuan? Tim kami siap membantu kamu.'
                : 'Have questions, suggestions, or need help? Our team is ready to assist you.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-strong rounded-2xl border-gold-subtle p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Mail className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-display font-semibold text-foreground">Email</h2>
              <p className="text-sm text-muted-foreground">
                {isId
                  ? 'Kirim email ke tim support kami untuk pertanyaan umum atau teknis.'
                  : 'Send an email to our support team for general or technical inquiries.'}
              </p>
              <Button variant="outline" className="border-border" asChild>
                <a href="mailto:cs@twibo.id">cs@twibo.id</a>
              </Button>
            </div>

            <div className="glass-strong rounded-2xl border-gold-subtle p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <MessageSquare className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-display font-semibold text-foreground">
                {isId ? 'Waktu Respon' : 'Response Time'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isId
                  ? 'Kami biasanya merespon dalam 1×24 jam pada hari kerja. Untuk hal urgent, cantumkan subjek "URGENT" di email kamu.'
                  : 'We typically respond within 1×24 hours on business days. For urgent matters, include "URGENT" in your email subject.'}
              </p>
            </div>
          </div>

          <div className="glass rounded-2xl border-gold-subtle p-6 text-center space-y-3">
            <h3 className="font-semibold text-foreground text-sm">
              {isId ? 'Jam Operasional' : 'Business Hours'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isId ? 'Senin – Jumat, 09:00 – 17:00 WIB' : 'Monday – Friday, 09:00 – 17:00 WIB (UTC+7)'}
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Contact;
