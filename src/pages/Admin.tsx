import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Megaphone, CreditCard, Settings, Crown, Ban } from 'lucide-react';

const Admin = () => {
  const { t } = useLanguage();

  return (
    <Layout>
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <h1 className="font-display text-3xl font-bold text-gold-gradient mb-8">{t.admin.title}</h1>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: t.admin.totalCampaigns, value: '156', icon: Megaphone },
              { label: t.admin.totalUsers, value: '2,340', icon: Users },
              { label: t.admin.totalRevenue, value: 'Rp 7.800.000', icon: CreditCard },
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
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border/50">
                    <th className="text-left p-4 text-muted-foreground font-medium">Campaign</th>
                    <th className="p-4 text-muted-foreground font-medium">Owner</th>
                    <th className="p-4 text-muted-foreground font-medium">Tier</th>
                    <th className="p-4 text-muted-foreground font-medium">Status</th>
                    <th className="p-4 text-muted-foreground font-medium">Actions</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { name: 'Hari Kemerdekaan', owner: 'John', tier: 'premium', status: 'published' },
                      { name: 'Earth Day', owner: 'Jane', tier: 'free', status: 'published' },
                    ].map((c, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="p-4 text-foreground">{c.name}</td>
                        <td className="p-4 text-muted-foreground">{c.owner}</td>
                        <td className="p-4"><span className={`text-xs px-2 py-0.5 rounded-full ${c.tier === 'premium' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>{c.tier === 'premium' && <Crown className="w-3 h-3 inline mr-1" />}{c.tier}</span></td>
                        <td className="p-4"><span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{c.status}</span></td>
                        <td className="p-4"><Button variant="outline" size="sm" className="border-destructive/30 text-destructive gap-1"><Ban className="w-3 h-3" />{t.admin.block}</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border/50">
                    <th className="text-left p-4 text-muted-foreground font-medium">Name</th>
                    <th className="p-4 text-muted-foreground font-medium">Email</th>
                    <th className="p-4 text-muted-foreground font-medium">Campaigns</th>
                    <th className="p-4 text-muted-foreground font-medium">Actions</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { name: 'John Doe', email: 'john@mail.com', campaigns: 3 },
                      { name: 'Jane Smith', email: 'jane@mail.com', campaigns: 1 },
                    ].map((u, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="p-4 text-foreground">{u.name}</td>
                        <td className="p-4 text-muted-foreground">{u.email}</td>
                        <td className="p-4 text-center text-foreground">{u.campaigns}</td>
                        <td className="p-4"><Button variant="outline" size="sm" className="border-destructive/30 text-destructive gap-1"><Ban className="w-3 h-3" />{t.admin.block}</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="transactions">
              <div className="glass rounded-2xl border-gold-subtle overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border/50">
                    <th className="text-left p-4 text-muted-foreground font-medium">Date</th>
                    <th className="p-4 text-muted-foreground font-medium">User</th>
                    <th className="p-4 text-muted-foreground font-medium">Campaign</th>
                    <th className="p-4 text-muted-foreground font-medium">Amount</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { date: '2025-03-01', user: 'John Doe', campaign: 'Hari Kemerdekaan', amount: 'Rp 50.000' },
                    ].map((tx, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="p-4 text-foreground">{tx.date}</td>
                        <td className="p-4 text-muted-foreground">{tx.user}</td>
                        <td className="p-4 text-muted-foreground">{tx.campaign}</td>
                        <td className="p-4 text-primary font-semibold">{tx.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="glass-strong rounded-2xl p-6 border-gold-subtle space-y-6">
                <h3 className="font-display font-semibold text-foreground">{t.admin.settings}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['Midtrans Server Key', 'Midtrans Client Key', 'AdSense ID', 'WhatsApp Chat Link', 'Telegram Chat Link', 'VPS Storage URL'].map(label => (
                    <div key={label}>
                      <label className="text-sm text-muted-foreground">{label}</label>
                      <input className="mt-1 w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-sm" placeholder={label} />
                    </div>
                  ))}
                </div>
                <Button className="gold-glow font-semibold">Save Settings</Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </Layout>
  );
};

export default Admin;