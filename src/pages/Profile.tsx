import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Lock, Camera, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

const Profile = () => {
  const { t } = useLanguage();
  const { user, avatarUrl, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!user || loadedRef.current) return;
    loadedRef.current = true;
    supabase.from('profiles').select('name, phone, avatar_url').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setName(data.name || '');
          setPhone(data.phone || '');
        }
      });
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;

      await refreshProfile();
      toast.success(t.profile.avatarUpdated ?? 'Avatar updated!');
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleSaveName = async () => {
    if (!user) return;
    setSavingName(true);
    try {
      const { error } = await supabase.from('profiles').update({ name, phone }).eq('id', user.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await supabase.auth.updateUser({ data: { name, phone } });
      await refreshProfile();
      toast.success(t.profile.saveChanges + ' ✓');
    } catch (err: any) {
      console.error('Save profile error:', err);
      toast.error(err.message || 'Save failed');
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error(t.profile.enterCurrentPassword ?? 'Enter current password');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error(t.profile.newPasswordMinLength ?? 'New password must be at least 6 characters');
      return;
    }
    setSavingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) {
        toast.error(t.profile.wrongCurrentPassword ?? 'Current password is incorrect');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t.auth?.resetSuccess || 'Password updated!');
        setCurrentPassword('');
        setNewPassword('');
      }
    } catch (err: any) {
      console.error('Password change error:', err);
      toast.error(err.message || 'Failed');
    } finally {
      setSavingPassword(false);
    }
  };

  const displayName = name || user?.user_metadata?.name || '';
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : 'U';

  return (
    <Layout>
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4 max-w-2xl">
          <h1 className="font-display text-3xl font-bold text-gold-gradient mb-8">{t.profile.title}</h1>

          {/* Avatar */}
          <div className="glass-strong rounded-2xl p-6 border-gold-subtle mb-6">
            <h2 className="font-display font-semibold text-foreground mb-4">{t.profile.avatar}</h2>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer relative group">
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                <Avatar className="w-20 h-20">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback className="text-lg bg-primary/10 text-primary">
                    {uploadingAvatar ? <Loader2 className="w-6 h-6 animate-spin" /> : initials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </label>
              <div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                  <Button variant="outline" size="sm" className="border-border" asChild>
                    <span>{uploadingAvatar ? '...' : (t.profile.uploadAvatar ?? 'Upload')}</span>
                  </Button>
                </label>
              </div>
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
