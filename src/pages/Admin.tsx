import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Users, Megaphone, CreditCard, Settings, Crown, Ban, Shield, Trash2, Unlock, Ticket,
  Plus, Loader2, Star, ArrowUpDown, BookOpen, Pencil, Upload, Clock, Eye,
} from 'lucide-react';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { compressImageToWebP, IMAGE_PRESETS } from '@/utils/imageCompress';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
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
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCampaign, setSearchCampaign] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Voucher form
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);
  const [voucherForm, setVoucherForm] = useState({
    code: '', discount_type: 'percentage', discount_value: 0, max_uses: '', max_uses_per_user: '',
    valid_from: '', valid_until: '', is_active: true,
  });
  const [savingVoucher, setSavingVoucher] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);

  // Blog form
  const [blogDialogOpen, setBlogDialogOpen] = useState(false);
  const [editingBlogId, setEditingBlogId] = useState<string | null>(null);
  const [savingBlog, setSavingBlog] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const [blogForm, setBlogForm] = useState({
    title: '', slug: '', content: '', excerpt: '', cover_image_url: '',
    meta_title: '', meta_description: '', tags: '', status: 'draft',
    scheduled_at: '',
  });

  const load = async () => {
    setLoading(true);
    const [{ data: cData }, { data: pData }, { data: txData }, { data: sData }, { data: rolesData }, { data: vData }, { data: bData }] = await Promise.all([
      supabase.from('campaigns' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('profiles' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('payments' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('site_settings' as any).select('*'),
      supabase.from('user_roles' as any).select('user_id, role'),
      supabase.from('vouchers' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('blog_posts' as any).select('*').order('created_at', { ascending: false }),
    ]);
    const adminSet = new Set(((rolesData as any[]) ?? []).filter(r => r.role === 'admin').map(r => r.user_id));
    setCampaigns((cData as any[]) ?? []);
    setPayments((txData as any[]) ?? []);
    setUsers(((pData as any[]) ?? []).map((u: any) => ({ ...u, is_admin: adminSet.has(u.id) })));
    setVouchers((vData as any[]) ?? []);
    setBlogPosts((bData as any[]) ?? []);
    const settingsMap: Record<string, string> = {};
    ((sData as any[]) ?? []).forEach((s: any) => { settingsMap[s.key] = s.value; });
    setSettings(settingsMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalRevenue = payments.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filteredCampaigns = useMemo(() => {
    const key = searchCampaign.toLowerCase().trim();
    let filtered = campaigns;
    if (key) {
      filtered = campaigns.filter((c: any) => {
        const u = users.find((u: any) => u.id === c.user_id);
        return `${c.name} ${c.slug} ${u?.name || ''} ${u?.email || ''}`.toLowerCase().includes(key);
      });
    }
    return [...filtered].sort((a, b) => {
      let aVal = '', bVal = '';
      if (sortKey === 'userName') { aVal = users.find((u: any) => u.id === a.user_id)?.name || ''; bVal = users.find((u: any) => u.id === b.user_id)?.name || ''; }
      else if (sortKey === 'email') { aVal = users.find((u: any) => u.id === a.user_id)?.email || ''; bVal = users.find((u: any) => u.id === b.user_id)?.email || ''; }
      else { aVal = (a[sortKey] || '').toString(); bVal = (b[sortKey] || '').toString(); }
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
    if (error) { toast.error(error.message); return; }
    setCampaigns(prev => prev.map((c: any) => (c.id === id ? { ...c, ...patch } : c)));
    toast.success(successMessage);
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase.from('campaigns' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setCampaigns(prev => prev.filter((c: any) => c.id !== id));
    toast.success(t.admin.campaignDeleted ?? 'Campaign deleted');
  };

  const toggleUserAdmin = async (userId: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      const { error } = await supabase.from('user_roles' as any).insert({ user_id: userId, role: 'admin' });
      if (error && error.code !== '23505') { toast.error(error.message); return; }
      setUsers(prev => prev.map((u: any) => (u.id === userId ? { ...u, is_admin: true } : u)));
      toast.success(t.admin.adminGranted ?? 'Admin role granted');
      return;
    }
    const { error } = await supabase.from('user_roles' as any).delete().eq('user_id', userId).eq('role', 'admin');
    if (error) { toast.error(error.message); return; }
    setUsers(prev => prev.map((u: any) => (u.id === userId ? { ...u, is_admin: false } : u)));
    toast.success(t.admin.adminRevoked ?? 'Admin role revoked');
  };

  const deleteUser = async (userId: string) => {
    const { error } = await supabase.from('profiles' as any).delete().eq('id', userId);
    if (error) { toast.error(error.message); return; }
    setUsers(prev => prev.filter((u: any) => u.id !== userId));
    toast.success(t.admin.userDeleted ?? 'User profile deleted');
  };

  // Voucher CRUD
  const resetVoucherForm = () => {
    setVoucherForm({ code: '', discount_type: 'percentage', discount_value: 0, max_uses: '', max_uses_per_user: '', valid_from: '', valid_until: '', is_active: true });
    setEditingVoucherId(null);
  };

  const handleSaveVoucher = async () => {
    if (!voucherForm.code.trim()) { toast.error(t.admin?.voucherCodeRequired ?? 'Voucher code is required'); return; }
    setSavingVoucher(true);
    const payload = {
      code: voucherForm.code.toUpperCase().trim(),
      discount_type: voucherForm.discount_type,
      discount_value: Number(voucherForm.discount_value) || 0,
      max_uses: voucherForm.max_uses ? Number(voucherForm.max_uses) : null,
      max_uses_per_user: voucherForm.max_uses_per_user ? Number(voucherForm.max_uses_per_user) : null,
      valid_from: voucherForm.valid_from || null,
      valid_until: voucherForm.valid_until || null,
      is_active: voucherForm.is_active,
    };
    if (editingVoucherId) {
      const { error } = await supabase.from('vouchers' as any).update(payload).eq('id', editingVoucherId);
      if (error) { toast.error(error.message); setSavingVoucher(false); return; }
      setVouchers(prev => prev.map(v => v.id === editingVoucherId ? { ...v, ...payload } : v));
      toast.success(t.admin?.voucherUpdated ?? 'Voucher updated');
    } else {
      const { data, error } = await supabase.from('vouchers' as any).insert(payload).select().single();
      if (error) { toast.error(error.message); setSavingVoucher(false); return; }
      setVouchers(prev => [data, ...prev]);
      toast.success(t.admin?.voucherCreated ?? 'Voucher created');
    }
    setSavingVoucher(false);
    setVoucherDialogOpen(false);
    resetVoucherForm();
  };

  const handleEditVoucher = (v: any) => {
    setVoucherForm({
      code: v.code, discount_type: v.discount_type, discount_value: v.discount_value,
      max_uses: v.max_uses?.toString() || '',
      max_uses_per_user: v.max_uses_per_user?.toString() || '',
      valid_from: v.valid_from ? new Date(v.valid_from).toISOString().slice(0, 16) : '',
      valid_until: v.valid_until ? new Date(v.valid_until).toISOString().slice(0, 16) : '',
      is_active: v.is_active,
    });
    setEditingVoucherId(v.id);
    setVoucherDialogOpen(true);
  };

  const handleDeleteVoucher = async (id: string) => {
    const { error } = await supabase.from('vouchers' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setVouchers(prev => prev.filter(v => v.id !== id));
    toast.success(t.admin?.voucherDeleted ?? 'Voucher deleted');
  };

  const handleToggleVoucherActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from('vouchers' as any).update({ is_active: isActive }).eq('id', id);
    if (error) { toast.error(error.message); return; }
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

  // Blog CRUD helpers
  const generateSlug = (title: string) => {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const resetBlogForm = () => {
    setBlogForm({ title: '', slug: '', content: '', excerpt: '', cover_image_url: '', meta_title: '', meta_description: '', tags: '', status: 'draft', scheduled_at: '' });
    setEditingBlogId(null);
  };

  const handleBlogTitleChange = (title: string) => {
    const slug = generateSlug(title);
    setBlogForm(prev => ({ ...prev, title, slug }));
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const preset = IMAGE_PRESETS.blogCover;
      const compressed = await compressImageToWebP(file, preset.maxWidth, preset.maxHeight, preset.quality);
      const fileName = `blog-cover-${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage.from('banner-images').upload(fileName, compressed, { upsert: true, contentType: 'image/webp' });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('banner-images').getPublicUrl(fileName);
      setBlogForm(prev => ({ ...prev, cover_image_url: urlData.publicUrl }));
      toast.success(t.admin?.coverUploaded ?? 'Cover image uploaded');
    } catch (err: any) {
      toast.error(err.message || (t.admin?.coverFailed ?? 'Failed to upload cover image'));
    } finally {
      setUploadingCover(false);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    contentEditableRef.current?.focus();
  };

  const handleSaveBlog = async () => {
    if (!blogForm.title.trim() || !blogForm.slug.trim()) {
      toast.error(t.admin?.titleSlugRequired ?? 'Title and slug are required');
      return;
    }

    // Get content from contentEditable
    const htmlContent = contentEditableRef.current?.innerHTML || blogForm.content;

    setSavingBlog(true);
    const { data: { user } } = await supabase.auth.getUser();

    // Check slug uniqueness
    const slugToUse = blogForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const { data: existingSlug } = await supabase
      .from('blog_posts' as any)
      .select('id')
      .eq('slug', slugToUse)
      .neq('id', editingBlogId || '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (existingSlug) {
      toast.error(t.admin?.slugDuplicate ?? 'Slug is already used by another article. Please change it.');
      setSavingBlog(false);
      return;
    }

    // Determine published_at based on status and schedule
    let publishedAt: string | null = null;
    if (blogForm.status === 'published') {
      publishedAt = new Date().toISOString();
    } else if (blogForm.status === 'scheduled' && blogForm.scheduled_at) {
      publishedAt = new Date(blogForm.scheduled_at).toISOString();
    }

    const payload: any = {
      title: blogForm.title,
      slug: slugToUse,
      content: htmlContent,
      excerpt: blogForm.excerpt,
      cover_image_url: blogForm.cover_image_url || null,
      meta_title: blogForm.meta_title || blogForm.title,
      meta_description: blogForm.meta_description || blogForm.excerpt || htmlContent.replace(/<[^>]*>/g, '').slice(0, 155).trim(),
      tags: blogForm.tags ? blogForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      status: blogForm.status === 'scheduled' ? 'scheduled' : blogForm.status,
      published_at: publishedAt,
    };
    if (!editingBlogId) payload.author_id = user?.id;

    if (editingBlogId) {
      const { error } = await supabase.from('blog_posts' as any).update(payload).eq('id', editingBlogId);
      if (error) { toast.error(error.message); setSavingBlog(false); return; }
      setBlogPosts(prev => prev.map(p => p.id === editingBlogId ? { ...p, ...payload } : p));
      toast.success(t.admin?.articleUpdated ?? 'Article updated');
    } else {
      const { data, error } = await supabase.from('blog_posts' as any).insert(payload).select().single();
      if (error) { toast.error(error.message); setSavingBlog(false); return; }
      setBlogPosts(prev => [data, ...prev]);
      toast.success(t.admin?.articleCreated ?? 'Article created');
    }
    setSavingBlog(false);
    setBlogDialogOpen(false);
    resetBlogForm();
  };

  const handleEditBlog = (p: any) => {
    setBlogForm({
      title: p.title, slug: p.slug, content: p.content, excerpt: p.excerpt,
      cover_image_url: p.cover_image_url || '', meta_title: p.meta_title || '',
      meta_description: p.meta_description || '', tags: (p.tags || []).join(', '),
      status: p.status,
      scheduled_at: p.status === 'scheduled' && p.published_at ? new Date(p.published_at).toISOString().slice(0, 16) : '',
    });
    setEditingBlogId(p.id);
    setBlogDialogOpen(true);
    // Set content after dialog opens
    setTimeout(() => {
      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = p.content || '';
      }
    }, 100);
  };

  const handleDeleteBlog = async (id: string) => {
    const { error } = await supabase.from('blog_posts' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setBlogPosts(prev => prev.filter(p => p.id !== id));
    toast.success(t.admin?.articleDeleted ?? 'Article deleted');
  };

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
              <TabsTrigger value="campaigns" className="gap-1"><Megaphone className="w-3 h-3" />{t.admin.campaigns}</TabsTrigger>
              <TabsTrigger value="users" className="gap-1"><Users className="w-3 h-3" />{t.admin.users}</TabsTrigger>
              <TabsTrigger value="transactions" className="gap-1"><CreditCard className="w-3 h-3" />{t.admin.transactions}</TabsTrigger>
              <TabsTrigger value="vouchers" className="gap-1"><Ticket className="w-3 h-3" />Voucher</TabsTrigger>
              <TabsTrigger value="blog" className="gap-1"><BookOpen className="w-3 h-3" />Blog</TabsTrigger>
              <TabsTrigger value="settings" className="gap-1"><Settings className="w-3 h-3" />{t.admin.settings}</TabsTrigger>
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
                            {c.tier === 'premium' && <Crown className="w-3 h-3 inline mr-1" />}{c.tier || 'free'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'published' ? 'bg-green-500/20 text-green-400' : c.status === 'blocked' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'}`}>{c.status}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {c.status !== 'published' && <Button size="sm" variant="outline" className="text-xs" onClick={() => updateCampaign(c.id, { status: 'published' }, t.admin.campaignPublished ?? 'Campaign published')}>{t.admin.publish ?? 'Publish'}</Button>}
                            {c.status !== 'draft' && <Button size="sm" variant="outline" className="text-xs" onClick={() => updateCampaign(c.id, { status: 'draft' }, t.admin.campaignDrafted ?? 'Campaign moved to draft')}>{t.admin.draft ?? 'Draft'}</Button>}
                            {c.status !== 'blocked' ? (
                              <Button size="sm" variant="outline" className="border-destructive/30 text-destructive gap-1 text-xs" onClick={() => updateCampaign(c.id, { status: 'blocked' }, t.admin.campaignBlocked ?? 'Campaign blocked')}><Ban className="w-3 h-3" /> {t.admin.block}</Button>
                            ) : (
                              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => updateCampaign(c.id, { status: 'published' }, t.admin.campaignOpened ?? 'Campaign unblocked')}><Unlock className="w-3 h-3" /> {t.admin.unblock ?? 'Unblock'}</Button>
                            )}
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => updateCampaign(c.id, { tier: c.tier === 'premium' ? 'free' : 'premium' }, t.admin.tierUpdated ?? 'Campaign tier updated')}>
                              {c.tier === 'premium' ? (t.admin.setFree ?? 'Set Free') : (t.admin.setPremium ?? 'Set Premium')}
                            </Button>
                            {users.find((u: any) => u.id === c.user_id)?.is_admin && (
                              <Button size="sm" variant="outline" className={`text-xs gap-1 ${c.is_featured ? 'border-primary/50 text-primary' : ''}`} onClick={() => updateCampaign(c.id, { is_featured: !c.is_featured }, c.is_featured ? (t.admin?.removedFeatured ?? 'Removed from featured') : (t.admin?.addedFeatured ?? 'Added to homepage'))}>
                                <Star className={`w-3 h-3 ${c.is_featured ? 'fill-primary' : ''}`} />{c.is_featured ? 'Featured ✓' : (t.admin?.setFeatured ?? 'Set Featured')}
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="border-destructive/30 text-destructive gap-1 text-xs" onClick={() => deleteCampaign(c.id)}><Trash2 className="w-3 h-3" /> {t.admin.delete ?? 'Delete'}</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredCampaigns.length === 0 && <TableRow><TableCell colSpan={7} className="p-8 text-center text-muted-foreground">{t.admin.noData ?? 'Belum ada data'}</TableCell></TableRow>}
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
                            {u.is_admin ? <Shield className="w-3 h-3 inline mr-1" /> : null}{u.is_admin ? (t.admin.adminRole ?? 'admin') : (t.admin.userRole ?? 'user')}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID') : '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => toggleUserAdmin(u.id, !u.is_admin)}>{u.is_admin ? (t.admin.setUser ?? 'Set User') : (t.admin.setAdmin ?? 'Set Admin')}</Button>
                            <Button size="sm" variant="outline" className="border-destructive/30 text-destructive text-xs" onClick={() => deleteUser(u.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && <TableRow><TableCell colSpan={6} className="p-8 text-center text-muted-foreground">{t.admin.noData ?? 'Belum ada data'}</TableCell></TableRow>}
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
                          <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${tx.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}`}>{tx.status}</span></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tx.payment_method || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tx.paid_at ? new Date(tx.paid_at).toLocaleString('id-ID') : '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                    {payments.length === 0 && <TableRow><TableCell colSpan={7} className="p-8 text-center text-muted-foreground">{t.admin.noData ?? 'Belum ada data'}</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Vouchers Tab */}
            <TabsContent value="vouchers" className="space-y-3">
              <div className="flex justify-end">
                <Dialog open={voucherDialogOpen} onOpenChange={(open) => { setVoucherDialogOpen(open); if (!open) resetVoucherForm(); }}>
                  <DialogTrigger asChild>
                    <Button className="gold-glow gap-2 text-sm" onClick={() => { resetVoucherForm(); setVoucherDialogOpen(true); }}><Plus className="w-4 h-4" />Tambah Voucher</Button>
                  </DialogTrigger>
                  <DialogContent className="glass-strong border-border max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-display">{editingVoucherId ? 'Edit Voucher' : 'Buat Voucher Baru'}</DialogTitle>
                      <DialogDescription>Kelola voucher diskon untuk campaign premium.</DialogDescription>
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
                            <SelectContent><SelectItem value="percentage">Persentase (%)</SelectItem><SelectItem value="fixed">Nominal (Rp)</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Nilai Diskon</Label>
                          <Input type="number" value={voucherForm.discount_value} onChange={e => setVoucherForm(prev => ({ ...prev, discount_value: Number(e.target.value) }))} className="mt-1 bg-secondary/50 border-border" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Max Penggunaan Total (kosongkan = unlimited)</Label>
                        <Input type="number" value={voucherForm.max_uses} onChange={e => setVoucherForm(prev => ({ ...prev, max_uses: e.target.value }))} className="mt-1 bg-secondary/50 border-border" placeholder="Unlimited" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Max Penggunaan Per User (kosongkan = unlimited)</Label>
                        <Input type="number" value={voucherForm.max_uses_per_user} onChange={e => setVoucherForm(prev => ({ ...prev, max_uses_per_user: e.target.value }))} className="mt-1 bg-secondary/50 border-border" placeholder="Unlimited" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs text-muted-foreground">Valid Dari</Label><Input type="datetime-local" value={voucherForm.valid_from} onChange={e => setVoucherForm(prev => ({ ...prev, valid_from: e.target.value }))} className="mt-1 bg-secondary/50 border-border text-xs" /></div>
                        <div><Label className="text-xs text-muted-foreground">Valid Sampai</Label><Input type="datetime-local" value={voucherForm.valid_until} onChange={e => setVoucherForm(prev => ({ ...prev, valid_until: e.target.value }))} className="mt-1 bg-secondary/50 border-border text-xs" /></div>
                      </div>
                      <div className="flex items-center gap-2"><Switch checked={voucherForm.is_active} onCheckedChange={v => setVoucherForm(prev => ({ ...prev, is_active: v }))} /><Label className="text-sm">Aktif</Label></div>
                      <Button className="w-full gold-glow" onClick={handleSaveVoucher} disabled={savingVoucher}>
                        {savingVoucher ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{editingVoucherId ? 'Update Voucher' : 'Buat Voucher'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Diskon</TableHead><TableHead>Penggunaan</TableHead><TableHead>Per User</TableHead><TableHead>Berlaku</TableHead><TableHead>Status</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {vouchers.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono font-semibold text-foreground">{v.code}</TableCell>
                        <TableCell className="text-sm">{v.discount_type === 'percentage' ? `${v.discount_value}%` : `Rp ${v.discount_value.toLocaleString('id-ID')}`}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{v.used_count}{v.max_uses ? ` / ${v.max_uses}` : ' / ∞'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{v.max_uses_per_user ? `max ${v.max_uses_per_user}` : '∞'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{v.valid_from ? new Date(v.valid_from).toLocaleDateString('id-ID') : '—'}{' – '}{v.valid_until ? new Date(v.valid_until).toLocaleDateString('id-ID') : '—'}</TableCell>
                        <TableCell><Switch checked={v.is_active} onCheckedChange={(checked) => handleToggleVoucherActive(v.id, checked)} /></TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => handleEditVoucher(v)}>Edit</Button>
                            <Button size="sm" variant="outline" className="text-xs border-destructive/30 text-destructive" onClick={() => handleDeleteVoucher(v.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {vouchers.length === 0 && <TableRow><TableCell colSpan={7} className="p-8 text-center text-muted-foreground">Belum ada voucher</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Blog Tab */}
            <TabsContent value="blog" className="space-y-3">
              <div className="flex justify-end">
                <Dialog open={blogDialogOpen} onOpenChange={(open) => { setBlogDialogOpen(open); if (!open) resetBlogForm(); }}>
                  <DialogTrigger asChild>
                    <Button className="gold-glow gap-2 text-sm" onClick={() => { resetBlogForm(); setBlogDialogOpen(true); }}><Plus className="w-4 h-4" /> Artikel Baru</Button>
                  </DialogTrigger>
                  <DialogContent className="glass-strong border-border max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="font-display">{editingBlogId ? 'Edit Artikel' : 'Buat Artikel Baru'}</DialogTitle>
                      <DialogDescription>Tulis dan kelola artikel blog untuk SEO.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Judul</Label>
                        <Input value={blogForm.title} onChange={e => handleBlogTitleChange(e.target.value)} className="mt-1 bg-secondary/50 border-border" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Slug URL</Label>
                        <Input value={blogForm.slug} onChange={e => setBlogForm(prev => ({ ...prev, slug: e.target.value }))} className="mt-1 bg-secondary/50 border-border" placeholder="judul-artikel" />
                        <p className="text-xs text-muted-foreground mt-1">Auto-generated dari judul. Akan divalidasi agar unik.</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Excerpt (ringkasan singkat)</Label>
                        <Textarea value={blogForm.excerpt} onChange={e => setBlogForm(prev => ({ ...prev, excerpt: e.target.value }))} className="mt-1 bg-secondary/50 border-border" rows={2} />
                      </div>

                      {/* Rich text editor */}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-2 block">Konten</Label>
                        <div className="flex flex-wrap gap-1 mb-2 p-1 rounded-lg bg-secondary/50 border border-border">
                          <Button type="button" size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => execCommand('bold')}><strong>B</strong></Button>
                          <Button type="button" size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => execCommand('italic')}><em>I</em></Button>
                          <Button type="button" size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => execCommand('underline')}><u>U</u></Button>
                          <span className="w-px h-5 bg-border self-center mx-1" />
                          <Button type="button" size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => execCommand('formatBlock', 'h2')}>H2</Button>
                          <Button type="button" size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => execCommand('formatBlock', 'h3')}>H3</Button>
                          <Button type="button" size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => execCommand('formatBlock', 'p')}>P</Button>
                          <span className="w-px h-5 bg-border self-center mx-1" />
                          <Button type="button" size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => execCommand('insertUnorderedList')}>• List</Button>
                          <Button type="button" size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => execCommand('insertOrderedList')}>1. List</Button>
                          <Button type="button" size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => execCommand('formatBlock', 'blockquote')}>Quote</Button>
                          <span className="w-px h-5 bg-border self-center mx-1" />
                          <Button type="button" size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => {
                            const url = prompt('Masukkan URL link:');
                            if (url) execCommand('createLink', url);
                          }}>Link</Button>
                        </div>
                        <div
                          ref={contentEditableRef}
                          contentEditable
                          className="rich-text-editor mt-1 bg-secondary/50 border border-border rounded-md p-3 text-sm text-foreground overflow-y-auto max-h-[400px]"
                          onInput={() => {
                            // Content is read on save from innerHTML
                          }}
                          dangerouslySetInnerHTML={!editingBlogId ? { __html: blogForm.content } : undefined}
                        />
                      </div>

                      {/* Cover Image Upload */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Cover Image</Label>
                        <div className="mt-1 flex items-center gap-3">
                          {blogForm.cover_image_url && (
                            <img src={blogForm.cover_image_url} alt="Cover" className="w-24 h-16 object-cover rounded-lg border border-border" />
                          )}
                          <label className={`cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/50 text-xs hover:border-primary/50 transition-colors ${uploadingCover ? 'opacity-60 cursor-not-allowed' : ''}`}>
                            {uploadingCover ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                            {uploadingCover ? 'Uploading...' : 'Upload Cover'}
                            <input type="file" accept="image/*" className="hidden" onChange={handleCoverImageUpload} disabled={uploadingCover} />
                          </label>
                          {blogForm.cover_image_url && (
                            <Button type="button" size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => setBlogForm(prev => ({ ...prev, cover_image_url: '' }))}>{t.admin?.removeCover ?? 'Remove'}</Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs text-muted-foreground">Meta Title (SEO)</Label><Input value={blogForm.meta_title} onChange={e => setBlogForm(prev => ({ ...prev, meta_title: e.target.value }))} className="mt-1 bg-secondary/50 border-border" /></div>
                        <div><Label className="text-xs text-muted-foreground">Tags ({t.admin?.commaSeparated ?? 'comma separated'})</Label><Input value={blogForm.tags} onChange={e => setBlogForm(prev => ({ ...prev, tags: e.target.value }))} className="mt-1 bg-secondary/50 border-border" placeholder="tips, tutorial" /></div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Meta Description (SEO)</Label>
                        <Textarea value={blogForm.meta_description} onChange={e => setBlogForm(prev => ({ ...prev, meta_description: e.target.value }))} className="mt-1 bg-secondary/50 border-border" rows={2} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Status</Label>
                          <Select value={blogForm.status} onValueChange={v => setBlogForm(prev => ({ ...prev, status: v }))}>
                            <SelectTrigger className="mt-1 bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="published">Published</SelectItem>
                              <SelectItem value="scheduled">Scheduled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {blogForm.status === 'scheduled' && (
                          <div>
                            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Jadwal Publish</Label>
                            <Input
                              type="datetime-local"
                              value={blogForm.scheduled_at}
                              onChange={e => setBlogForm(prev => ({ ...prev, scheduled_at: e.target.value }))}
                              className="mt-1 bg-secondary/50 border-border text-xs"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Default: 00:00 jika tidak diatur</p>
                          </div>
                        )}
                      </div>
                      <Button className="w-full gold-glow" onClick={handleSaveBlog} disabled={savingBlog}>
                        {savingBlog ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {editingBlogId ? 'Update Artikel' : 'Simpan Artikel'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead>Judul</TableHead><TableHead>Slug</TableHead><TableHead>Status</TableHead><TableHead>Published</TableHead><TableHead>Tanggal</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {blogPosts.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.title}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{p.slug}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'published' ? 'bg-green-500/20 text-green-400' : p.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' : 'bg-muted text-muted-foreground'}`}>{p.status}</span>
                        </TableCell>
                        <TableCell>
                          {p.status !== 'scheduled' && (
                            <Switch
                              checked={p.status === 'published'}
                              onCheckedChange={async (checked) => {
                                const newStatus = checked ? 'published' : 'draft';
                                const publishedAt = checked ? new Date().toISOString() : null;
                                const { error } = await supabase.from('blog_posts' as any).update({ status: newStatus, published_at: publishedAt }).eq('id', p.id);
                                if (error) { toast.error(error.message); return; }
                                setBlogPosts(prev => prev.map(bp => bp.id === p.id ? { ...bp, status: newStatus, published_at: publishedAt } : bp));
                                toast.success(checked ? 'Artikel dipublish' : 'Artikel diubah ke draft');
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => handleEditBlog(p)}><Pencil className="w-3 h-3" /> Edit</Button>
                            <Button size="sm" variant="outline" className="text-xs gap-1" asChild><a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer"><Eye className="w-3 h-3" /> View</a></Button>
                            <Button size="sm" variant="outline" className="text-xs border-destructive/30 text-destructive" onClick={() => handleDeleteBlog(p.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {blogPosts.length === 0 && <TableRow><TableCell colSpan={6} className="p-8 text-center text-muted-foreground">Belum ada artikel</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass rounded-2xl p-6 border-gold-subtle space-y-4">
                  <h3 className="font-display font-semibold text-foreground">Pengaturan Harga</h3>
                  {['premium_price', 'original_price'].map(key => (
                    <div key={key}>
                      <Label className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</Label>
                      <Input value={settings[key] ?? ''} onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))} className="mt-1 bg-secondary/50 border-border" placeholder={t.admin.settingPlaceholder ?? 'Enter value'} />
                    </div>
                  ))}
                </div>
                <div className="glass rounded-2xl p-6 border-gold-subtle space-y-4">
                  <h3 className="font-display font-semibold text-foreground">Midtrans</h3>
                  {['midtrans_client_key', 'midtrans_server_key', 'midtrans_is_production'].map(key => (
                    <div key={key}>
                      <Label className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</Label>
                      <Input value={settings[key] ?? ''} onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))} className="mt-1 bg-secondary/50 border-border" placeholder={key === 'midtrans_is_production' ? 'true / false' : 'Enter value'} />
                    </div>
                  ))}
                </div>
                <div className="glass rounded-2xl p-6 border-gold-subtle space-y-4">
                  <h3 className="font-display font-semibold text-foreground">Google AdSense</h3>
                  {['adsense_client_id', 'adsense_slot_id'].map(key => (
                    <div key={key}>
                      <Label className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</Label>
                      <Input value={settings[key] ?? ''} onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))} className="mt-1 bg-secondary/50 border-border" placeholder="Enter value" />
                    </div>
                  ))}
                </div>
                <div className="glass rounded-2xl p-6 border-gold-subtle space-y-4">
                  <h3 className="font-display font-semibold text-foreground">Lainnya</h3>
                  {['site_name', 'site_description', 'contact_email', 'chat_url'].map(key => (
                    <div key={key}>
                      <Label className="text-sm text-muted-foreground capitalize">{key === 'chat_url' ? 'Chat URL (WhatsApp/Telegram)' : key.replace(/_/g, ' ')}</Label>
                      <Input value={settings[key] ?? ''} onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))} className="mt-1 bg-secondary/50 border-border" placeholder={key === 'chat_url' ? 'https://wa.me/628xxx' : 'Enter value'} />
                    </div>
                  ))}
                </div>
                <div className="glass rounded-2xl p-6 border-gold-subtle space-y-4">
                  <h3 className="font-display font-semibold text-foreground">Favicon</h3>
                  {settings['favicon_url'] && (
                    <div className="flex items-center gap-3">
                      <img src={settings['favicon_url']} alt="Current favicon" className="w-8 h-8 rounded object-contain border border-border" />
                      <span className="text-xs text-muted-foreground truncate flex-1">{settings['favicon_url']}</span>
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <div className="border border-dashed border-border rounded-lg p-3 text-center hover:border-primary/50 transition-colors">
                      <Upload className="w-5 h-5 text-primary/50 mx-auto mb-1" />
                      <span className="text-xs text-muted-foreground">Upload Favicon</span>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const preset = IMAGE_PRESETS.favicon;
                        const compressed = await compressImageToWebP(file, preset.maxWidth, preset.maxHeight, preset.quality);
                        const name = `favicon-${Date.now()}.webp`;
                        const { error } = await supabase.storage.from('banner-images').upload(name, compressed, { upsert: true, contentType: 'image/webp' });
                        if (error) throw error;
                        const { data: urlData } = supabase.storage.from('banner-images').getPublicUrl(name);
                        setSettings(prev => ({ ...prev, favicon_url: urlData.publicUrl }));
                        toast.success(t.admin?.faviconUploaded ?? 'Favicon uploaded');
                      } catch (err: any) {
                        toast.error(err.message || 'Upload failed');
                      }
                    }} />
                  </label>
                </div>
                <div className="glass rounded-2xl p-6 border-gold-subtle space-y-4">
                  <h3 className="font-display font-semibold text-foreground">Logo Site</h3>
                  {settings['logo_url'] && (
                    <div className="flex items-center gap-3">
                      <img src={settings['logo_url']} alt="Current logo" className="h-10 rounded object-contain border border-border" />
                      <span className="text-xs text-muted-foreground truncate flex-1">{settings['logo_url']}</span>
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <div className="border border-dashed border-border rounded-lg p-3 text-center hover:border-primary/50 transition-colors">
                      <Upload className="w-5 h-5 text-primary/50 mx-auto mb-1" />
                      <span className="text-xs text-muted-foreground">Upload Logo</span>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const preset = IMAGE_PRESETS.logo;
                        const compressed = await compressImageToWebP(file, preset.maxWidth, preset.maxHeight, preset.quality);
                        const name = `logo-${Date.now()}.webp`;
                        const { error } = await supabase.storage.from('banner-images').upload(name, compressed, { upsert: true, contentType: 'image/webp' });
                        if (error) throw error;
                        const { data: urlData } = supabase.storage.from('banner-images').getPublicUrl(name);
                        setSettings(prev => ({ ...prev, logo_url: urlData.publicUrl }));
                        toast.success(t.admin?.logoUploaded ?? 'Logo uploaded');
                      } catch (err: any) {
                        toast.error(err.message || 'Upload failed');
                      }
                    }} />
                  </label>
                </div>
              </div>
              <Button className="gold-glow" onClick={handleSaveSettings}>
                {t.admin.saveSettings ?? 'Save Settings'}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </Layout>
  );
};

export default Admin;
