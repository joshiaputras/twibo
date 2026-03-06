import Layout from '@/components/Layout';
import SEOHead from '@/components/SEOHead';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

const ResetPassword = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setValidSession(true);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session);
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t.auth.passwordMismatch);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.auth.resetSuccess);
      await supabase.auth.signOut();
      navigate('/login');
    }
  };

  if (validSession === null) {
    return (
      <Layout>
        <SEOHead title="Reset Password — TWIBO.id" description="Reset password akun TWIBO.id." robots="noindex, nofollow" />
        <section className="py-24 md:py-32 flex items-center justify-center min-h-[80vh]">
          <div className="text-muted-foreground">{t.auth.loading}</div>
        </section>
      </Layout>
    );
  }

  if (validSession === false) {
    return (
      <Layout>
        <section className="py-24 md:py-32 flex items-center justify-center min-h-[80vh]">
          <div className="w-full max-w-md mx-auto px-4">
            <div className="glass-strong rounded-2xl p-8 border-gold-subtle text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">{t.auth.invalidLinkTitle}</h1>
              <p className="text-muted-foreground text-sm mb-6">{t.auth.invalidLinkDesc}</p>
              <div className="flex gap-3 justify-center">
                <Link to="/forgot-password">
                  <Button className="gold-glow font-semibold">{t.auth.requestNewLink}</Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" className="border-border">{t.auth.backToLogin}</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="py-24 md:py-32 flex items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-md mx-auto px-4">
          <div className="glass-strong rounded-2xl p-8 border-gold-subtle gold-glow">
            <div className="text-center mb-8">
              <h1 className="font-display text-3xl font-bold text-gold-gradient mb-2">{t.auth.forgotTitle}</h1>
              <p className="text-muted-foreground text-sm">{t.auth.resetPasswordSubtitle}</p>
            </div>
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-sm text-muted-foreground">{t.auth.password}</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 bg-secondary/50 border-border" required />
                </div>
              </div>
              <div>
                <Label htmlFor="confirm" className="text-sm text-muted-foreground">{t.auth.confirmPassword}</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="pl-10 bg-secondary/50 border-border" required />
                </div>
              </div>
              <Button type="submit" className="w-full gold-glow font-semibold" disabled={loading}>
                {loading ? '...' : t.auth.updatePasswordCta}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default ResetPassword;
