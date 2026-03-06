import Layout from '@/components/Layout';
import SEOHead from '@/components/SEOHead';
import { useLanguage } from '@/i18n/LanguageContext';
import { MailCheck, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, Chrome } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const Signup = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error((t.auth as any).passwordMismatch || 'Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      toast.error(t.auth?.passwordMinLength ?? 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { name: form.name, phone: form.phone },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSignupSuccess(true);
      setRegisteredEmail(form.email);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' },
    });
    if (error) toast.error(error.message);
  };

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <Layout>
      <SEOHead title="Daftar Akun — TWIBO.id" description="Buat akun TWIBO.id gratis untuk mulai membuat campaign twibbon." robots="noindex, nofollow" />
      <section className="py-24 md:py-32 flex items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-md mx-auto px-4">
          <div className="glass-strong rounded-2xl p-8 border-gold-subtle gold-glow">
            <div className="text-center mb-8">
              <h1 className="font-display text-3xl font-bold text-gold-gradient mb-2">{t.auth.signupTitle}</h1>
              <p className="text-muted-foreground text-sm">{t.auth.signupSubtitle}</p>
            </div>

            {signupSuccess ? (
              <div className="text-center space-y-4 py-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <MailCheck className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">{t.auth.checkEmailTitle}</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t.auth.checkEmailSent}<br />
                  <span className="font-medium text-foreground">{registeredEmail}</span>
                </p>
                <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">{t.auth.checkEmailStep1}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">{t.auth.checkEmailStep2}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">{t.auth.checkEmailStep3}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t.auth.checkEmailNoReceive}</p>
                <Link to="/login">
                  <Button variant="outline" className="w-full mt-2">{t.auth.goToLogin}</Button>
                </Link>
              </div>
            ) : (
              <>
                <Button variant="outline" className="w-full mb-6 border-border hover:border-primary/50 gap-2" onClick={handleGoogle}>
                  <Chrome className="w-4 h-4" />
                  {t.auth.googleCta}
                </Button>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
                  <div className="relative flex justify-center text-xs"><span className="px-2 bg-card text-muted-foreground">{t.auth.or}</span></div>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-sm text-muted-foreground">{t.auth.name}</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="name" value={form.name} onChange={e => update('name', e.target.value)} className="pl-10 bg-secondary/50 border-border" required />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-sm text-muted-foreground">{t.auth.email}</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="email" type="email" value={form.email} onChange={e => update('email', e.target.value)} className="pl-10 bg-secondary/50 border-border" required />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-sm text-muted-foreground">{t.auth.phone}</Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="phone" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className="pl-10 bg-secondary/50 border-border" required />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="password" className="text-sm text-muted-foreground">{t.auth.password}</Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="password" type="password" value={form.password} onChange={e => update('password', e.target.value)} className="pl-10 bg-secondary/50 border-border" required />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">{t.auth.confirmPassword}</Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} className="pl-10 bg-secondary/50 border-border" required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full gold-glow font-semibold" disabled={loading}>
                    {loading ? '...' : t.auth.signupCta}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground mt-6">
                  {t.auth.hasAccount} <Link to="/login" className="text-primary hover:underline">{t.nav.login}</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Signup;
