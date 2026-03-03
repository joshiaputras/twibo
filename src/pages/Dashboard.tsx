import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { Plus, Search, Copy, Pencil, Trash2, BarChart3, Grid3X3, List, Crown } from 'lucide-react';
import { useState } from 'react';

const mockCampaigns = [
  { id: '1', name: 'Hari Kemerdekaan 2025', slug: 'hk-2025', status: 'published' as const, tier: 'premium' as const, supporters: 245, downloads: 180 },
  { id: '2', name: 'Wisuda Universitas', slug: 'wisuda-ui', status: 'draft' as const, tier: 'free' as const, supporters: 0, downloads: 0 },
  { id: '3', name: 'Earth Day Campaign', slug: 'earth-day', status: 'published' as const, tier: 'free' as const, supporters: 52, downloads: 38 },
];

const Dashboard = () => {
  const { t } = useLanguage();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = mockCampaigns.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'draft') return c.status === 'draft';
    if (filter === 'published') return c.status === 'published';
    if (filter === 'free') return c.tier === 'free';
    if (filter === 'premium') return c.tier === 'premium';
    return true;
  });

  return (
    <Layout>
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <h1 className="font-display text-3xl font-bold text-gold-gradient">{t.dashboard.title}</h1>
            <Link to="/campaign/new">
              <Button className="gold-glow font-semibold gap-2"><Plus className="w-4 h-4" />{t.dashboard.createNew}</Button>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.dashboard.search} className="pl-10 bg-secondary/50 border-border" />
            </div>
            <div className="flex gap-2">
              {['all', 'published', 'draft', 'free', 'premium'].map(f => (
                <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className={filter !== f ? 'border-border text-muted-foreground' : ''}>
                  {f === 'all' ? t.dashboard.all : t.dashboard[f as keyof typeof t.dashboard] as string}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              <Button variant={view === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setView('grid')} className={view !== 'grid' ? 'border-border' : ''}><Grid3X3 className="w-4 h-4" /></Button>
              <Button variant={view === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setView('list')} className={view !== 'list' ? 'border-border' : ''}><List className="w-4 h-4" /></Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center border-gold-subtle">
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">{t.dashboard.noCampaigns}</h3>
              <p className="text-muted-foreground text-sm mb-6">{t.dashboard.noCampaignsDesc}</p>
              <Link to="/campaign/new"><Button className="gold-glow font-semibold gap-2"><Plus className="w-4 h-4" />{t.dashboard.createNew}</Button></Link>
            </div>
          ) : (
            <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {filtered.map(c => (
                <div key={c.id} className="glass rounded-2xl p-6 border-gold-subtle hover:gold-glow transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-display font-semibold text-foreground">{c.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">twibo.id/c/{c.slug}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {t.dashboard[c.status as keyof typeof t.dashboard] as string}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${c.tier === 'premium' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {c.tier === 'premium' && <Crown className="w-3 h-3" />}
                        {t.dashboard[c.tier as keyof typeof t.dashboard] as string}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-4 mb-4 text-sm">
                    <span className="text-muted-foreground">{t.dashboard.supporters}: <strong className="text-foreground">{c.supporters}</strong></span>
                    <span className="text-muted-foreground">{t.dashboard.downloads}: <strong className="text-foreground">{c.downloads}</strong></span>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="border-border text-muted-foreground gap-1"><Copy className="w-3 h-3" />{t.dashboard.copyLink}</Button>
                    <Link to={`/campaign/${c.id}/edit`}><Button variant="outline" size="sm" className="border-border text-muted-foreground gap-1"><Pencil className="w-3 h-3" />{t.dashboard.edit}</Button></Link>
                    {c.tier === 'premium' ? (
                      <Button variant="outline" size="sm" className="border-primary/30 text-primary gap-1"><BarChart3 className="w-3 h-3" />{t.dashboard.viewStats}</Button>
                    ) : (
                      <Button variant="outline" size="sm" className="border-border text-muted-foreground gap-1 opacity-50" title={t.dashboard.upgradeForStats}><BarChart3 className="w-3 h-3" /></Button>
                    )}
                    <Button variant="outline" size="sm" className="border-destructive/30 text-destructive gap-1"><Trash2 className="w-3 h-3" />{t.dashboard.delete}</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Dashboard;