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
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const Signup = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error(t.auth.passwordMismatch);
      return;
    }
    if (form.password.length < 6) {
      toast.error(t.auth.passwordMinLength);
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
      setResendCooldown(60);
    }
  };

  const handleVerifyOtp = useCallback(async (code: string) => {
    if (code.length !== 6) return;
    setOtpLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: registeredEmail,
      token: code,
      type: 'signup',
    });
    setOtpLoading(false);
    if (error) {
      toast.error(t.auth.otpInvalid);
      setOtpCode('');
    } else {
      toast.success(t.auth.otpSuccess);
      // Sign out so user logs in fresh
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 1500);
    }
  }, [registeredEmail, t, navigate]);

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: registeredEmail,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.auth.resendSuccess);
      setResendCooldown(60);
    }
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (result?.error) toast.error(String(result.error));
  };

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <Layout>
      <SEOHead title={t.auth.seoSignupTitle} description={t.auth.seoSignupDesc} robots="noindex, nofollow" />
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

                {/* OTP Input */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={(value) => {
                        setOtpCode(value);
                        if (value.length === 6) handleVerifyOtp(value);
                      }}
                      disabled={otpLoading}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.auth.otpPlaceholder}</p>

                  <Button
                    onClick={() => handleVerifyOtp(otpCode)}
                    className="w-full gold-glow font-semibold"
                    disabled={otpCode.length !== 6 || otpLoading}
                  >
                    {otpLoading ? t.auth.otpVerifying : t.auth.otpVerify}
                  </Button>
                </div>

                <div className="pt-2 space-y-2">
                  <p className="text-xs text-muted-foreground">{t.auth.orUseLink}</p>

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

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className="text-primary hover:text-primary/80"
                  >
                    {resendCooldown > 0
                      ? `${t.auth.resendCooldown} ${resendCooldown}s`
                      : t.auth.resendCode}
                  </Button>

                  <Link to="/login">
                    <Button variant="outline" className="w-full mt-2">{t.auth.goToLogin}</Button>
                  </Link>
                </div>
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
