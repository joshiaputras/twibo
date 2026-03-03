import { Link, useNavigate } from 'react-router-dom';
import { Globe, Menu, X, User, LogOut, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Navbar = () => {
  const { t, lang, toggleLang } = useLanguage();
  const { user, profileName, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = profileName || user?.user_metadata?.name || user?.email?.split('@')[0] || '';

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-gold-subtle">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl font-bold text-gold-gradient">
          TWIBO.id
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t.nav.pricing}
          </Link>
          <button onClick={toggleLang} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Globe className="w-4 h-4" />
            {lang.toUpperCase()}
          </button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                  <User className="w-4 h-4" />
                  {displayName}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                  <LayoutDashboard className="w-4 h-4 mr-2" /> {t.nav.dashboard}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="w-4 h-4 mr-2" /> {t.nav.profile}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" /> {t.nav.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  {t.nav.login}
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="gold-glow font-semibold">
                  {t.nav.signup}
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden glass-strong border-t border-border/50 p-4 flex flex-col gap-3">
          <Link to="/pricing" className="text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
            {t.nav.pricing}
          </Link>
          <button onClick={toggleLang} className="flex items-center gap-1.5 text-sm text-muted-foreground text-left">
            <Globe className="w-4 h-4" /> {lang.toUpperCase()}
          </button>
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
                {t.nav.dashboard}
              </Link>
              <Link to="/profile" className="text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
                {t.nav.profile}
              </Link>
              <button onClick={() => { handleSignOut(); setMobileOpen(false); }} className="text-sm text-muted-foreground text-left">
                {t.nav.logout}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">{t.nav.login}</Button>
              </Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)}>
                <Button size="sm" className="w-full gold-glow font-semibold">{t.nav.signup}</Button>
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
