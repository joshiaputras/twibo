import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
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
      toast.error('Password must be at least 6 characters');
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
      toast.success((t.auth as any).signupSuccess || 'Account created! Check your email to verify.');
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
      <section className="py-24 md:py-32 flex items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-md mx-auto px-4">
          <div className="glass-strong rounded-2xl p-8 border-gold-subtle gold-glow">
            <div className="text-center mb-8">
              <h1 className="font-display text-3xl font-bold text-gold-gradient mb-2">{t.auth.signupTitle}</h1>
              <p className="text-muted-foreground text-sm">{t.auth.signupSubtitle}</p>
            </div>

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
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Signup;
