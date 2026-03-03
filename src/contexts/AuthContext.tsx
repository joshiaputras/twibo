import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profileName: string;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  profileName: '',
  isAdmin: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);

    setProfileName(profile?.name ?? '');
    setIsAdmin((roleRows ?? []).some((r: any) => r.role === 'admin'));
  }, []);

  const refreshProfile = useCallback(async () => {
    const user = session?.user;
    if (user) await fetchProfile(user.id);
  }, [session, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 0);
      } else {
        setProfileName('');
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) fetchProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfileName('');
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, profileName, isAdmin, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
