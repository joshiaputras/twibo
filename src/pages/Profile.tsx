import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock, Camera } from 'lucide-react';
import { useState } from 'react';

const Profile = () => {
  const { t } = useLanguage();
  const [name, setName] = useState('John Doe');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

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

          {/* Edit Name */}
          <div className="glass-strong rounded-2xl p-6 border-gold-subtle mb-6">
            <h2 className="font-display font-semibold text-foreground mb-4">{t.profile.changeName}</h2>
            <div className="space-y-3">
              <div>
                <Label className="text-sm text-muted-foreground">{t.auth.name}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 bg-secondary/50 border-border" />
              </div>
              <Button className="gold-glow font-semibold">{t.profile.saveChanges}</Button>
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
              <Button className="gold-glow font-semibold">{t.profile.saveChanges}</Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Profile;