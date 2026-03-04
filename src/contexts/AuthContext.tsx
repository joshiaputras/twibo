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
  const sessionRef = useRef<Session | null>(null);

  // Keep sessionRef in sync
  sessionRef.current = session;

  const fetchProfile = useCallback(async (userId: string, sess?: Session | null) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const [{ data: profile }, { data: roleRows }] = await Promise.all([
        supabase.from('profiles').select('name, avatar_url').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ]);

      setProfileName(profile?.name ?? '');

      const s = sess ?? sessionRef.current;
      const googleAvatar = s?.user?.user_metadata?.avatar_url || s?.user?.user_metadata?.picture || '';
      setAvatarUrl(profile?.avatar_url || googleAvatar || '');

      setIsAdmin((roleRows ?? []).some((r: any) => r.role === 'admin'));
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      fetchingRef.current = false;
    }
  }, []); // No dependencies - uses refs instead

  const refreshProfile = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user) await fetchProfile(currentSession.user.id, currentSession);
  }, [fetchProfile]);

  useEffect(() => {
    let mounted = true;
    let initialFetchDone = false;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setLoading(false);
      initialFetchDone = true;
      if (s?.user) fetchProfile(s.user.id, s);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setLoading(false);
      // Only fetch profile on actual auth events, not duplicate initial load
      if (s?.user && initialFetchDone) {
        fetchProfile(s.user.id, s);
      } else if (!s) {
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
