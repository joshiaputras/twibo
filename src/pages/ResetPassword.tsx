import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const ResetPassword = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t.auth.passwordMismatch || 'Passwords do not match');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully!');
      navigate('/login');
    }
  };

  return (
    <Layout>
      <section className="py-24 md:py-32 flex items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-md mx-auto px-4">
          <div className="glass-strong rounded-2xl p-8 border-gold-subtle gold-glow">
            <div className="text-center mb-8">
              <h1 className="font-display text-3xl font-bold text-gold-gradient mb-2">Reset Password</h1>
              <p className="text-muted-foreground text-sm">Enter your new password</p>
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
                {loading ? '...' : 'Update Password'}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default ResetPassword;
