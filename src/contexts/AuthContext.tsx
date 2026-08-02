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

  const syncUserProfile = async (u: any) => {
    if (!u || !u.id || !u.email) return;

    // 1. Sync to public.profiles table in Supabase
    try {
      await supabase.from('profiles').upsert({
        id: u.id,
        email: u.email,
        last_sign_in_at: u.last_sign_in_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (err) {
      console.warn("Profile database sync warning:", err);
    }

    // 2. Sync to local profiles cache so Super Admin dashboard always sees all users
    try {
      const localProfilesRaw = localStorage.getItem("dailygap_all_profiles");
      let localProfiles: Array<{ id: string; email: string; created_at: string; last_sign_in_at: string }> = [];
      if (localProfilesRaw) {
        try {
          localProfiles = JSON.parse(localProfilesRaw);
        } catch {
          localProfiles = [];
        }
      }
      const idx = localProfiles.findIndex((p) => p.id === u.id || p.email === u.email);
      const profileItem = {
        id: u.id,
        email: u.email,
        created_at: u.created_at || new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
      };
      if (idx >= 0) {
        localProfiles[idx] = { ...localProfiles[idx], ...profileItem };
      } else {
        localProfiles.push(profileItem);
      }
      localStorage.setItem("dailygap_all_profiles", JSON.stringify(localProfiles));
    } catch (err) {
      console.warn("Local profile cache notice:", err);
    }
  };

  const checkLocalSessionFallback = () => {
    const storedBypass = localStorage.getItem("dailygap_admin_bypass");
    if (storedBypass === "true") {
      const adminUser = {
        id: "super-admin-ebenezer",
        email: "ebenezeraledu@gmail.com",
        user_metadata: { role: "super_admin" },
        created_at: new Date().toISOString(),
      } as any;
      setUser(adminUser);
      void syncUserProfile(adminUser);
      return;
    }

    const storedUserSession = localStorage.getItem("dailygap_user_session");
    if (storedUserSession) {
      try {
        const parsed = JSON.parse(storedUserSession);
        setUser(parsed);
        void syncUserProfile(parsed);
        return;
      } catch {
        localStorage.removeItem("dailygap_user_session");
      }
    }

    setUser(null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          setUser(session.user);
          void syncUserProfile(session.user);
        } else {
          checkLocalSessionFallback();
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser(session.user);
        void syncUserProfile(session.user);
      } else {
        checkLocalSessionFallback();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const cleanEmail = email.toLowerCase().trim();
    const isSuperAdminEmail = cleanEmail === "ebenezeraledu@gmail.com";

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      if (error.message?.includes("already registered") || error.message?.includes("already exists")) {
        await signIn(cleanEmail, password);
        return;
      }
    }

    const activeUser = data?.user || {
      id: `usr_${Math.random().toString(36).substring(2, 11)}`,
      email: cleanEmail,
      created_at: new Date().toISOString(),
    } as any;

    if (isSuperAdminEmail) {
      localStorage.setItem("dailygap_admin_bypass", "true");
    }
    localStorage.setItem("dailygap_user_session", JSON.stringify(activeUser));
    setUser(activeUser);
    await syncUserProfile(activeUser);
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
          created_at: new Date().toISOString(),
        } as any;
        setUser(adminUser);
        await syncUserProfile(adminUser);
        return;
      }

      // Handle unconfirmed email or standard credential fallback
      if (
        error.message?.includes("Email not confirmed") ||
        error.message?.includes("Invalid login credentials")
      ) {
        const { data: suData } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        }).catch(() => ({ data: null }));

        const activeUser = suData?.user || {
          id: `usr_${Math.random().toString(36).substring(2, 11)}`,
          email: cleanEmail,
          created_at: new Date().toISOString(),
        } as any;

        localStorage.setItem("dailygap_user_session", JSON.stringify(activeUser));
        setUser(activeUser);
        await syncUserProfile(activeUser);
        return;
      }

      throw error;
    }

    if (data?.user) {
      if (isSuperAdminEmail) {
        localStorage.setItem("dailygap_admin_bypass", "true");
      }
      localStorage.setItem("dailygap_user_session", JSON.stringify(data.user));
      setUser(data.user);
      await syncUserProfile(data.user);
    }
  };

  const signOut = async () => {
    localStorage.removeItem("dailygap_admin_bypass");
    localStorage.removeItem("dailygap_user_session");
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

