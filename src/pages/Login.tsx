import Layout from '@/components/Layout';
import SEOHead from '@/components/SEOHead';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Chrome } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const Login = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate('/dashboard');
    }
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (result?.error) toast.error(String(result.error));
  };

  return (
    <Layout>
      <SEOHead title={t.auth.seoLoginTitle} description={t.auth.seoLoginDesc} robots="noindex, nofollow" />
      <section className="py-24 md:py-32 flex items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-md mx-auto px-4">
          <div className="glass-strong rounded-2xl p-8 border-gold-subtle gold-glow">
            <div className="text-center mb-8">
              <h1 className="font-display text-3xl font-bold text-gold-gradient mb-2">{t.auth.loginTitle}</h1>
              <p className="text-muted-foreground text-sm">{t.auth.loginSubtitle}</p>
            </div>

            <Button variant="outline" className="w-full mb-6 border-border hover:border-primary/50 gap-2" onClick={handleGoogle}>
              <Chrome className="w-4 h-4" />
              {t.auth.googleCta}
            </Button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
              <div className="relative flex justify-center text-xs"><span className="px-2 bg-card text-muted-foreground">{t.auth.or}</span></div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-sm text-muted-foreground">{t.auth.email}</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 bg-secondary/50 border-border" placeholder="you@email.com" required />
                </div>
              </div>
              <div>
                <Label htmlFor="password" className="text-sm text-muted-foreground">{t.auth.password}</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 bg-secondary/50 border-border" placeholder="••••••••" required />
                </div>
              </div>
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">{t.auth.forgotPassword}</Link>
              </div>
              <Button type="submit" className="w-full gold-glow font-semibold" disabled={loading}>
                {loading ? '...' : t.auth.loginCta}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {t.auth.noAccount} <Link to="/signup" className="text-primary hover:underline">{t.nav.signup}</Link>
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Login;
