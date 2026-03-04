import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Megaphone,
  CreditCard,
  Settings,
  Crown,
  Ban,
  Shield,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Admin = () => {
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchCampaign, setSearchCampaign] = useState('');
  const [searchUser, setSearchUser] = useState('');

  const load = async () => {
    setLoading(true);

    const [{ data: cData }, { data: pData }, { data: txData }, { data: sData }, { data: rolesData }] = await Promise.all([
      supabase.from('campaigns' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('profiles' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('payments' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('site_settings' as any).select('*'),
      supabase.from('user_roles' as any).select('user_id, role'),
    ]);

    const adminSet = new Set(((rolesData as any[]) ?? []).filter(r => r.role === 'admin').map(r => r.user_id));

    setCampaigns((cData as any[]) ?? []);
    setPayments((txData as any[]) ?? []);
    setUsers(((pData as any[]) ?? []).map((u: any) => ({ ...u, is_admin: adminSet.has(u.id) })));

    const settingsMap: Record<string, string> = {};
    ((sData as any[]) ?? []).forEach((s: any) => {
      settingsMap[s.key] = s.value;
    });
    setSettings(settingsMap);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totalRevenue = payments
    .filter((p: any) => p.status === 'paid')
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  const filteredCampaigns = useMemo(() => {
    const key = searchCampaign.toLowerCase().trim();
    if (!key) return campaigns;
    return campaigns.filter((c: any) => `${c.name} ${c.slug}`.toLowerCase().includes(key));
  }, [campaigns, searchCampaign]);

  const filteredUsers = useMemo(() => {
    const key = searchUser.toLowerCase().trim();
    if (!key) return users;
    return users.filter((u: any) => `${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(key));
  }, [users, searchUser]);

  const handleSaveSettings = async () => {
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from('site_settings' as any).upsert({ key, value }, { onConflict: 'key' });
    }
    toast.success(t.admin.settingsSaved ?? 'Pengaturan berhasil disimpan');
  };

  const updateCampaign = async (id: string, patch: Record<string, any>, successMessage: string) => {
    const { error } = await supabase.from('campaigns' as any).update(patch).eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCampaigns(prev => prev.map((c: any) => (c.id === id ? { ...c, ...patch } : c)));
    toast.success(successMessage);
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase.from('campaigns' as any).delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCampaigns(prev => prev.filter((c: any) => c.id !== id));
    toast.success(t.admin.campaignDeleted ?? 'Campaign deleted');
  };

  const toggleUserAdmin = async (userId: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      const { error } = await supabase.from('user_roles' as any).insert({ user_id: userId, role: 'admin' });
      if (error && error.code !== '23505') {
        toast.error(error.message);
        return;
      }
      setUsers(prev => prev.map((u: any) => (u.id === userId ? { ...u, is_admin: true } : u)));
      toast.success(t.admin.adminGranted ?? 'Admin role granted');
      return;
    }

    const { error } = await supabase.from('user_roles' as any).delete().eq('user_id', userId).eq('role', 'admin');
    if (error) {
      toast.error(error.message);
      return;
    }
    setUsers(prev => prev.map((u: any) => (u.id === userId ? { ...u, is_admin: false } : u)));
    toast.success(t.admin.adminRevoked ?? 'Admin role revoked');
  };

  const deleteUser = async (userId: string) => {
    const { error } = await supabase.from('profiles' as any).delete().eq('id', userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setUsers(prev => prev.filter((u: any) => u.id !== userId));
    toast.success(t.admin.userDeleted ?? 'User profile deleted');
  };

  if (loading) {
    return (
      <Layout>
        <section className="py-24 md:py-32">
          <div className="container mx-auto px-4 text-center text-muted-foreground">{t.campaign.editor.loading}</div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4 space-y-6">
          <h1 className="font-display text-3xl font-bold text-gold-gradient">{t.admin.title}</h1>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <TabsList className="bg-secondary/50 border border-border flex-wrap h-auto">
              <TabsTrigger value="campaigns" className="gap-1">
                <Megaphone className="w-3 h-3" />
                {t.admin.campaigns}
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-1">
                <Users className="w-3 h-3" />
                {t.admin.users}
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-1">
                <CreditCard className="w-3 h-3" />
                {t.admin.transactions}
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1">
                <Settings className="w-3 h-3" />
                {t.admin.settings}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="campaigns" className="space-y-3">
              <Input value={searchCampaign} onChange={e => setSearchCampaign(e.target.value)} placeholder={t.admin.searchCampaign ?? 'Search campaigns'} className="max-w-sm bg-secondary/50 border-border" />

              <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.admin.campaign ?? 'Campaign'}</TableHead>
                      <TableHead>{t.admin.slug ?? 'Slug'}</TableHead>
                      <TableHead>{t.admin.tier ?? 'Tier'}</TableHead>
                      <TableHead>{t.admin.status ?? 'Status'}</TableHead>
                      <TableHead className="w-[360px]">{t.admin.actions ?? 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCampaigns.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${c.tier === 'premium' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {c.tier === 'premium' && <Crown className="w-3 h-3 inline mr-1" />}
                            {c.tier || 'free'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              c.status === 'published'
                                ? 'bg-green-500/20 text-green-400'
                                : c.status === 'blocked'
                                  ? 'bg-destructive/20 text-destructive'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {c.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {c.status !== 'published' && (
                              <Button size="sm" variant="outline" className="text-xs" onClick={() => updateCampaign(c.id, { status: 'published' }, t.admin.campaignPublished ?? 'Campaign published')}>
                                {t.admin.publish ?? 'Publish'}
                              </Button>
                            )}
                            {c.status !== 'draft' && (
                              <Button size="sm" variant="outline" className="text-xs" onClick={() => updateCampaign(c.id, { status: 'draft' }, t.admin.campaignDrafted ?? 'Campaign moved to draft')}>
                                {t.admin.draft ?? 'Draft'}
                              </Button>
                            )}
                            {c.status !== 'blocked' ? (
                              <Button size="sm" variant="outline" className="border-destructive/30 text-destructive gap-1 text-xs" onClick={() => updateCampaign(c.id, { status: 'blocked' }, t.admin.campaignBlocked ?? 'Campaign blocked')}>
                                <Ban className="w-3 h-3" /> {t.admin.block}
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => updateCampaign(c.id, { status: 'published' }, t.admin.campaignOpened ?? 'Campaign unblocked')}>
                                <Unlock className="w-3 h-3" /> {t.admin.unblock ?? 'Unblock'}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => updateCampaign(c.id, { tier: c.tier === 'premium' ? 'free' : 'premium' }, t.admin.tierUpdated ?? 'Campaign tier updated')}
                            >
                              {c.tier === 'premium' ? (t.admin.setFree ?? 'Set Free') : (t.admin.setPremium ?? 'Set Premium')}
                            </Button>
                            <Button size="sm" variant="outline" className="border-destructive/30 text-destructive gap-1 text-xs" onClick={() => deleteCampaign(c.id)}>
                              <Trash2 className="w-3 h-3" /> {t.admin.delete ?? 'Delete'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredCampaigns.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="p-8 text-center text-muted-foreground">
                          {t.admin.noData ?? 'Belum ada data'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-3">
              <Input value={searchUser} onChange={e => setSearchUser(e.target.value)} placeholder={t.admin.searchUser ?? 'Search users'} className="max-w-sm bg-secondary/50 border-border" />

              <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.admin.name ?? 'Name'}</TableHead>
                      <TableHead>{t.admin.email ?? 'Email'}</TableHead>
                      <TableHead>{t.admin.phone ?? 'Phone'}</TableHead>
                      <TableHead>{t.admin.role ?? 'Role'}</TableHead>
                      <TableHead>{t.admin.joined ?? 'Joined'}</TableHead>
                      <TableHead className="w-[220px]">{t.admin.actions ?? 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell className="text-muted-foreground">{u.phone || '-'}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_admin ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {u.is_admin && <Shield className="w-3 h-3 inline mr-1" />}
                            {u.is_admin ? (t.admin.adminRole ?? 'admin') : (t.admin.userRole ?? 'user')}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => toggleUserAdmin(u.id, !u.is_admin)}>
                              {u.is_admin ? (t.admin.setUser ?? 'Set User') : (t.admin.setAdmin ?? 'Set Admin')}
                            </Button>
                            <Button size="sm" variant="outline" className="border-destructive/30 text-destructive gap-1 text-xs" onClick={() => deleteUser(u.id)}>
                              <Trash2 className="w-3 h-3" /> {t.admin.delete ?? 'Delete'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                          {t.admin.noData ?? 'Belum ada data'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="transactions">
              <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.admin.date ?? 'Date'}</TableHead>
                      <TableHead>{t.admin.campaign ?? 'Campaign'}</TableHead>
                      <TableHead>{t.admin.amount ?? 'Amount'}</TableHead>
                      <TableHead>{t.admin.status ?? 'Status'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((tx: any) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs">{new Date(tx.created_at).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell className="text-muted-foreground">{tx.campaign_id}</TableCell>
                        <TableCell className="text-primary font-semibold">Rp {(tx.amount || 0).toLocaleString('id-ID')}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${tx.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}`}>{tx.status}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {payments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="p-8 text-center text-muted-foreground">
                          {t.admin.noData ?? 'Belum ada data'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="glass-strong rounded-2xl p-6 border-gold-subtle space-y-6">
                <h3 className="font-display font-semibold text-foreground">{t.admin.settings}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'midtrans_server_key', label: 'Midtrans Server Key', type: 'password' },
                    { key: 'midtrans_client_key', label: 'Midtrans Client Key', type: 'text' },
                    { key: 'midtrans_mode', label: 'Midtrans Mode (sandbox / production)', type: 'text' },
                    { key: 'adsense_id', label: 'Google AdSense Publisher ID (ca-pub-xxx)', type: 'text' },
                    { key: 'whatsapp_link', label: 'WhatsApp Chat Link', type: 'text' },
                    { key: 'telegram_link', label: 'Telegram Chat Link', type: 'text' },
                    { key: 'vps_storage_url', label: 'VPS Storage URL', type: 'text' },
                  ].map(item => (
                    <div key={item.key}>
                      <label className="text-sm text-muted-foreground">{item.label}</label>
                      <Input type={item.type || 'text'} value={settings[item.key] || ''} onChange={e => setSettings(prev => ({ ...prev, [item.key]: e.target.value }))} className="mt-1 bg-secondary/50 border-border text-sm" placeholder={item.key === 'midtrans_mode' ? 'sandbox' : (t.admin.settingPlaceholder ?? 'Enter value')} />
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
