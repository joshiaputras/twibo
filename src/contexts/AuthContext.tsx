import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profileName: string;
  avatarUrl: string;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  profileName: '',
  avatarUrl: '',
  isAdmin: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const fetchingRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string, currentSession?: Session | null) => {
    // Prevent concurrent fetches that cause flickering
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const [{ data: profile }, { data: roleRows }] = await Promise.all([
        supabase.from('profiles').select('name, avatar_url').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ]);

      setProfileName(profile?.name ?? '');

      const sess = currentSession ?? session;
      const googleAvatar = sess?.user?.user_metadata?.avatar_url || sess?.user?.user_metadata?.picture || '';
      setAvatarUrl(profile?.avatar_url || googleAvatar || '');

      setIsAdmin((roleRows ?? []).some((r: any) => r.role === 'admin'));
    } catch (err) {
      // Silently fail - don't reset state on network errors to prevent flickering
      console.error('Failed to fetch profile:', err);
    } finally {
      fetchingRef.current = false;
    }
  }, [session]);

  const refreshProfile = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const user = currentSession?.user;
    if (user) await fetchProfile(user.id, currentSession);
  }, [fetchProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setLoading(false);
      if (session?.user) fetchProfile(session.user.id, session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setLoading(false);
      if (session?.user) {
        // Use requestAnimationFrame instead of setTimeout to batch with rendering
        requestAnimationFrame(() => {
          if (mounted) fetchProfile(session.user.id, session);
        });
      } else {
        setProfileName('');
        setAvatarUrl('');
        setIsAdmin(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfileName('');
    setAvatarUrl('');
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, profileName, avatarUrl, isAdmin, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
