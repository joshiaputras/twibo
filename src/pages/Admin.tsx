import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Megaphone, CreditCard, Settings, Crown, Ban } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Admin = () => {
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Load campaigns
      const { data: cData } = await supabase.from('campaigns' as any).select('*').order('created_at', { ascending: false });

      // Load profiles
      const { data: pData } = await supabase.from('profiles' as any).select('*').order('created_at', { ascending: false });

      // Load payments
      const { data: txData } = await supabase.from('payments' as any).select('*').order('created_at', { ascending: false });

      // Load settings
      const { data: sData } = await supabase.from('site_settings' as any).select('*');

      setCampaigns((cData as any[]) ?? []);
      setUsers((pData as any[]) ?? []);
      setPayments((txData as any[]) ?? []);

      const settingsMap: Record<string, string> = {};
      ((sData as any[]) ?? []).forEach((s: any) => { settingsMap[s.key] = s.value; });
      setSettings(settingsMap);

      setLoading(false);
    };
    load();
  }, []);

  const totalRevenue = payments
    .filter((p: any) => p.status === 'paid')
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  const handleSaveSettings = async () => {
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from('site_settings' as any).update({ value }).eq('key', key);
    }
    toast.success(t.admin.settingsSaved ?? 'Pengaturan berhasil disimpan');
  };

  const handleBlockCampaign = async (id: string) => {
    await supabase.from('campaigns' as any).update({ status: 'blocked' }).eq('id', id);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'blocked' } : c));
    toast.success(t.admin.campaignBlocked ?? 'Campaign diblokir');
  };

  if (loading) {
    return (
      <Layout>
        <section className="py-24 md:py-32">
          <div className="container mx-auto px-4 text-center text-muted-foreground">Loading...</div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <h1 className="font-display text-3xl font-bold text-gold-gradient mb-8">{t.admin.title}</h1>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: t.admin.totalCampaigns, value: campaigns.length.toString(), icon: Megaphone },
              { label: t.admin.totalUsers, value: users.length.toString(), icon: Users },
              { label: t.admin.totalRevenue, value: `Rp ${totalRevenue.toLocaleString('id-ID')}`, icon: CreditCard },
            ].map((s, i) => (
              <div key={i} className="glass rounded-xl p-6 border-gold-subtle">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Tabs defaultValue="campaigns" className="space-y-4">
            <TabsList className="bg-secondary/50 border border-border">
              <TabsTrigger value="campaigns" className="gap-1"><Megaphone className="w-3 h-3" />{t.admin.campaigns}</TabsTrigger>
              <TabsTrigger value="users" className="gap-1"><Users className="w-3 h-3" />{t.admin.users}</TabsTrigger>
              <TabsTrigger value="transactions" className="gap-1"><CreditCard className="w-3 h-3" />{t.admin.transactions}</TabsTrigger>
              <TabsTrigger value="settings" className="gap-1"><Settings className="w-3 h-3" />{t.admin.settings}</TabsTrigger>
            </TabsList>

            <TabsContent value="campaigns">
              <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border/50">
                      <th className="text-left p-4 text-muted-foreground font-medium">Campaign</th>
                      <th className="p-4 text-muted-foreground font-medium">Slug</th>
                      <th className="p-4 text-muted-foreground font-medium">{t.admin.tier ?? 'Tier'}</th>
                      <th className="p-4 text-muted-foreground font-medium">Status</th>
                      <th className="p-4 text-muted-foreground font-medium">{t.admin.actions ?? 'Actions'}</th>
                    </tr></thead>
                    <tbody>
                      {campaigns.map((c: any) => (
                        <tr key={c.id} className="border-b border-border/30">
                          <td className="p-4 text-foreground">{c.name}</td>
                          <td className="p-4 text-muted-foreground">{c.slug}</td>
                          <td className="p-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${c.tier === 'premium' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {c.tier === 'premium' && <Crown className="w-3 h-3 inline mr-1" />}{c.tier || 'free'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              c.status === 'published' ? 'bg-green-500/20 text-green-400' :
                              c.status === 'blocked' ? 'bg-destructive/20 text-destructive' :
                              'bg-muted text-muted-foreground'
                            }`}>{c.status}</span>
                          </td>
                          <td className="p-4">
                            <Button variant="outline" size="sm" className="border-destructive/30 text-destructive gap-1 text-xs" onClick={() => handleBlockCampaign(c.id)}>
                              <Ban className="w-3 h-3" />{t.admin.block}
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {campaigns.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t.admin.noData ?? 'Belum ada data'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border/50">
                      <th className="text-left p-4 text-muted-foreground font-medium">{t.admin.name ?? 'Name'}</th>
                      <th className="p-4 text-muted-foreground font-medium">Email</th>
                      <th className="p-4 text-muted-foreground font-medium">{t.admin.phone ?? 'Phone'}</th>
                      <th className="p-4 text-muted-foreground font-medium">{t.admin.joined ?? 'Joined'}</th>
                    </tr></thead>
                    <tbody>
                      {users.map((u: any) => (
                        <tr key={u.id} className="border-b border-border/30">
                          <td className="p-4 text-foreground">{u.name || '-'}</td>
                          <td className="p-4 text-muted-foreground">{u.email}</td>
                          <td className="p-4 text-muted-foreground">{u.phone || '-'}</td>
                          <td className="p-4 text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString('id-ID')}</td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{t.admin.noData ?? 'Belum ada data'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="transactions">
              <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border/50">
                      <th className="text-left p-4 text-muted-foreground font-medium">{t.admin.date ?? 'Date'}</th>
                      <th className="p-4 text-muted-foreground font-medium">Campaign</th>
                      <th className="p-4 text-muted-foreground font-medium">{t.admin.amount ?? 'Amount'}</th>
                      <th className="p-4 text-muted-foreground font-medium">Status</th>
                    </tr></thead>
                    <tbody>
                      {payments.map((tx: any) => (
                        <tr key={tx.id} className="border-b border-border/30">
                          <td className="p-4 text-foreground text-xs">{new Date(tx.created_at).toLocaleDateString('id-ID')}</td>
                          <td className="p-4 text-muted-foreground">{tx.campaign_id}</td>
                          <td className="p-4 text-primary font-semibold">Rp {(tx.amount || 0).toLocaleString('id-ID')}</td>
                          <td className="p-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${tx.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}`}>{tx.status}</span>
                          </td>
                        </tr>
                      ))}
                      {payments.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{t.admin.noData ?? 'Belum ada data'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="glass-strong rounded-2xl p-6 border-gold-subtle space-y-6">
                <h3 className="font-display font-semibold text-foreground">{t.admin.settings}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'midtrans_server_key', label: 'Midtrans Server Key' },
                    { key: 'midtrans_client_key', label: 'Midtrans Client Key' },
                    { key: 'adsense_id', label: 'Google AdSense ID' },
                    { key: 'whatsapp_link', label: 'WhatsApp Chat Link' },
                    { key: 'telegram_link', label: 'Telegram Chat Link' },
                    { key: 'vps_storage_url', label: 'VPS Storage URL' },
                  ].map(item => (
                    <div key={item.key}>
                      <label className="text-sm text-muted-foreground">{item.label}</label>
                      <Input
                        value={settings[item.key] || ''}
                        onChange={e => setSettings(prev => ({ ...prev, [item.key]: e.target.value }))}
                        className="mt-1 bg-secondary/50 border-border text-sm"
                        placeholder={item.label}
                      />
                    </div>
                  ))}
                </div>
                <Button className="gold-glow font-semibold" onClick={handleSaveSettings}>
                  {t.admin.saveSettings ?? 'Save Settings'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </Layout>
  );
};

export default Admin;
