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
  ArrowUpDown,
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

type SortKey = 'name' | 'slug' | 'tier' | 'status' | 'userName' | 'email';
type SortDir = 'asc' | 'desc';

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
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredCampaigns = useMemo(() => {
    const key = searchCampaign.toLowerCase().trim();
    let filtered = campaigns;
    if (key) {
      filtered = campaigns.filter((c: any) => {
        const u = users.find((u: any) => u.id === c.user_id);
        const searchStr = `${c.name} ${c.slug} ${u?.name || ''} ${u?.email || ''}`.toLowerCase();
        return searchStr.includes(key);
      });
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal = '';
      let bVal = '';
      if (sortKey === 'userName') {
        aVal = users.find((u: any) => u.id === a.user_id)?.name || '';
        bVal = users.find((u: any) => u.id === b.user_id)?.name || '';
      } else if (sortKey === 'email') {
        aVal = users.find((u: any) => u.id === a.user_id)?.email || '';
        bVal = users.find((u: any) => u.id === b.user_id)?.email || '';
      } else {
        aVal = (a[sortKey] || '').toString();
        bVal = (b[sortKey] || '').toString();
      }
      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [campaigns, searchCampaign, users, sortKey, sortDir]);

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

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(sortKeyName)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === sortKeyName ? 'text-primary' : 'text-muted-foreground/50'}`} />
      </div>
    </TableHead>
  );

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
              <Input value={searchCampaign} onChange={e => setSearchCampaign(e.target.value)} placeholder="Cari nama, slug, user, atau email..." className="max-w-sm bg-secondary/50 border-border" />

              <div className="glass rounded-2xl border-gold-subtle overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader label={t.admin.campaign ?? 'Campaign'} sortKeyName="name" />
                      <SortHeader label={t.admin.name ?? 'Name'} sortKeyName="userName" />
                      <SortHeader label={t.admin.email ?? 'Email'} sortKeyName="email" />
                      <SortHeader label={t.admin.slug ?? 'Slug'} sortKeyName="slug" />
                      <SortHeader label={t.admin.tier ?? 'Tier'} sortKeyName="tier" />
                      <SortHeader label={t.admin.status ?? 'Status'} sortKeyName="status" />
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
                      <TableHead>{t.admin.name}</TableHead>
                      <TableHead>{t.admin.email}</TableHead>
                      <TableHead>{t.admin.phone ?? 'Phone'}</TableHead>
                      <TableHead>{t.admin.role ?? 'Role'}</TableHead>
                      <TableHead>{t.admin.joined ?? 'Joined'}</TableHead>
                      <TableHead>{t.admin.actions ?? 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{u.email || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{u.phone || '-'}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_admin ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {u.is_admin ? <Shield className="w-3 h-3 inline mr-1" /> : null}
                            {u.is_admin ? (t.admin.adminRole ?? 'admin') : (t.admin.userRole ?? 'user')}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID') : '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => toggleUserAdmin(u.id, !u.is_admin)}
                            >
                              {u.is_admin ? (t.admin.setUser ?? 'Set User') : (t.admin.setAdmin ?? 'Set Admin')}
                            </Button>
                            <Button size="sm" variant="outline" className="border-destructive/30 text-destructive text-xs" onClick={() => deleteUser(u.id)}>
                              <Trash2 className="w-3 h-3" />
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
                      <TableHead>{t.admin.orderId ?? 'Order ID'}</TableHead>
                      <TableHead>{t.admin.user ?? 'User'}</TableHead>
                      <TableHead>{t.admin.campaign}</TableHead>
                      <TableHead>{t.admin.amount ?? 'Amount'}</TableHead>
                      <TableHead>{t.admin.status ?? 'Status'}</TableHead>
                      <TableHead>{t.admin.paymentMethod ?? 'Payment Method'}</TableHead>
                      <TableHead>{t.admin.paidAt ?? 'Paid At'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((tx: any) => {
                      const txUser = users.find((u: any) => u.id === tx.user_id);
                      const txCampaign = campaigns.find((c: any) => c.id === tx.campaign_id);
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-xs font-mono text-muted-foreground">{tx.midtrans_order_id || '-'}</TableCell>
                          <TableCell className="text-xs">{txUser?.name || txUser?.email || '-'}</TableCell>
                          <TableCell className="text-xs">{txCampaign?.name || '-'}</TableCell>
                          <TableCell className="text-xs font-semibold">Rp {(tx.amount || 0).toLocaleString('id-ID')}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${tx.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                              {tx.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tx.payment_method || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tx.paid_at ? new Date(tx.paid_at).toLocaleString('id-ID') : '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                    {payments.length === 0 && (
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

            {/* Vouchers Tab */}
            <TabsContent value="vouchers" className="space-y-3">
              <div className="flex justify-end">
                <Dialog open={voucherDialogOpen} onOpenChange={(open) => { setVoucherDialogOpen(open); if (!open) resetVoucherForm(); }}>
                  <DialogTrigger asChild>
                    <Button className="gold-glow gap-2 text-sm" onClick={() => { resetVoucherForm(); setVoucherDialogOpen(true); }}>
                      <Plus className="w-4 h-4" />
                      Tambah Voucher
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-strong border-border max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-display">{editingVoucherId ? 'Edit Voucher' : 'Buat Voucher Baru'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Kode Voucher</Label>
                        <Input value={voucherForm.code} onChange={e => setVoucherForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="PROMO50" className="mt-1 bg-secondary/50 border-border uppercase" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Tipe Diskon</Label>
                          <Select value={voucherForm.discount_type} onValueChange={v => setVoucherForm(prev => ({ ...prev, discount_type: v }))}>
                            <SelectTrigger className="mt-1 bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Persentase (%)</SelectItem>
                              <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Nilai Diskon</Label>
                          <Input type="number" value={voucherForm.discount_value} onChange={e => setVoucherForm(prev => ({ ...prev, discount_value: Number(e.target.value) }))} className="mt-1 bg-secondary/50 border-border" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Max Penggunaan (kosongkan = unlimited)</Label>
                        <Input type="number" value={voucherForm.max_uses} onChange={e => setVoucherForm(prev => ({ ...prev, max_uses: e.target.value }))} className="mt-1 bg-secondary/50 border-border" placeholder="Unlimited" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Valid Dari</Label>
                          <Input type="datetime-local" value={voucherForm.valid_from} onChange={e => setVoucherForm(prev => ({ ...prev, valid_from: e.target.value }))} className="mt-1 bg-secondary/50 border-border text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Valid Sampai</Label>
                          <Input type="datetime-local" value={voucherForm.valid_until} onChange={e => setVoucherForm(prev => ({ ...prev, valid_until: e.target.value }))} className="mt-1 bg-secondary/50 border-border text-xs" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={voucherForm.is_active} onCheckedChange={v => setVoucherForm(prev => ({ ...prev, is_active: v }))} />
                        <Label className="text-sm">Aktif</Label>
                      </div>
                      <Button className="w-full gold-glow" onClick={handleSaveVoucher} disabled={savingVoucher}>
                        {savingVoucher ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {editingVoucherId ? 'Update Voucher' : 'Buat Voucher'}
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
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vouchers.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono font-semibold text-foreground">{v.code}</TableCell>
                        <TableCell className="text-sm">
                          {v.discount_type === 'percentage' ? `${v.discount_value}%` : `Rp ${v.discount_value.toLocaleString('id-ID')}`}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {v.used_count}{v.max_uses ? ` / ${v.max_uses}` : ' / ∞'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {v.valid_from ? new Date(v.valid_from).toLocaleDateString('id-ID') : '—'}
                          {' – '}
                          {v.valid_until ? new Date(v.valid_until).toLocaleDateString('id-ID') : '—'}
                        </TableCell>
                        <TableCell>
                          <Switch checked={v.is_active} onCheckedChange={(checked) => handleToggleVoucherActive(v.id, checked)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => handleEditVoucher(v)}>Edit</Button>
                            <Button size="sm" variant="outline" className="text-xs border-destructive/30 text-destructive" onClick={() => handleDeleteVoucher(v.id)}>
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
            <TabsContent value="settings" className="space-y-4">
              <div className="glass rounded-2xl p-6 border-gold-subtle space-y-4">
                {['premium_price', 'original_price'].map(key => (
                  <div key={key}>
                    <Label className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</Label>
                    <Input
                      value={settings[key] ?? ''}
                      onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                      className="mt-1 bg-secondary/50 border-border"
                      placeholder={t.admin.settingPlaceholder ?? 'Enter value'}
                    />
                  </div>
                ))}
                <Button className="gold-glow" onClick={handleSaveSettings}>
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
