export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url?: string;
  email_verified: boolean;
  role: 'user' | 'admin' | 'super_admin';
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string | null;
  account_frozen?: boolean;
  ai_restricted?: boolean;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  expires_at: number;
  remember_me: boolean;
}

export interface VerificationToken {
  token: string;
  email: string;
  userId: string;
  created_at: number;
  expires_at: number;
  used: boolean;
  type: 'email_verification' | 'password_reset';
}

export interface OutboundEmail {
  id: string;
  to: string;
  subject: string;
  type: 'verification' | 'password_reset';
  token: string;
  actionUrl: string;
  sent_at: number;
  expires_at: number;
  content: string;
}

export interface PasswordStrengthResult {
  score: number; // 0 to 4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
  feedback: string[];
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}
