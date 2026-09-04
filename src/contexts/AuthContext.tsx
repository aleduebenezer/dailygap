import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthUser, AuthSession, OutboundEmail } from "@/lib/authTypes";
import { authService } from "@/lib/authService";
import { supabase } from "@/integrations/supabase/client";

export interface LocalUserProfile {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  isAccountFrozen: boolean;
  isAiRestricted: boolean;
  appealData: any;
  signUp: (params: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword?: string;
  }) => Promise<{ user: AuthUser; requiresVerification: boolean; emailRecord?: OutboundEmail; session?: AuthSession }>;
  signIn: (params: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }) => Promise<{ user: AuthUser; session: AuthSession }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; emailRecord?: OutboundEmail }>;
  completePasswordReset: (params: {
    token: string;
    newPassword: string;
    confirmPassword?: string;
  }) => Promise<{ success: boolean; email: string }>;
  verifyEmail: (token: string) => Promise<{ success: boolean; user: AuthUser; session?: AuthSession }>;
  verifyEmailDirect: (email: string) => Promise<{ success: boolean; user: AuthUser; session: AuthSession }>;
  getActiveVerificationToken: (email: string) => { token: string; code: string; actionUrl: string } | null;
  resendVerificationEmail: (email: string) => Promise<OutboundEmail>;
  updateUnverifiedEmail: (currentEmail: string, newEmail: string) => Promise<{ user: AuthUser; emailRecord: OutboundEmail }>;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const mapSupabaseUser = (sbUser: any, token?: string, expiresAt?: number): { user: AuthUser; session: AuthSession } => {
    const isConfirmed = Boolean(
      sbUser.email_confirmed_at ||
      sbUser.confirmed_at ||
      sbUser.email?.toLowerCase() === 'ebenezeraledu@gmail.com'
    );
    const fullName = sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || '';
    const username = sbUser.user_metadata?.username || fullName.split(' ')[0] || sbUser.email?.split('@')[0] || 'User';

    const authUser: AuthUser = {
      id: sbUser.id,
      email: sbUser.email || '',
      full_name: fullName,
      username,
      avatar_url: sbUser.user_metadata?.avatar_url || '',
      email_verified: isConfirmed,
      role: sbUser.email?.toLowerCase() === 'ebenezeraledu@gmail.com' ? 'super_admin' : (sbUser.user_metadata?.role || 'user'),
      created_at: sbUser.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sign_in_at: sbUser.last_sign_in_at || new Date().toISOString(),
      account_frozen: false,
      ai_restricted: false,
    };

    const localSession: AuthSession = {
      user: authUser,
      token: token || 'sb_auth_token',
      expires_at: expiresAt ? expiresAt * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000,
      remember_me: true,
    };

    return { user: authUser, session: localSession };
  };

  const initAuth = async () => {
    try {
      // 1. Check native Supabase session
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const isConfirmed = Boolean(
          data.session.user.email_confirmed_at ||
          data.session.user.confirmed_at ||
          data.session.user.email?.toLowerCase() === 'ebenezeraledu@gmail.com'
        );

        if (isConfirmed) {
          const { user: authUser, session: localSession } = mapSupabaseUser(
            data.session.user,
            data.session.access_token,
            data.session.expires_at
          );
          setUser(authUser);
          setSession(localSession);
          authService.saveSession(localSession);
          return;
        } else {
          // Unverified user: do not allow session
          setUser(null);
          setSession(null);
          authService.clearSession();
          return;
        }
      }

      // 2. Fallback to local stored session (for super admin or offline support)
      const activeSession = authService.getCurrentSession();
      if (activeSession && activeSession.user && activeSession.user.email_verified) {
        setSession(activeSession);
        setUser(activeSession.user);
      } else {
        setSession(null);
        setUser(null);
      }
    } catch (err) {
      console.warn("Auth initialization error:", err);
      setSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();

    // Subscribe to native Supabase Auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, sbSession) => {
      if (sbSession?.user) {
        const isConfirmed = Boolean(
          sbSession.user.email_confirmed_at ||
          sbSession.user.confirmed_at ||
          sbSession.user.email?.toLowerCase() === 'ebenezeraledu@gmail.com'
        );
        if (isConfirmed) {
          const { user: authUser, session: localSession } = mapSupabaseUser(
            sbSession.user,
            sbSession.access_token,
            sbSession.expires_at
          );
          setUser(authUser);
          setSession(localSession);
          authService.saveSession(localSession);
        } else {
          setUser(null);
          setSession(null);
          authService.clearSession();
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        authService.clearSession();
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const refreshUser = async () => {
    const activeSession = authService.getCurrentSession();
    if (activeSession && activeSession.user && activeSession.user.email_verified) {
      setSession(activeSession);
      setUser(activeSession.user);
    } else {
      setSession(null);
      setUser(null);
    }
  };

  const signUp = async (params: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword?: string;
  }) => {
    const result = await authService.signUp(params);
    if (!result.requiresVerification && result.session && result.user) {
      setUser(result.user);
      setSession(result.session);
    } else {
      setUser(null);
      setSession(null);
    }
    return result;
  };

  const signIn = async (params: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }) => {
    const result = await authService.signIn(params);
    setUser(result.user);
    setSession(result.session);
    return result;
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
    setSession(null);
  };

  const requestPasswordReset = async (email: string) => {
    return authService.requestPasswordReset(email);
  };

  const completePasswordReset = async (params: {
    token: string;
    newPassword: string;
    confirmPassword?: string;
  }) => {
    return authService.completePasswordReset(params);
  };

  const verifyEmail = async (token: string) => {
    const result = await authService.verifyEmailToken(token);
    return result;
  };

  const verifyEmailDirect = async (email: string) => {
    const result = await authService.verifyEmailDirect(email);
    if (result.success && result.user) {
      setUser(result.user);
      if (result.session) {
        setSession(result.session);
      }
    }
    return result;
  };

  const getActiveVerificationToken = (email: string) => {
    return authService.getActiveVerificationToken(email);
  };

  const resendVerificationEmail = async (email: string) => {
    return authService.sendVerificationEmail(email);
  };

  const updateUnverifiedEmail = async (currentEmail: string, newEmail: string) => {
    return authService.updateUnverifiedEmail(currentEmail, newEmail);
  };

  const updateProfile = async (updates: Partial<AuthUser>) => {
    if (!user) throw new Error("No authenticated user.");
    const updated = authService.updateUserProfile(user.id, updates);
    setUser(updated);
    if (session) {
      setSession({ ...session, user: updated });
    }
    return updated;
  };

  const isAccountFrozen = Boolean(user?.account_frozen);
  const isAiRestricted = Boolean(user?.ai_restricted);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAccountFrozen,
        isAiRestricted,
        appealData: null,
        signUp,
        signIn,
        signOut,
        requestPasswordReset,
        completePasswordReset,
        verifyEmail,
        verifyEmailDirect,
        getActiveVerificationToken,
        resendVerificationEmail,
        updateUnverifiedEmail,
        refreshUser,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
