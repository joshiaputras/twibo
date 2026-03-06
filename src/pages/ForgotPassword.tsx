import Layout from '@/components/Layout';
import SEOHead from '@/components/SEOHead';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const ForgotPassword = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <Layout>
      <SEOHead title={t.auth.seoForgotTitle} description={t.auth.seoForgotDesc} robots="noindex, nofollow" />
      <section className="py-24 md:py-32 flex items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-md mx-auto px-4">
          <div className="glass-strong rounded-2xl p-8 border-gold-subtle gold-glow">
            <div className="text-center mb-8">
              <h1 className="font-display text-3xl font-bold text-gold-gradient mb-2">{t.auth.forgotTitle}</h1>
              <p className="text-muted-foreground text-sm">{t.auth.forgotSubtitle}</p>
            </div>

            {sent ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <p className="text-foreground">{t.auth.forgotEmailSent}</p>
                <Link to="/login">
                  <Button variant="outline" className="gap-2 border-border"><ArrowLeft className="w-4 h-4" />{t.auth.backToLogin}</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-sm text-muted-foreground">{t.auth.email}</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 bg-secondary/50 border-border" required />
                  </div>
                </div>
                <Button type="submit" className="w-full gold-glow font-semibold" disabled={loading}>
                  {loading ? '...' : t.auth.forgotCta}
                </Button>
                <div className="text-center">
                  <Link to="/login" className="text-sm text-primary hover:underline flex items-center justify-center gap-1">
                    <ArrowLeft className="w-3 h-3" />{t.auth.backToLogin}
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default ForgotPassword;
