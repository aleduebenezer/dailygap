import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthUser, AuthSession, OutboundEmail } from "@/lib/authTypes";
import { authService } from "@/lib/authService";

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

  const initAuth = () => {
    try {
      const activeSession = authService.getCurrentSession();
      if (activeSession && activeSession.user) {
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
  }, []);

  const refreshUser = async () => {
    const activeSession = authService.getCurrentSession();
    if (activeSession && activeSession.user) {
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
    if (result.session && result.user) {
      setUser(result.user);
      setSession(result.session);
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
    authService.clearSession();
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
    if (result.success && result.user) {
      setUser(result.user);
      if (result.session) {
        setSession(result.session);
      }
    }
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
