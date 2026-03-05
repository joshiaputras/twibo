import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { Plus, Search, Copy, Pencil, Trash2, BarChart3, Grid3X3, List, Crown, Eye, Loader2, FileText, TrendingUp, Users, Download, Lock, Globe, FileX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMidtransPayment } from '@/hooks/useMidtransPayment';
import { usePricing } from '@/hooks/usePricing';
import PaymentConfirmDialog from '@/components/PaymentConfirmDialog';

type CampaignItem = {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'blocked';
  tier: 'free' | 'premium';
  supporters: number;
  downloads: number;
  paidOrderId?: string;
};

const Dashboard = () => {
  const { t } = useLanguage();
  const { pay, paying, initializing: paymentInitializing } = useMidtransPayment();
  const { premiumPrice, originalPrice, paypalEnabled, paypalClientId, paypalMode, paypalPriceUsd, paypalOriginalPriceUsd } = usePricing();
  const { user } = useAuth();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsDialog, setStatsDialog] = useState<CampaignItem | null>(null);
  const [paymentConfirmCampaign, setPaymentConfirmCampaign] = useState<CampaignItem | null>(null);

  const loadCampaigns = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error }: { data: any[] | null; error: any } = await supabase
      .from('campaigns' as any)
      .select('id,name,slug,status,tier,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const ids = (data ?? []).map(row => row.id);

    const [{ data: statsData }, { data: paymentsData }] = await Promise.all([
      supabase
        .from('campaign_stats' as any)
        .select('campaign_id,supporters_count,downloads_count')
        .in('campaign_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
      supabase
        .from('payments' as any)
        .select('campaign_id,midtrans_order_id,status')
        .eq('user_id', user.id)
        .eq('status', 'paid'),
    ]);

    const paidOrderMap = new Map<string, string>();
    ((paymentsData as any[]) ?? []).forEach((p: any) => {
      paidOrderMap.set(p.campaign_id, p.midtrans_order_id);
    });

    const statsMap = new Map<string, { supporters: number; downloads: number }>();
    (statsData ?? []).forEach((row: any) => {
      statsMap.set(row.campaign_id, {
        supporters: row.supporters_count ?? 0,
        downloads: row.downloads_count ?? 0,
      });
    });

    const mapped: CampaignItem[] = (data ?? []).map(row => {
      const stat = statsMap.get(row.id);
      return {
        id: row.id,
        name: row.name || 'Untitled Campaign',
        slug: row.slug || '-',
        status: row.status === 'published' || row.status === 'blocked' ? row.status : 'draft',
        tier: row.tier === 'premium' ? 'premium' : 'free',
        supporters: stat?.supporters ?? 0,
        downloads: stat?.downloads ?? 0,
        paidOrderId: paidOrderMap.get(row.id),
      };
    });

    setCampaigns(mapped);
    setLoading(false);
  };

  useEffect(() => {
    loadCampaigns();
  }, [user?.id]);

  const filtered = useMemo(
    () =>
      campaigns.filter(c => {
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filter === 'draft') return c.status === 'draft';
        if (filter === 'published') return c.status === 'published';
        if (filter === 'free') return c.tier === 'free';
        if (filter === 'premium') return c.tier === 'premium';
        return true;
      }),
    [campaigns, filter, search]
  );

  const handleCopyLink = async (slug: string) => {
    const url = `${window.location.origin}/c/${slug}`;
    await navigator.clipboard.writeText(url);
    toast.success(t.dashboard?.linkCopied ?? 'Link copied!');
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('campaigns' as any).delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCampaigns(prev => prev.filter(c => c.id !== id));
    toast.success(t.dashboard?.campaignDeleted ?? 'Campaign deleted');
  };

  const handleToggleStatus = async (c: CampaignItem) => {
    const newStatus = c.status === 'published' ? 'draft' : 'published';
    const { error } = await supabase.from('campaigns' as any).update({ status: newStatus }).eq('id', c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCampaigns(prev => prev.map(item => item.id === c.id ? { ...item, status: newStatus as any } : item));
    toast.success(newStatus === 'published' ? (t.dashboard?.campaignPublished ?? 'Campaign dipublish!') : (t.dashboard?.campaignDrafted ?? 'Campaign dijadikan draft'));
  };

  const handleRemoveWatermark = async (id: string, voucherCode?: string) => {
    const result = await pay(id, voucherCode);
    if (result.success) {
      setCampaigns(prev => prev.map(c => (c.id === id ? { ...c, tier: 'premium' } : c)));
    }
    setPaymentConfirmCampaign(null);
  };

  return (
    <Layout>
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <h1 className="font-display text-3xl font-bold text-gold-gradient">{t.dashboard.title}</h1>
            <Link to="/campaign/new">
              <Button className="gold-glow font-semibold gap-2">
                <Plus className="w-4 h-4" />
                {t.dashboard.createNew}
              </Button>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.dashboard.search} className="pl-10 bg-secondary/50 border-border" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['all', 'published', 'draft', 'free', 'premium'].map(f => (
                <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className={filter !== f ? 'border-border text-muted-foreground' : ''}>
                  {f === 'all' ? t.dashboard.all : (t.dashboard[f as keyof typeof t.dashboard] as string)}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              <Button variant={view === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setView('grid')} className={view !== 'grid' ? 'border-border' : ''}>
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button variant={view === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setView('list')} className={view !== 'list' ? 'border-border' : ''}>
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="glass rounded-2xl p-12 text-center border-gold-subtle text-muted-foreground">Loading campaigns...</div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center border-gold-subtle">
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">{t.dashboard.noCampaigns}</h3>
              <p className="text-muted-foreground text-sm mb-6">{t.dashboard.noCampaignsDesc}</p>
              <Link to="/campaign/new">
                <Button className="gold-glow font-semibold gap-2">
                  <Plus className="w-4 h-4" />
                  {t.dashboard.createNew}
                </Button>
              </Link>
            </div>
          ) : (
            <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {filtered.map(c => (
                <div key={c.id} className="glass rounded-2xl p-5 border-gold-subtle hover:gold-glow transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-display font-semibold text-foreground">{c.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">twibo.id/c/{c.slug}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          c.status === 'published'
                            ? 'bg-green-500/20 text-green-400'
                            : c.status === 'blocked'
                              ? 'bg-destructive/20 text-destructive'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {(t.dashboard[c.status as keyof typeof t.dashboard] as string) || c.status}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.tier === 'premium' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {c.tier === 'premium' && <Crown className="w-3 h-3 inline mr-0.5" />}
                        {t.dashboard[c.tier as keyof typeof t.dashboard] as string}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-4 mb-3 text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      {c.tier === 'free' && <Lock className="w-3 h-3 text-muted-foreground/60" />}
                      {t.dashboard.supporters}: <strong className="text-foreground">{c.tier === 'premium' ? c.supporters : '—'}</strong>
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      {c.tier === 'free' && <Lock className="w-3 h-3 text-muted-foreground/60" />}
                      {t.dashboard.downloads}: <strong className="text-foreground">{c.tier === 'premium' ? c.downloads : '—'}</strong>
                    </span>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="border-border text-muted-foreground gap-1 text-xs" onClick={() => handleCopyLink(c.slug)}>
                      <Copy className="w-3 h-3" />
                      {t.dashboard.copyLink}
                    </Button>
                    <Link to={`/campaign/${c.id}/edit`}>
                      <Button variant="outline" size="sm" className="border-border text-muted-foreground gap-1 text-xs">
                        <Pencil className="w-3 h-3" />
                        {t.dashboard.edit}
                      </Button>
                    </Link>

                    <a href={`/c/${c.slug}`} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="border-border text-muted-foreground gap-1 text-xs">
                        <Eye className="w-3 h-3" />
                        {t.dashboard.viewPublic ?? 'View'}
                      </Button>
                    </a>

                    <Button
                      variant="outline"
                      size="sm"
                      className={`gap-1 text-xs ${c.status === 'published' ? 'border-muted-foreground/30 text-muted-foreground' : 'border-green-500/30 text-green-500'}`}
                      onClick={() => handleToggleStatus(c)}
                    >
                      {c.status === 'published' ? <FileX className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                      {c.status === 'published' ? (t.dashboard?.makeDraft ?? 'Jadikan Draft') : (t.dashboard?.makePublish ?? 'Publish')}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/30 text-primary gap-1 text-xs"
                      onClick={() => setStatsDialog(c)}
                    >
                      <BarChart3 className="w-3 h-3" />
                      {t.dashboard.viewStats ?? 'Lihat Statistik'}
                    </Button>

                    {/* Hapus Watermark button for free campaigns */}
                    {c.tier === 'free' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-primary/30 text-primary gap-1 text-xs"
                        onClick={() => setPaymentConfirmCampaign(c)}
                      >
                        <Crown className="w-3 h-3" />
                        {t.dashboard.removeWatermark ?? 'Hapus Watermark'}
                      </Button>
                    )}

                    {c.paidOrderId && (
                      <a href={`/invoice/${c.paidOrderId}`} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="border-border text-muted-foreground gap-1 text-xs">
                          <FileText className="w-3 h-3" />
                          Invoice
                        </Button>
                      </a>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="border-destructive/30 text-destructive gap-1 text-xs">
                          <Trash2 className="w-3 h-3" />
                          {t.dashboard.delete}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-strong border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t.dashboard.deleteConfirm ?? 'Hapus Campaign?'}</AlertDialogTitle>
                          <AlertDialogDescription>
                            Campaign "{c.name}" {t.dashboard.deleteDesc ?? 'akan dihapus secara permanen.'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-border">{t.dashboard.cancel ?? 'Batal'}</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(c.id)}>
                            {t.dashboard.delete}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <StatsDialog campaign={statsDialog} open={!!statsDialog} onClose={() => setStatsDialog(null)} t={t} onUpgrade={(id) => { setStatsDialog(null); const c = campaigns.find(x => x.id === id); if (c) setPaymentConfirmCampaign(c); }} />

      {/* Payment Confirmation Dialog */}
      <PaymentConfirmDialog
        open={!!paymentConfirmCampaign}
        onClose={() => setPaymentConfirmCampaign(null)}
        onConfirm={(voucherCode) => {
          if (paymentConfirmCampaign) handleRemoveWatermark(paymentConfirmCampaign.id, voucherCode);
        }}
        onPayPalSuccess={() => {
          if (paymentConfirmCampaign) {
            setCampaigns(prev => prev.map(c => (c.id === paymentConfirmCampaign.id ? { ...c, tier: 'premium' } : c)));
          }
          setPaymentConfirmCampaign(null);
        }}
        basePrice={premiumPrice}
        originalPrice={originalPrice}
        campaignName={paymentConfirmCampaign?.name ?? ''}
        campaignId={paymentConfirmCampaign?.id}
        paying={paying}
        paypalEnabled={paypalEnabled}
        paypalClientId={paypalClientId}
        paypalMode={paypalMode}
        paypalPriceUsd={paypalPriceUsd}
        paypalOriginalPriceUsd={paypalOriginalPriceUsd}
      />

      {/* Full-screen loading overlay while Midtrans initialises */}
      {paymentInitializing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-foreground font-semibold">Memproses pembayaran...</p>
          </div>
        </div>
      )}
    </Layout>
  );
};

/* ─── Enhanced Stats Dialog ─── */
const StatsDialog = ({ campaign, open, onClose, t, onUpgrade }: { campaign: CampaignItem | null; open: boolean; onClose: () => void; t: any; onUpgrade: (id: string) => void }) => {
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const isFree = campaign?.tier === 'free';

  const handleUpgradeClick = () => {
    if (!campaign) return;
    onUpgrade(campaign.id);
  };

  useEffect(() => {
    if (!campaign || !open || isFree) return;
    setLoading(true);
    supabase
      .from('campaign_stats_daily' as any)
      .select('date,supporters_count,downloads_count')
      .eq('campaign_id', campaign.id)
      .order('date', { ascending: true })
      .limit(30)
      .then(({ data }) => {
        setDailyData((data as any[]) ?? []);
        setLoading(false);
      });
  }, [campaign?.id, open, isFree]);

  if (!campaign) return null;

  const dummyChartData = [
    { date: 'Jan 1', supporters: 42, downloads: 18 },
    { date: 'Jan 2', supporters: 67, downloads: 31 },
    { date: 'Jan 3', supporters: 53, downloads: 24 },
    { date: 'Jan 4', supporters: 89, downloads: 45 },
    { date: 'Jan 5', supporters: 72, downloads: 38 },
    { date: 'Jan 6', supporters: 95, downloads: 52 },
    { date: 'Jan 7', supporters: 110, downloads: 61 },
  ];

  const totalSupporters = isFree ? 847 : campaign.supporters;
  const totalDownloads = isFree ? 423 : campaign.downloads;
  const conversionRate = totalSupporters > 0 ? ((totalDownloads / totalSupporters) * 100).toFixed(1) : '0';
  const avgSupportersPerDay = isFree ? '121' : (dailyData.length > 0 ? (dailyData.reduce((s, d) => s + (d.supporters_count || 0), 0) / dailyData.length).toFixed(1) : '0');
  const peakSupporters = isFree ? 156 : (dailyData.length > 0 ? Math.max(...dailyData.map(d => d.supporters_count || 0)) : 0);
  const peakDownloads = isFree ? 78 : (dailyData.length > 0 ? Math.max(...dailyData.map(d => d.downloads_count || 0)) : 0);

  const chartData = isFree ? dummyChartData : dailyData.map(d => ({
    date: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    supporters: d.supporters_count || 0,
    downloads: d.downloads_count || 0,
  }));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="glass-strong border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-gold-gradient">
            {t.dashboard.statsTitle ?? 'Statistics'}: {campaign.name}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          {isFree && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60 backdrop-blur-md rounded-xl">
              <Lock className="w-8 h-8 text-primary mb-3" />
              <p className="text-foreground font-semibold text-lg mb-1">Statistik Terkunci</p>
              <p className="text-muted-foreground text-sm text-center mb-4 max-w-xs">
                Upgrade ke Premium untuk melihat statistik lengkap campaign kamu.
              </p>
              <Button className="gold-glow font-semibold gap-2" onClick={handleUpgradeClick}>
                <Crown className="w-4 h-4" />
                Hapus Watermark & Lihat Statistik
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[
              { label: t.dashboard.totalSupporters ?? 'Total Supporters', value: totalSupporters.toLocaleString('id-ID'), icon: Users, color: 'text-primary' },
              { label: t.dashboard.totalDownloads ?? 'Total Downloads', value: totalDownloads.toLocaleString('id-ID'), icon: Download, color: 'text-primary' },
              { label: t.dashboard.conversionRate ?? 'Conversion Rate', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-primary' },
              { label: t.dashboard.avgPerDay ?? 'Avg/Day', value: String(avgSupportersPerDay), icon: BarChart3, color: 'text-primary' },
            ].map((stat, i) => (
              <div key={i} className="glass rounded-xl p-3 border-gold-subtle text-center">
                <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">{t.dashboard.dailyTrend ?? 'Daily Trend (Last 30 Days)'}</h4>

            {(isFree || chartData.length > 0) ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18% / 0.5)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(215 20% 55%)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(215 20% 55%)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(222 47% 8%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: 'hsl(210 40% 98%)' }}
                    />
                    <Area type="monotone" dataKey="supporters" stackId="1" stroke="hsl(45 100% 50%)" fill="hsl(45 100% 50% / 0.2)" />
                    <Area type="monotone" dataKey="downloads" stackId="2" stroke="hsl(45 100% 70%)" fill="hsl(45 100% 70% / 0.1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">{t.dashboard.noStatsYet ?? 'No statistics data yet'}</p>
            )}

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="glass rounded-lg p-2 border-gold-subtle">
                <p className="text-xs text-muted-foreground">{t.dashboard.peakDay ?? 'Peak Day'} ({t.dashboard.supporters ?? 'Supporters'})</p>
                <p className="font-bold text-foreground">{peakSupporters}</p>
              </div>
              <div className="glass rounded-lg p-2 border-gold-subtle">
                <p className="text-xs text-muted-foreground">{t.dashboard.peakDay ?? 'Peak Day'} ({t.dashboard.downloads ?? 'Downloads'})</p>
                <p className="font-bold text-foreground">{peakDownloads}</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Dashboard;
