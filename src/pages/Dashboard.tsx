import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { Plus, Search, Copy, Pencil, Trash2, BarChart3, Grid3X3, List, Crown, Eye } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
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

type CampaignItem = {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'blocked';
  tier: 'free' | 'premium';
  supporters: number;
  downloads: number;
};

const Dashboard = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsDialog, setStatsDialog] = useState<CampaignItem | null>(null);

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

    const { data: statsData } = await supabase
      .from('campaign_stats' as any)
      .select('campaign_id,supporters_count,downloads_count')
      .in('campaign_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

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
    toast.success('Link berhasil disalin!');
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('campaigns' as any).delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCampaigns(prev => prev.filter(c => c.id !== id));
    toast.success('Campaign berhasil dihapus');
  };

  const handleRemoveWatermark = async (id: string) => {
    const { error } = await supabase.from('campaigns' as any).update({ tier: 'premium' }).eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCampaigns(prev => prev.map(c => (c.id === id ? { ...c, tier: 'premium' } : c)));
    toast.success(t.dashboard.watermarkRemoved ?? 'Watermark berhasil dihapus!');
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
                        {c.status}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.tier === 'premium' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {c.tier === 'premium' && <Crown className="w-3 h-3 inline mr-0.5" />}
                        {t.dashboard[c.tier as keyof typeof t.dashboard] as string}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-4 mb-3 text-sm">
                    <span className="text-muted-foreground">
                      {t.dashboard.supporters}: <strong className="text-foreground">{c.supporters}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      {t.dashboard.downloads}: <strong className="text-foreground">{c.downloads}</strong>
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

                    <Button variant="outline" size="sm" className="border-primary/30 text-primary gap-1 text-xs" onClick={() => setStatsDialog(c)}>
                      <BarChart3 className="w-3 h-3" />
                      {t.dashboard.viewStats}
                    </Button>

                    {c.tier === 'free' && (
                      <Button variant="outline" size="sm" className="border-primary/30 text-primary gap-1 text-xs" onClick={() => handleRemoveWatermark(c.id)}>
                        <Crown className="w-3 h-3" />
                        {t.dashboard.removeWatermark ?? 'Remove Watermark'}
                      </Button>
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

      <Dialog open={!!statsDialog} onOpenChange={() => setStatsDialog(null)}>
        <DialogContent className="glass-strong border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-gold-gradient">
              {t.dashboard.statsTitle ?? 'Statistik'}: {statsDialog?.name}
            </DialogTitle>
          </DialogHeader>
          {statsDialog && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="glass rounded-xl p-4 text-center border-gold-subtle">
                <p className="text-2xl font-bold text-foreground">{statsDialog.supporters}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.dashboard.supporters}</p>
              </div>
              <div className="glass rounded-xl p-4 text-center border-gold-subtle">
                <p className="text-2xl font-bold text-foreground">{statsDialog.downloads}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.dashboard.downloads}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Dashboard;
