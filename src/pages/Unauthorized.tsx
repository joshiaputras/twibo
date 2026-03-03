import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

const Unauthorized = () => {
  return (
    <Layout>
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4 max-w-xl text-center">
          <div className="glass-strong rounded-2xl border-gold-subtle p-8 md:p-10 space-y-4">
            <ShieldAlert className="w-10 h-10 mx-auto text-destructive" />
            <h1 className="font-display text-3xl font-bold text-foreground">Unauthorized Access</h1>
            <p className="text-muted-foreground text-sm">Halaman admin hanya untuk akun dengan role admin.</p>
            <Button asChild className="gold-glow">
              <Link to="/dashboard">Kembali ke Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Unauthorized;
