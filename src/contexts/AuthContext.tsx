import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { AccountFrozenModal } from "@/components/AccountFrozenModal";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAccountFrozen: boolean;
  isAiRestricted: boolean;
  appealData: any;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const isAccountFrozen = Boolean(user?.user_metadata?.account_frozen);
  const isAiRestricted = Boolean(user?.user_metadata?.ai_restricted);
  const appealData = user?.user_metadata?.appeal || null;

  const refreshUser = async () => {
    const { data: { user: latestUser } } = await supabase.auth.getUser();
    if (latestUser) {
      setUser(latestUser);
    }
  };

  const syncUserProfile = (u: any) => {
    if (!u || !u.id || !u.email) return;
    supabase.from('profiles').upsert({
      id: u.id,
      email: u.email,
      last_sign_in_at: u.last_sign_in_at || new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.warn("Profile sync notice:", error.message);
    });
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) syncUserProfile(session.user);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) syncUserProfile(session.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isAccountFrozen,
      isAiRestricted,
      appealData,
      signUp,
      signIn,
      signOut,
      refreshUser,
    }}>
      {children}
      <AccountFrozenModal
        open={Boolean(user && isAccountFrozen)}
        userEmail={user?.email}
        appealData={appealData}
        onSignOut={signOut}
        onAppealSubmitted={() => refreshUser()}
      />
    </AuthContext.Provider>
  );
};

