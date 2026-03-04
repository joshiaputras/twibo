import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
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

  const fetchProfile = useCallback(async (userId: string, currentSession?: Session | null) => {
    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase.from('profiles').select('name, avatar_url').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);

    setProfileName(profile?.name ?? '');
    
    // Priority: profile avatar_url > Google avatar from user metadata
    const sess = currentSession ?? session;
    const googleAvatar = sess?.user?.user_metadata?.avatar_url || sess?.user?.user_metadata?.picture || '';
    setAvatarUrl(profile?.avatar_url || googleAvatar || '');
    
    setIsAdmin((roleRows ?? []).some((r: any) => r.role === 'admin'));
  }, [session]);

  const refreshProfile = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const user = currentSession?.user;
    if (user) await fetchProfile(user.id, currentSession);
  }, [fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id, session), 0);
      } else {
        setProfileName('');
        setAvatarUrl('');
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) fetchProfile(session.user.id, session);
    });

    return () => subscription.unsubscribe();
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
