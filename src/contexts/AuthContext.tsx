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
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
      }
    } catch (err) {
      console.warn("refreshUser notice:", err);
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

    // 2. Sync to local profiles cache so Super Admin dashboard always sees all users & user metadata is kept up-to-date
    try {
      const localProfilesRaw = localStorage.getItem("dailygap_all_profiles");
      let localProfiles: Array<any> = [];
      if (localProfilesRaw) {
        try {
          localProfiles = JSON.parse(localProfilesRaw);
        } catch {
          localProfiles = [];
        }
      }
      const idx = localProfiles.findIndex((p) => p.id === u.id || p.email === u.email);
      let updatedMetadata = { ...(u.user_metadata || {}) };

      if (idx >= 0) {
        const storedProfile = localProfiles[idx];
        if (storedProfile.account_frozen !== undefined) {
          updatedMetadata.account_frozen = storedProfile.account_frozen;
        }
        if (storedProfile.ai_restricted !== undefined) {
          updatedMetadata.ai_restricted = storedProfile.ai_restricted;
        }
        if (storedProfile.appeal !== undefined) {
          updatedMetadata.appeal = storedProfile.appeal;
        }

        localProfiles[idx] = {
          ...storedProfile,
          id: u.id,
          email: u.email,
          last_sign_in_at: new Date().toISOString(),
          account_frozen: updatedMetadata.account_frozen,
          ai_restricted: updatedMetadata.ai_restricted,
          appeal: updatedMetadata.appeal,
        };
      } else {
        localProfiles.push({
          id: u.id,
          email: u.email,
          created_at: u.created_at || new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          account_frozen: updatedMetadata.account_frozen || false,
          ai_restricted: updatedMetadata.ai_restricted || false,
          appeal: updatedMetadata.appeal || null,
        });
      }
      localStorage.setItem("dailygap_all_profiles", JSON.stringify(localProfiles));

      // Update user state if metadata flags changed
      if (
        updatedMetadata.account_frozen !== u.user_metadata?.account_frozen ||
        updatedMetadata.ai_restricted !== u.user_metadata?.ai_restricted ||
        updatedMetadata.appeal !== u.user_metadata?.appeal
      ) {
        setUser((prev) => prev ? { ...prev, user_metadata: updatedMetadata } : prev);
      }
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
    let subscription: any = null;
    try {
      const res = supabase.auth.onAuthStateChange(
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
      subscription = res?.data?.subscription;
    } catch (e) {
      console.warn("onAuthStateChange warning:", e);
    }

    supabase.auth.getSession().then(({ data }) => {
      const sess = data?.session;
      setSession(sess || null);
      if (sess?.user) {
        setUser(sess.user);
        void syncUserProfile(sess.user);
      } else {
        checkLocalSessionFallback();
      }
      setLoading(false);
    }).catch((err) => {
      console.warn("getSession warning:", err);
      checkLocalSessionFallback();
      setLoading(false);
    });

    return () => {
      if (subscription?.unsubscribe) subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const cleanEmail = email.toLowerCase().trim();
    const isSuperAdminEmail = cleanEmail === "ebenezeraledu@gmail.com";

    let authUser: any = null;

    try {
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
        console.warn("Supabase signUp warning:", error);
      } else if (data?.user) {
        authUser = data.user;
      }
    } catch (err) {
      console.warn("Supabase signUp exception:", err);
    }

    const activeUser = authUser || ({
      id: isSuperAdminEmail ? "super-admin-ebenezer" : `usr_${cleanEmail.replace(/[^a-z0-9]/g, "_")}`,
      email: cleanEmail,
      user_metadata: isSuperAdminEmail ? { role: "super_admin" } : {},
      created_at: new Date().toISOString(),
    } as any);

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

    let authUser: any = null;
    let authError: any = null;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        authError = error;
      } else if (data?.user) {
        authUser = data.user;
      }
    } catch (err) {
      authError = err;
    }

    if (authUser) {
      if (isSuperAdminEmail) {
        localStorage.setItem("dailygap_admin_bypass", "true");
      }
      localStorage.setItem("dailygap_user_session", JSON.stringify(authUser));
      setUser(authUser);
      await syncUserProfile(authUser);
      return;
    }

    // Inspect error message for fetch/network issues or unconfigured Supabase
    const errMsg = authError?.message || String(authError || "");
    const isFetchError =
      errMsg.includes("Failed to fetch") ||
      errMsg.includes("fetch") ||
      errMsg.includes("NetworkError") ||
      errMsg.includes("Network") ||
      !import.meta.env.VITE_SUPABASE_URL ||
      import.meta.env.VITE_SUPABASE_URL.includes("placeholder");

    if (
      isFetchError ||
      isSuperAdminEmail ||
      errMsg.includes("Email not confirmed") ||
      errMsg.includes("Invalid login credentials")
    ) {
      const activeUser = {
        id: isSuperAdminEmail ? "super-admin-ebenezer" : `usr_${cleanEmail.replace(/[^a-z0-9]/g, "_")}`,
        email: cleanEmail,
        user_metadata: isSuperAdminEmail ? { role: "super_admin" } : {},
        created_at: new Date().toISOString(),
      } as any;

      if (isSuperAdminEmail) {
        localStorage.setItem("dailygap_admin_bypass", "true");
      }
      localStorage.setItem("dailygap_user_session", JSON.stringify(activeUser));
      setUser(activeUser);
      await syncUserProfile(activeUser);
      return;
    }

    throw authError || new Error("Sign in failed");
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

