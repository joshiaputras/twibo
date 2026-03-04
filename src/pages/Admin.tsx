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
  Ticket,
  Plus,
  Loader2,
  Star,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const Admin = () => {
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCampaign, setSearchCampaign] = useState('');
  const [searchUser, setSearchUser] = useState('');

  // Voucher form
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);
  const [voucherForm, setVoucherForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 0,
    max_uses: '',
    valid_from: '',
    valid_until: '',
    is_active: true,
  });
  const [savingVoucher, setSavingVoucher] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);

    const [{ data: cData }, { data: pData }, { data: txData }, { data: sData }, { data: rolesData }, { data: vData }] = await Promise.all([
      supabase.from('campaigns' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('profiles' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('payments' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('site_settings' as any).select('*'),
      supabase.from('user_roles' as any).select('user_id, role'),
      supabase.from('vouchers' as any).select('*').order('created_at', { ascending: false }),
    ]);

    const adminSet = new Set(((rolesData as any[]) ?? []).filter(r => r.role === 'admin').map(r => r.user_id));

    setCampaigns((cData as any[]) ?? []);
    setPayments((txData as any[]) ?? []);
    setUsers(((pData as any[]) ?? []).map((u: any) => ({ ...u, is_admin: adminSet.has(u.id) })));
    setVouchers((vData as any[]) ?? []);

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

  // Voucher CRUD
  const resetVoucherForm = () => {
    setVoucherForm({ code: '', discount_type: 'percentage', discount_value: 0, max_uses: '', valid_from: '', valid_until: '', is_active: true });
    setEditingVoucherId(null);
  };

  const handleSaveVoucher = async () => {
    if (!voucherForm.code.trim()) {
      toast.error('Kode voucher wajib diisi');
      return;
    }
    setSavingVoucher(true);
    const payload = {
      code: voucherForm.code.toUpperCase().trim(),
      discount_type: voucherForm.discount_type,
      discount_value: Number(voucherForm.discount_value) || 0,
      max_uses: voucherForm.max_uses ? Number(voucherForm.max_uses) : null,
      valid_from: voucherForm.valid_from || null,
      valid_until: voucherForm.valid_until || null,
      is_active: voucherForm.is_active,
    };

    if (editingVoucherId) {
      const { error } = await supabase.from('vouchers' as any).update(payload).eq('id', editingVoucherId);
      if (error) {
        toast.error(error.message);
        setSavingVoucher(false);
        return;
      }
      setVouchers(prev => prev.map(v => v.id === editingVoucherId ? { ...v, ...payload } : v));
      toast.success('Voucher berhasil diperbarui');
    } else {
      const { data, error } = await supabase.from('vouchers' as any).insert(payload).select().single();
      if (error) {
        toast.error(error.message);
        setSavingVoucher(false);
        return;
      }
      setVouchers(prev => [data, ...prev]);
      toast.success('Voucher berhasil dibuat');
    }

    setSavingVoucher(false);
    setVoucherDialogOpen(false);
    resetVoucherForm();
  };

  const handleEditVoucher = (v: any) => {
    setVoucherForm({
      code: v.code,
      discount_type: v.discount_type,
      discount_value: v.discount_value,
      max_uses: v.max_uses?.toString() || '',
      valid_from: v.valid_from ? new Date(v.valid_from).toISOString().slice(0, 16) : '',
      valid_until: v.valid_until ? new Date(v.valid_until).toISOString().slice(0, 16) : '',
      is_active: v.is_active,
    });
    setEditingVoucherId(v.id);
    setVoucherDialogOpen(true);
  };

  const handleDeleteVoucher = async (id: string) => {
    const { error } = await supabase.from('vouchers' as any).delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setVouchers(prev => prev.filter(v => v.id !== id));
    toast.success('Voucher berhasil dihapus');
  };

  const handleToggleVoucherActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from('vouchers' as any).update({ is_active: isActive }).eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setVouchers(prev => prev.map(v => v.id === id ? { ...v, is_active: isActive } : v));
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
              <TabsTrigger value="vouchers" className="gap-1">
                <Ticket className="w-3 h-3" />
                Voucher
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1">
                <Settings className="w-3 h-3" />
                {t.admin.settings}
              </TabsTrigger>
            </TabsList>

            {/* Campaigns Tab */}
            <TabsContent value="campaigns" className="space-y-3">
              <Input value={searchCampaign} onChange={e => setSearchCampaign(e.target.value)} placeholder={t.admin.searchCampaign ?? 'Search campaigns'} className="max-w-sm bg-secondary/50 border-border" />

              <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.admin.campaign ?? 'Campaign'}</TableHead>
                      <TableHead>{t.admin.name ?? 'Name'}</TableHead>
                      <TableHead>{t.admin.email ?? 'Email'}</TableHead>
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
                        <TableCell className="text-muted-foreground text-xs">{users.find((u: any) => u.id === c.user_id)?.name || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{users.find((u: any) => u.id === c.user_id)?.email || '-'}</TableCell>
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
                            {users.find((u: any) => u.id === c.user_id)?.is_admin && (
                              <Button
                                size="sm"
                                variant="outline"
                                className={`text-xs gap-1 ${c.is_featured ? 'border-primary/50 text-primary' : ''}`}
                                onClick={() => updateCampaign(c.id, { is_featured: !c.is_featured }, c.is_featured ? 'Dihapus dari featured' : 'Ditampilkan di homepage')}
                              >
                                <Star className={`w-3 h-3 ${c.is_featured ? 'fill-primary' : ''}`} />
                                {c.is_featured ? 'Featured ✓' : 'Set Featured'}
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="border-destructive/30 text-destructive gap-1 text-xs" onClick={() => deleteCampaign(c.id)}>
                              <Trash2 className="w-3 h-3" /> {t.admin.delete ?? 'Delete'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredCampaigns.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                          {t.admin.noData ?? 'Belum ada data'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Users Tab */}
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

            {/* Transactions Tab */}
            <TabsContent value="transactions" className="space-y-3">
              <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.admin.date ?? 'Date'}</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>{t.admin.campaign ?? 'Campaign'}</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Metode</TableHead>
                      <TableHead>{t.admin.amount ?? 'Amount'}</TableHead>
                      <TableHead>Voucher</TableHead>
                      <TableHead>{t.admin.status ?? 'Status'}</TableHead>
                      <TableHead>Paid At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.filter((tx: any) => {
                      if (tx.status === 'pending') {
                        const created = new Date(tx.created_at).getTime();
                        const now = Date.now();
                        if (now - created > 24 * 60 * 60 * 1000) return false;
                      }
                      return true;
                    }).map((tx: any) => {
                      const camp = campaigns.find((c: any) => c.id === tx.campaign_id);
                      const usr = users.find((u: any) => u.id === tx.user_id);
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{tx.midtrans_order_id || '-'}</TableCell>
                          <TableCell className="font-medium">{camp?.name || tx.campaign_id?.substring(0, 8)}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{usr?.name || usr?.email || tx.user_id?.substring(0, 8)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tx.payment_method || '-'}</TableCell>
                          <TableCell className="text-primary font-semibold">
                            Rp {(tx.amount || 0).toLocaleString('id-ID')}
                            {tx.discount_amount > 0 && (
                              <span className="text-xs text-green-400 block">-Rp {tx.discount_amount.toLocaleString('id-ID')}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tx.voucher_code || '-'}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              tx.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                              tx.status === 'failed' ? 'bg-destructive/20 text-destructive' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>{tx.status}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tx.paid_at ? new Date(tx.paid_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                    {payments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="p-8 text-center text-muted-foreground">
                          {t.admin.noData ?? 'Belum ada data'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Vouchers Tab */}
            <TabsContent value="vouchers" className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-semibold text-foreground">Kelola Voucher</h3>
                <Dialog open={voucherDialogOpen} onOpenChange={(open) => { setVoucherDialogOpen(open); if (!open) resetVoucherForm(); }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gold-glow gap-1 text-xs">
                      <Plus className="w-3 h-3" /> Tambah Voucher
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-strong border-gold-subtle">
                    <DialogHeader>
                      <DialogTitle className="text-gold-gradient">{editingVoucherId ? 'Edit Voucher' : 'Buat Voucher Baru'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm">Kode Voucher</Label>
                        <Input
                          value={voucherForm.code}
                          onChange={e => setVoucherForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                          placeholder="DISKON50"
                          className="mt-1 bg-secondary/50 border-border uppercase"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm">Tipe Diskon</Label>
                          <Select value={voucherForm.discount_type} onValueChange={v => setVoucherForm(prev => ({ ...prev, discount_type: v }))}>
                            <SelectTrigger className="mt-1 bg-secondary/50 border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Persentase (%)</SelectItem>
                              <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm">Nilai Diskon</Label>
                          <Input
                            type="number"
                            value={voucherForm.discount_value}
                            onChange={e => setVoucherForm(prev => ({ ...prev, discount_value: Number(e.target.value) }))}
                            placeholder={voucherForm.discount_type === 'percentage' ? '50' : '25000'}
                            className="mt-1 bg-secondary/50 border-border"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Maks Penggunaan (kosongkan = unlimited)</Label>
                        <Input
                          type="number"
                          value={voucherForm.max_uses}
                          onChange={e => setVoucherForm(prev => ({ ...prev, max_uses: e.target.value }))}
                          placeholder="100"
                          className="mt-1 bg-secondary/50 border-border"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm">Berlaku Dari</Label>
                          <Input
                            type="datetime-local"
                            value={voucherForm.valid_from}
                            onChange={e => setVoucherForm(prev => ({ ...prev, valid_from: e.target.value }))}
                            className="mt-1 bg-secondary/50 border-border text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Berlaku Sampai</Label>
                          <Input
                            type="datetime-local"
                            value={voucherForm.valid_until}
                            onChange={e => setVoucherForm(prev => ({ ...prev, valid_until: e.target.value }))}
                            className="mt-1 bg-secondary/50 border-border text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={voucherForm.is_active} onCheckedChange={v => setVoucherForm(prev => ({ ...prev, is_active: v }))} />
                        <Label className="text-sm">Aktif</Label>
                      </div>
                      <Button className="w-full gold-glow font-semibold" onClick={handleSaveVoucher} disabled={savingVoucher}>
                        {savingVoucher ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {editingVoucherId ? 'Simpan Perubahan' : 'Buat Voucher'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Diskon</TableHead>
                      <TableHead>Penggunaan</TableHead>
                      <TableHead>Berlaku</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[200px]">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vouchers.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono font-semibold text-primary">{v.code}</TableCell>
                        <TableCell className="text-sm">
                          {v.discount_type === 'percentage' ? `${v.discount_value}%` : `Rp ${v.discount_value.toLocaleString('id-ID')}`}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {v.used_count}{v.max_uses ? `/${v.max_uses}` : ' / ∞'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {v.valid_from ? new Date(v.valid_from).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-'}
                          {' → '}
                          {v.valid_until ? new Date(v.valid_until).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '∞'}
                        </TableCell>
                        <TableCell>
                          <Switch checked={v.is_active} onCheckedChange={(checked) => handleToggleVoucherActive(v.id, checked)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => handleEditVoucher(v)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="outline" className="border-destructive/30 text-destructive gap-1 text-xs" onClick={() => handleDeleteVoucher(v.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {vouchers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                          Belum ada voucher
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <div className="glass-strong rounded-2xl p-6 border-gold-subtle space-y-6">
                <h3 className="font-display font-semibold text-foreground">{t.admin.settings}</h3>

                {/* Pricing Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Crown className="w-4 h-4 text-primary" />
                    Pengaturan Harga
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Harga Premium (Rp)</label>
                      <Input type="number" value={settings['premium_price'] || '50000'} onChange={e => setSettings(prev => ({ ...prev, premium_price: e.target.value }))} className="mt-1 bg-secondary/50 border-border text-sm" placeholder="50000" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Harga Coret / Original (Rp)</label>
                      <Input type="number" value={settings['premium_original_price'] || '149000'} onChange={e => setSettings(prev => ({ ...prev, premium_original_price: e.target.value }))} className="mt-1 bg-secondary/50 border-border text-sm" placeholder="149000" />
                    </div>
                  </div>
                </div>

                <hr className="border-border/30" />

                {/* Gateway & Other Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'midtrans_server_key', label: 'Midtrans Server Key', type: 'password' },
                    { key: 'midtrans_client_key', label: 'Midtrans Client Key', type: 'text' },
                    { key: 'midtrans_mode', label: 'Midtrans Mode (sandbox / production)', type: 'text' },
                    { key: 'adsense_id', label: 'Google AdSense Publisher ID (ca-pub-xxx)', type: 'text' },
                    { key: 'smtp_host', label: 'SMTP Host (e.g. smtp.gmail.com)', type: 'text' },
                    { key: 'smtp_port', label: 'SMTP Port (587 / 465)', type: 'text' },
                    { key: 'smtp_username', label: 'SMTP Username / Email', type: 'text' },
                    { key: 'smtp_password', label: 'SMTP Password / App Password', type: 'password' },
                    { key: 'smtp_from_email', label: 'SMTP From Email', type: 'text' },
                    { key: 'smtp_from_name', label: 'SMTP From Name', type: 'text' },
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
