import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock, Camera } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const Profile = () => {
  const { t } = useLanguage();
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('name, phone, avatar_url').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setName(data.name || '');
          setPhone(data.phone || '');
        }
      });
  }, [user]);

  const handleSaveName = async () => {
    if (!user) return;
    setSavingName(true);
    const { error } = await supabase.from('profiles').update({ name, phone }).eq('id', user.id);
    setSavingName(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.profile.saveChanges + ' ✓');
      await refreshProfile();
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Masukkan password saat ini');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    setSavingPassword(true);

    // Verify current password by re-signing in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || '',
      password: currentPassword,
    });

    if (signInError) {
      setSavingPassword(false);
      toast.error('Password saat ini salah');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success((t.auth as any).resetSuccess || 'Password updated!');
      setCurrentPassword('');
      setNewPassword('');
    }
  };

  return (
    <Layout>
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4 max-w-2xl">
          <h1 className="font-display text-3xl font-bold text-gold-gradient mb-8">{t.profile.title}</h1>

          {/* Avatar */}
          <div className="glass-strong rounded-2xl p-6 border-gold-subtle mb-6">
            <h2 className="font-display font-semibold text-foreground mb-4">{t.profile.avatar}</h2>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center relative group cursor-pointer">
                <User className="w-10 h-10 text-primary" />
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-foreground" />
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-border">Upload</Button>
            </div>
          </div>

          {/* Edit Name & Phone */}
          <div className="glass-strong rounded-2xl p-6 border-gold-subtle mb-6">
            <h2 className="font-display font-semibold text-foreground mb-4">{t.profile.changeName}</h2>
            <div className="space-y-3">
              <div>
                <Label className="text-sm text-muted-foreground">{t.auth.name}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 bg-secondary/50 border-border" />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">{t.auth.phone}</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 bg-secondary/50 border-border" />
              </div>
              <Button className="gold-glow font-semibold" onClick={handleSaveName} disabled={savingName}>
                {savingName ? '...' : t.profile.saveChanges}
              </Button>
            </div>
          </div>

          {/* Change Password */}
          <div className="glass-strong rounded-2xl p-6 border-gold-subtle">
            <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2"><Lock className="w-4 h-4" />{t.profile.changePassword}</h2>
            <div className="space-y-3">
              <div>
                <Label className="text-sm text-muted-foreground">{t.profile.currentPassword}</Label>
                <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="mt-1 bg-secondary/50 border-border" />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">{t.profile.newPassword}</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1 bg-secondary/50 border-border" />
              </div>
              <Button className="gold-glow font-semibold" onClick={handleChangePassword} disabled={savingPassword}>
                {savingPassword ? '...' : t.profile.saveChanges}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Profile;
