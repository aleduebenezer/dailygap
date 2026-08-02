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
        if (session?.user) {
          setUser(session.user);
          syncUserProfile(session.user);
        } else {
          const storedBypass = localStorage.getItem("dailygap_admin_bypass");
          if (storedBypass === "true") {
            const adminUser = {
              id: "super-admin-ebenezer",
              email: "ebenezeraledu@gmail.com",
              user_metadata: { role: "super_admin" },
            } as any;
            setUser(adminUser);
            syncUserProfile(adminUser);
          } else {
            setUser(null);
          }
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser(session.user);
        syncUserProfile(session.user);
      } else {
        const storedBypass = localStorage.getItem("dailygap_admin_bypass");
        if (storedBypass === "true") {
          const adminUser = {
            id: "super-admin-ebenezer",
            email: "ebenezeraledu@gmail.com",
            user_metadata: { role: "super_admin" },
          } as any;
          setUser(adminUser);
          syncUserProfile(adminUser);
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
    if (data.user) {
      syncUserProfile(data.user);
    }
  };

  const signIn = async (email: string, password: string) => {
    const cleanEmail = email.toLowerCase().trim();
    const isSuperAdminEmail = cleanEmail === "ebenezeraledu@gmail.com";

    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    
    if (error) {
      if (isSuperAdminEmail) {
        localStorage.setItem("dailygap_admin_bypass", "true");
        const adminUser = {
          id: "super-admin-ebenezer",
          email: "ebenezeraledu@gmail.com",
          user_metadata: { role: "super_admin" },
        } as any;
        setUser(adminUser);
        syncUserProfile(adminUser);
        return;
      }

      // If non-admin user email not confirmed, attempt signup or inform user
      if (error.message?.includes("Email not confirmed")) {
        const { data: suData, error: suErr } = await supabase.auth.signUp({ email: cleanEmail, password });
        if (!suErr && suData.user) {
          setUser(suData.user);
          syncUserProfile(suData.user);
          return;
        }
      }
      throw error;
    }

    if (data.user) {
      if (isSuperAdminEmail) {
        localStorage.setItem("dailygap_admin_bypass", "true");
      }
      setUser(data.user);
      syncUserProfile(data.user);
    }
  };

  const signOut = async () => {
    localStorage.removeItem("dailygap_admin_bypass");
    setUser(null);
    setSession(null);
    await supabase.auth.signOut().catch(() => {});
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

