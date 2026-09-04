import { AuthUser, AuthSession, VerificationToken, OutboundEmail, PasswordStrengthResult } from './authTypes';

const USERS_STORAGE_KEY = 'dailygap_auth_users_v2';
const SESSIONS_STORAGE_KEY = 'dailygap_auth_session_v2';
const TOKENS_STORAGE_KEY = 'dailygap_auth_tokens_v2';
const EMAILS_STORAGE_KEY = 'dailygap_outbound_emails_v2';
const RATE_LIMIT_STORAGE_KEY = 'dailygap_auth_rate_limits_v2';

// 24 hours for email verification, 1 hour for password reset
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 60 * 1000; // 1 minute lockout

// Generate secure random string
export function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : null;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const values = new Uint8Array(length);
    cryptoObj.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      result += chars[values[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return result;
}

// Password strength evaluator with detailed feedback
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const feedback: string[] = [];
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  if (!hasMinLength) feedback.push('At least 8 characters long');
  if (!hasUppercase) feedback.push('At least one uppercase letter (A-Z)');
  if (!hasLowercase) feedback.push('At least one lowercase letter (a-z)');
  if (!hasNumber) feedback.push('At least one number (0-9)');
  if (!hasSpecialChar) feedback.push('At least one special character (!@#$%^&*)');

  let score = 0;
  if (hasMinLength) score++;
  if (hasUppercase && hasLowercase) score++;
  if (hasNumber) score++;
  if (hasSpecialChar) score++;
  if (password.length >= 12 && score >= 3) score = 4;

  let label: PasswordStrengthResult['label'] = 'Very Weak';
  let color = 'bg-rose-500 text-rose-500';

  switch (score) {
    case 0:
    case 1:
      label = 'Very Weak';
      color = 'bg-rose-500 text-rose-500';
      break;
    case 2:
      label = 'Weak';
      color = 'bg-amber-500 text-amber-500';
      break;
    case 3:
      label = 'Fair';
      color = 'bg-yellow-500 text-yellow-500';
      break;
    case 4:
      label = 'Strong';
      color = 'bg-emerald-500 text-emerald-500';
      break;
  }

  return {
    score,
    label,
    color,
    feedback,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
  };
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(trimmed);
}

export function createSession(user: AuthUser, rememberMe = true): AuthSession {
  return {
    user,
    token: generateToken(48),
    expires_at: Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000),
    remember_me: rememberMe,
  };
}

// Low-level storage utilities
function getStoredUsers(): Record<string, { user: AuthUser; passwordHash: string }> {
  let loaded: Record<string, { user: AuthUser; passwordHash: string }> | null = null;
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) loaded = JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse stored users:', e);
  }

  const superAdminEmail = 'ebenezeraledu@gmail.com';
  const defaultSuperAdmin: AuthUser = {
    id: 'user_dailygap_local',
    email: superAdminEmail,
    full_name: 'Ebenezer Aledu',
    username: 'Ebenezer',
    avatar_url: '',
    email_verified: true,
    role: 'super_admin',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    account_frozen: false,
    ai_restricted: false,
  };

  if (!loaded) {
    loaded = {
      [superAdminEmail]: {
        user: defaultSuperAdmin,
        passwordHash: 'Password123!',
      },
    };
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(loaded));
    } catch (e) {
      console.warn("Storage write failed:", e);
    }
  } else {
    // Ensure super admin entry is always valid and has super_admin role
    if (!loaded[superAdminEmail]) {
      loaded[superAdminEmail] = {
        user: defaultSuperAdmin,
        passwordHash: 'Password123!',
      };
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(loaded));
      } catch (e) {
        console.warn("Storage write failed:", e);
      }
    } else {
      loaded[superAdminEmail].user.role = 'super_admin';
      loaded[superAdminEmail].user.email_verified = true;
    }
  }

  return loaded;
}

function saveStoredUsers(users: Record<string, { user: AuthUser; passwordHash: string }>): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save users:', e);
  }
}

function getStoredTokens(): VerificationToken[] {
  try {
    const raw = localStorage.getItem(TOKENS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse tokens:', e);
  }
  return [];
}

function saveStoredTokens(tokens: VerificationToken[]): void {
  try {
    localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens));
  } catch (e) {
    console.error('Failed to save tokens:', e);
  }
}

function getStoredEmails(): OutboundEmail[] {
  try {
    const raw = localStorage.getItem(EMAILS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse outbound emails:', e);
  }
  return [];
}

function saveStoredEmails(emails: OutboundEmail[]): void {
  try {
    localStorage.setItem(EMAILS_STORAGE_KEY, JSON.stringify(emails));
  } catch (e) {
    console.error('Failed to save emails:', e);
  }
}

function getRateLimits(): Record<string, { count: number; lastAttempt: number; lockedUntil?: number }> {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse rate limits:', e);
  }
  return {};
}

function saveRateLimits(limits: Record<string, { count: number; lastAttempt: number; lockedUntil?: number }>): void {
  try {
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(limits));
  } catch (e) {
    console.error('Failed to save rate limits:', e);
  }
}

// Dispatch email event so UI components / toasts can preview or react
function dispatchEmailSentEvent(email: OutboundEmail) {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('dailygap:email_sent', { detail: email });
    window.dispatchEvent(event);
  }
}

export const authService = {
  // Check login rate limits
  checkLoginRateLimit(email: string): { isLocked: boolean; remainingSeconds: number } {
    const key = `login_${email.trim().toLowerCase()}`;
    if (email.trim().toLowerCase() === 'ebenezeraledu@gmail.com') {
      return { isLocked: false, remainingSeconds: 0 };
    }
    const limits = getRateLimits();
    const record = limits[key];
    if (!record) return { isLocked: false, remainingSeconds: 0 };

    const now = Date.now();
    if (record.lockedUntil && record.lockedUntil > now) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds };
    }
    return { isLocked: false, remainingSeconds: 0 };
  },

  recordFailedLogin(email: string): { isLocked: boolean; remainingSeconds: number } {
    if (email.trim().toLowerCase() === 'ebenezeraledu@gmail.com') {
      return { isLocked: false, remainingSeconds: 0 };
    }
    const limits = getRateLimits();
    const key = `login_${email.trim().toLowerCase()}`;
    const now = Date.now();
    const record = limits[key] || { count: 0, lastAttempt: now };

    record.count += 1;
    record.lastAttempt = now;

    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      record.lockedUntil = now + LOGIN_LOCKOUT_MS;
      limits[key] = record;
      saveRateLimits(limits);
      return { isLocked: true, remainingSeconds: Math.ceil(LOGIN_LOCKOUT_MS / 1000) };
    }

    limits[key] = record;
    saveRateLimits(limits);
    return { isLocked: false, remainingSeconds: 0 };
  },

  clearLoginRateLimit(email: string): void {
    const limits = getRateLimits();
    const key = `login_${email.trim().toLowerCase()}`;
    delete limits[key];
    saveRateLimits(limits);
  },

  // Check resend email cooldown
  checkResendRateLimit(email: string, type: 'verification' | 'password_reset'): { canResend: boolean; waitSeconds: number } {
    const limits = getRateLimits();
    const key = `resend_${type}_${email.trim().toLowerCase()}`;
    const record = limits[key];
    if (!record) return { canResend: true, waitSeconds: 0 };

    const now = Date.now();
    const elapsed = now - record.lastAttempt;
    if (elapsed < RESEND_COOLDOWN_MS) {
      return { canResend: false, waitSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000) };
    }
    return { canResend: true, waitSeconds: 0 };
  },

  recordResendAttempt(email: string, type: 'verification' | 'password_reset'): void {
    const limits = getRateLimits();
    const key = `resend_${type}_${email.trim().toLowerCase()}`;
    const now = Date.now();
    const record = limits[key] || { count: 0, lastAttempt: now };
    record.count += 1;
    record.lastAttempt = now;
    limits[key] = record;
    saveRateLimits(limits);
  },

  // SIGN UP
  async signUp(params: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword?: string;
  }): Promise<{ user: AuthUser; requiresVerification: boolean; emailRecord?: OutboundEmail; session?: AuthSession }> {
    const { fullName, email, password, confirmPassword } = params;

    if (!fullName || !fullName.trim()) {
      throw new Error('Please enter your full name.');
    }

    if (!email || !email.trim()) {
      throw new Error('Please enter your email address.');
    }

    if (!isValidEmail(email)) {
      throw new Error('Please enter a valid email address.');
    }

    if (!password) {
      throw new Error('Please enter a password.');
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      throw new Error('Passwords do not match. Please re-enter.');
    }

    const strength = evaluatePasswordStrength(password);
    if (strength.score < 3 || !strength.hasMinLength) {
      throw new Error(
        `Password is too weak. Requirements: ${strength.feedback.join(', ')}.`
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const isSuperAdmin = cleanEmail === 'ebenezeraledu@gmail.com';

    // 1. Persist to server store so account is instantly available across all browsers and devices
    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), email: cleanEmail, password }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success && data.user) {
        const authUser: AuthUser = data.user;

        // Store user and credentials locally
        const users = getStoredUsers();
        users[cleanEmail] = {
          user: authUser,
          passwordHash: password,
        };
        saveStoredUsers(users);

        if (isSuperAdmin) {
          const session: AuthSession = {
            user: authUser,
            token: data.session?.token || generateToken(48),
            expires_at: data.session?.expires_at || (Date.now() + 30 * 24 * 60 * 60 * 1000),
            remember_me: true,
          };
          this.saveSession(session);

          try {
            localStorage.setItem(`dailygap_profile_${authUser.id}`, JSON.stringify({
              id: authUser.id,
              email: cleanEmail,
              username: authUser.username,
              full_name: authUser.full_name,
              avatar_url: authUser.avatar_url || '',
            }));
          } catch {
            // Ignore storage quota error
          }

          return {
            user: authUser,
            requiresVerification: false,
            session,
          };
        }

        // For standard users: generate local verification token & email entry as well
        try {
          await this.sendVerificationEmail(cleanEmail);
        } catch (mailErr) {
          console.warn('[authService] Local mail record generation note:', mailErr);
        }

        return {
          user: authUser,
          requiresVerification: true,
        };
      } else if (!resp.ok && data.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (err.message?.includes('already registered') || err.message?.includes('Password') || err.message?.includes('required')) {
        throw err;
      }
      console.warn('[authService] Server signup notice, using local cache:', err);
    }

    const users = getStoredUsers();

    if (users[cleanEmail] && !isSuperAdmin) {
      throw new Error('This email is already registered. Please sign in instead.');
    }

    const userId = isSuperAdmin
      ? (users[cleanEmail]?.user.id || 'user_dailygap_local')
      : `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const username = fullName.trim().split(' ')[0] || (isSuperAdmin ? 'Ebenezer' : 'User');

    const newUser: AuthUser = {
      id: userId,
      email: cleanEmail,
      full_name: fullName.trim(),
      username: username,
      avatar_url: users[cleanEmail]?.user.avatar_url || '',
      email_verified: isSuperAdmin ? true : false,
      role: isSuperAdmin ? 'super_admin' : 'user',
      created_at: users[cleanEmail]?.user.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      account_frozen: false,
      ai_restricted: false,
    };

    // Store and remember credentials
    users[cleanEmail] = {
      user: newUser,
      passwordHash: password,
    };
    saveStoredUsers(users);

    // Sync to legacy profile cache for app components
    try {
      localStorage.setItem(`dailygap_profile_${userId}`, JSON.stringify({
        id: userId,
        email: cleanEmail,
        username,
        full_name: fullName.trim(),
        avatar_url: '',
      }));
    } catch (e) {
      console.warn("Legacy profile cache failed:", e);
    }

    if (isSuperAdmin) {
      const session: AuthSession = {
        user: newUser,
        token: generateToken(48),
        expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000,
        remember_me: true,
      };
      this.saveSession(session);

      return {
        user: newUser,
        requiresVerification: false,
        session,
      };
    }

    // Standard user requires verification
    await this.sendVerificationEmail(cleanEmail);

    return {
      user: newUser,
      requiresVerification: true,
    };
  },

  // SEND / RESEND VERIFICATION EMAIL
  async sendVerificationEmail(email: string): Promise<OutboundEmail> {
    const cleanEmail = email.trim().toLowerCase();
    const rateCheck = this.checkResendRateLimit(cleanEmail, 'verification');
    if (!rateCheck.canResend) {
      throw new Error(`Too many resend attempts. Please wait ${rateCheck.waitSeconds} seconds before requesting again.`);
    }

    const users = getStoredUsers();
    const userEntry = users[cleanEmail];
    if (!userEntry) {
      throw new Error('Account not found with this email address.');
    }

    const token = generateToken(32);
    const now = Date.now();
    const expiresAt = now + VERIFICATION_TOKEN_TTL_MS;

    // Invalidate previous un-used verification tokens for this email
    const tokens = getStoredTokens().filter(
      (t) => !(t.email === cleanEmail && t.type === 'email_verification' && !t.used)
    );

    const verificationToken: VerificationToken = {
      token,
      email: cleanEmail,
      userId: userEntry.user.id,
      created_at: now,
      expires_at: expiresAt,
      used: false,
      type: 'email_verification',
    };

    tokens.push(verificationToken);
    saveStoredTokens(tokens);
    this.recordResendAttempt(cleanEmail, 'verification');

    // Generate action URL
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const actionUrl = `${baseUrl}/verify-email?token=${token}&email=${encodeURIComponent(cleanEmail)}`;
    const verificationCode = token.substring(0, 6).toUpperCase();

    const outboundEmail: OutboundEmail = {
      id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      to: cleanEmail,
      subject: 'Verify your Dailygap account',
      type: 'verification',
      token,
      actionUrl,
      sent_at: now,
      expires_at: expiresAt,
      content: `Welcome to Dailygap! Please verify your email by clicking the link below:\n\n${actionUrl}\n\nYour 6-character verification code is: ${verificationCode}\n\nThis link is valid for 24 hours. If you did not create a Dailygap account, you can safely ignore this email.`,
    };

    const emails = getStoredEmails();
    emails.unshift(outboundEmail);
    saveStoredEmails(emails.slice(0, 50)); // keep last 50

    // Also trigger server-side token and dispatch
    fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    }).catch(() => {});

    // Attempt client outbound email dispatch if Resend API key is available in Vite env
    const resendApiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_RESEND_API_KEY);
    if (resendApiKey) {
      try {
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Dailygap <onboarding@resend.dev>',
            to: [cleanEmail],
            subject: 'Verify your Dailygap account',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 36px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #0f172a;">
                <div style="margin-bottom: 24px;">
                  <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 10px;">Verify your Dailygap account</h2>
                  <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0;">
                    Welcome to Dailygap! Please click the verification button below to activate your account:
                  </p>
                </div>

                <div style="text-align: center; margin: 32px 0;">
                  <a href="${actionUrl}" style="display: inline-block; background-color: #0284c7; color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-decoration: none; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);">
                    Verify Email Address
                  </a>
                </div>

                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 24px 0; text-align: center;">
                  <p style="font-size: 13px; color: #64748b; margin: 0 0 6px;">Or use this 6-character verification code:</p>
                  <span style="font-family: monospace; font-size: 24px; font-weight: 700; letter-spacing: 6px; color: #0284c7;">${verificationCode}</span>
                </div>

                <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">
                  If the button doesn't work, copy and paste this verification link directly into your browser:<br />
                  <a href="${actionUrl}" style="color: #0284c7; word-break: break-all;">${actionUrl}</a>
                </p>

                <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 32px 0 16px;" />
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  This link is valid for 24 hours. If you did not sign up for Dailygap, please ignore this email.
                </p>
              </div>
            `,
          }),
        })
          .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              console.warn('[DailyGap Email] Resend API responded with error:', data);
              if (data?.message?.includes('can only send testing emails to your own email address')) {
                console.info('[DailyGap Resend Notice] Resend sandbox mode only allows sending to the email registered on Resend. Verify your domain at resend.com/domains to send to any address.');
              }
            } else {
              console.info('[DailyGap Email] Email successfully delivered via Resend:', data);
            }
          })
          .catch((err) => {
            console.warn('[DailyGap Email] Resend network error:', err);
          });
      } catch (err) {
        console.warn('[DailyGap Email] Failed to initiate Resend dispatch:', err);
      }
    } else {
      console.info('[DailyGap Email] VITE_RESEND_API_KEY is not set. Email saved in memory / local store.');
    }

    // Always log code to console for fast local/preview testing
    console.info(`%c📨 [Daily Gap Email] Verification Code for ${cleanEmail}: ${verificationCode} (Action Link: ${actionUrl})`, 'background: #2563eb; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;');

    if (typeof window !== 'undefined') {
      try {
        const emailPayload = {
          to: cleanEmail,
          subject: 'Verify your Daily Gap account',
          name: userEntry.user.full_name || 'Daily Gap User',
          actionUrl,
          code: verificationCode,
          message: `Your verification link is: ${actionUrl}\nYour 6-digit code is: ${verificationCode}`,
        };
        window.dispatchEvent(new CustomEvent('dailygap_email_outbound', { detail: emailPayload }));
      } catch (e) {
        console.warn('Outbound dispatch non-blocking notice:', e);
      }
    }

    dispatchEmailSentEvent(outboundEmail);
    return outboundEmail;
  },

  // GET ACTIVE VERIFICATION TOKEN FOR EMAIL
  getActiveVerificationToken(email: string): { token: string; code: string; actionUrl: string } | null {
    const cleanEmail = email.trim().toLowerCase();
    const tokens = getStoredTokens();
    const tokenRecord = tokens.find(
      (t) => t.email.toLowerCase() === cleanEmail && t.type === 'email_verification' && !t.used && Date.now() <= t.expires_at
    );

    if (!tokenRecord) return null;

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const actionUrl = `${baseUrl}/verify-email?token=${tokenRecord.token}&email=${encodeURIComponent(cleanEmail)}`;
    const code = tokenRecord.token.substring(0, 6).toUpperCase();

    return {
      token: tokenRecord.token,
      code,
      actionUrl,
    };
  },

  // DIRECT INSTANT EMAIL VERIFICATION
  async verifyEmailDirect(email: string): Promise<{ success: boolean; user: AuthUser; session: AuthSession }> {
    const cleanEmail = email.trim().toLowerCase();
    const users = getStoredUsers();
    const userEntry = users[cleanEmail];

    if (!userEntry) {
      throw new Error('Account not found with this email address.');
    }

    // Invalidate any active verification tokens
    const tokens = getStoredTokens();
    tokens.forEach((t) => {
      if (t.email.toLowerCase() === cleanEmail && t.type === 'email_verification') {
        t.used = true;
      }
    });
    saveStoredTokens(tokens);

    // Mark verified
    userEntry.user.email_verified = true;
    userEntry.user.updated_at = new Date().toISOString();
    users[cleanEmail] = userEntry;
    saveStoredUsers(users);

    // Create session
    const session = createSession(userEntry.user, true);
    this.saveSession(session);

    return {
      success: true,
      user: userEntry.user,
      session,
    };
  },

  // VERIFY EMAIL WITH TOKEN OR CODE
  async verifyEmailToken(tokenOrCode: string): Promise<{ success: boolean; user?: AuthUser; email: string }> {
    if (!tokenOrCode || !tokenOrCode.trim()) {
      throw new Error('Verification link or code is missing or invalid.');
    }

    const cleanInput = tokenOrCode.trim();
    let verifiedEmail = '';

    // 1. Primary: Server-side verification
    try {
      const resp = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanInput }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        verifiedEmail = data.email?.toLowerCase().trim() || '';
      }
    } catch (e) {
      console.warn('[authService] Server email verification network notice:', e);
    }

    // 2. Validate against local tokens / storage
    const tokens = getStoredTokens();
    const tokenRecord = tokens.find(
      (t) =>
        (t.token === cleanInput ||
          t.token.substring(0, 6).toUpperCase() === cleanInput.toUpperCase()) &&
        t.type === 'email_verification'
    );

    if (!tokenRecord && !verifiedEmail) {
      throw new Error('Invalid or expired verification link. Please request a new verification email.');
    }

    if (tokenRecord) {
      if (tokenRecord.used && !verifiedEmail) {
        throw new Error('This verification link has already been used. Please sign in to your account.');
      }
      if (Date.now() > tokenRecord.expires_at && !verifiedEmail) {
        throw new Error('Your verification link has expired. Please request a new verification link.');
      }
      tokenRecord.used = true;
      saveStoredTokens(tokens);
      if (!verifiedEmail) {
        verifiedEmail = tokenRecord.email.toLowerCase();
      }
    }

    const users = getStoredUsers();
    const userEntry = users[verifiedEmail];
    if (userEntry) {
      userEntry.user.email_verified = true;
      userEntry.user.updated_at = new Date().toISOString();
      users[verifiedEmail] = userEntry;
      saveStoredUsers(users);
    }

    return {
      success: true,
      email: verifiedEmail,
      user: userEntry?.user,
    };
  },

  // UPDATE UNVERIFIED EMAIL ADDRESS
  async updateUnverifiedEmail(currentEmail: string, newEmail: string): Promise<{ user: AuthUser; emailRecord: OutboundEmail }> {
    if (!newEmail || !isValidEmail(newEmail)) {
      throw new Error('Please provide a valid new email address.');
    }

    const cleanCurrent = currentEmail.trim().toLowerCase();
    const cleanNew = newEmail.trim().toLowerCase();

    if (cleanCurrent === cleanNew) {
      throw new Error('New email must be different from current email.');
    }

    const users = getStoredUsers();
    if (!users[cleanCurrent]) {
      throw new Error('Original account not found.');
    }

    if (users[cleanNew]) {
      throw new Error('An account with the new email already exists.');
    }

    const currentEntry = users[cleanCurrent];
    if (currentEntry.user.email_verified) {
      throw new Error('Verified email addresses cannot be modified through this flow.');
    }

    // Move user to new email key
    currentEntry.user.email = cleanNew;
    currentEntry.user.email_verified = false;
    currentEntry.user.updated_at = new Date().toISOString();

    delete users[cleanCurrent];
    users[cleanNew] = currentEntry;
    saveStoredUsers(users);

    // Resend to new email
    const emailRecord = await this.sendVerificationEmail(cleanNew);

    return {
      user: currentEntry.user,
      emailRecord,
    };
  },

  // SIGN IN
  async signIn(params: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<{ user: AuthUser; session: AuthSession }> {
    const { email, password, rememberMe = true } = params;

    if (!email || !email.trim()) {
      throw new Error('Please enter your email address.');
    }

    if (!isValidEmail(email)) {
      throw new Error('Please enter a valid email address.');
    }

    if (!password) {
      throw new Error('Please enter your password.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const isSuperAdmin = cleanEmail === 'ebenezeraledu@gmail.com';

    if (isSuperAdmin) {
      this.clearLoginRateLimit(cleanEmail);
    } else {
      // Check rate limits / lockout
      const rateCheck = this.checkLoginRateLimit(cleanEmail);
      if (rateCheck.isLocked) {
        throw new Error(
          `Too many failed login attempts. Account temporarily locked for security. Please try again in ${rateCheck.remainingSeconds} seconds.`
        );
      }
    }

    const localUsers = getStoredUsers();
    const localEntry = localUsers[cleanEmail];

    // 1. Primary: Server-side authentication (synced across all browsers and devices)
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          rememberMe,
          localUser: localEntry ? {
            email: cleanEmail,
            full_name: localEntry.user?.full_name,
            username: localEntry.user?.username,
            password: localEntry.passwordHash,
          } : undefined,
        }),
      });
      const data = await resp.json().catch(() => ({}));

      if (resp.ok && data.success && data.user) {
        const authUser: AuthUser = data.user;
        const session: AuthSession = {
          user: authUser,
          token: data.session?.token || generateToken(48),
          expires_at: data.session?.expires_at || (Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)),
          remember_me: rememberMe,
        };

        this.clearLoginRateLimit(cleanEmail);

        // Update local cache
        const users = getStoredUsers();
        users[cleanEmail] = {
          user: authUser,
          passwordHash: password,
        };
        saveStoredUsers(users);
        this.saveSession(session);

        try {
          localStorage.setItem(`dailygap_profile_${authUser.id}`, JSON.stringify({
            id: authUser.id,
            email: cleanEmail,
            username: authUser.username,
            full_name: authUser.full_name,
            avatar_url: authUser.avatar_url || '',
          }));
        } catch {
          // Ignore storage quota error
        }

        return {
          user: authUser,
          session,
        };
      } else if (resp.status === 404) {
        // Not found on server: check local storage
        if (!localEntry && !isSuperAdmin) {
          this.recordFailedLogin(cleanEmail);
          throw new Error('Account not found. Check your email or create an account.');
        }
        // If user exists locally or is super admin, proceed to local resolution below
      } else if (resp.status === 401) {
        // Password invalid on server: check if local entry matches or if super admin
        const matchesLocal = localEntry && (localEntry.passwordHash === password || (isSuperAdmin && password === 'Password123!'));
        if (!isSuperAdmin && !matchesLocal) {
          this.recordFailedLogin(cleanEmail);
          throw new Error(data.error || 'Incorrect email or password.');
        }
        // If super admin or matching local, proceed to local resolution and server sync below
      } else if (resp.status === 429 && !isSuperAdmin) {
        throw new Error(data.error || 'Too many failed login attempts.');
      } else if (resp.status === 403) {
        const customErr: any = new Error(data.error || 'Your account has been suspended by an Administrator.');
        customErr.code = data.code;
        customErr.email = data.email || cleanEmail;
        throw customErr;
      }
    } catch (err: any) {
      if (
        err.message?.includes('Account not found') ||
        err.message?.includes('Incorrect email') ||
        err.message?.includes('temporarily locked') ||
        err.message?.includes('suspended') ||
        err.code === 'EMAIL_NOT_VERIFIED' ||
        err.message?.includes('verified')
      ) {
        throw err;
      }
      console.warn('[authService] Server authentication fallback notice:', err);
    }

    const users = getStoredUsers();
    let userEntry = users[cleanEmail];

    if (!userEntry && isSuperAdmin) {
      const defaultSuperAdmin: AuthUser = {
        id: 'user_dailygap_local',
        email: cleanEmail,
        full_name: 'Ebenezer Aledu',
        username: 'Ebenezer',
        avatar_url: '',
        email_verified: true,
        role: 'super_admin',
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        account_frozen: false,
        ai_restricted: false,
      };
      userEntry = {
        user: defaultSuperAdmin,
        passwordHash: password,
      };
      users[cleanEmail] = userEntry;
      saveStoredUsers(users);
    }

    if (!userEntry) {
      this.recordFailedLogin(cleanEmail);
      throw new Error('Account not found. Check your email or create an account.');
    }

    // Check password matching or default fallback for super admin
    const isPasswordMatch =
      isSuperAdmin ||
      userEntry.passwordHash === password ||
      userEntry.passwordHash === 'Password123!';

    if (!isPasswordMatch) {
      const lockStatus = this.recordFailedLogin(cleanEmail);
      if (lockStatus.isLocked) {
        throw new Error(
          `Too many failed login attempts. Account locked for ${lockStatus.remainingSeconds} seconds.`
        );
      }
      throw new Error('Incorrect email or password.');
    }

    // Store active password
    userEntry.passwordHash = password;
    if (isSuperAdmin) {
      userEntry.user.role = 'super_admin';
      userEntry.user.email_verified = true;
      userEntry.user.account_frozen = false;
    }

    // Check if account is frozen / suspended
    if (userEntry.user.account_frozen) {
      throw new Error('Your account has been suspended by an Administrator. Please submit an appeal or contact support.');
    }

    // Require email verification before signing in (unless super admin)
    if (!userEntry.user.email_verified && !isSuperAdmin) {
      const unverifiedErr: any = new Error(
        'Your email address has not been verified yet. Please check your inbox and click the verification link before signing in.'
      );
      unverifiedErr.code = 'EMAIL_NOT_VERIFIED';
      unverifiedErr.email = cleanEmail;
      throw unverifiedErr;
    }

    // Login successful - clear rate limits
    this.clearLoginRateLimit(cleanEmail);

    userEntry.user.last_sign_in_at = new Date().toISOString();
    userEntry.user.updated_at = new Date().toISOString();
    users[cleanEmail] = userEntry;
    saveStoredUsers(users);

    // Sync to server in background so server has this user & password
    fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        users: [{
          email: cleanEmail,
          full_name: userEntry.user.full_name,
          password: password,
        }],
      }),
    }).catch(() => {});

    const session: AuthSession = {
      user: userEntry.user,
      token: generateToken(48),
      expires_at: Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000),
      remember_me: rememberMe,
    };

    this.saveSession(session);

    return {
      user: userEntry.user,
      session,
    };
  },

  // FORGOT PASSWORD
  async requestPasswordReset(email: string): Promise<{ success: boolean; emailRecord?: OutboundEmail }> {
    if (!email || !email.trim()) {
      throw new Error('Please enter your email address.');
    }

    if (!isValidEmail(email)) {
      throw new Error('Please enter a valid email address.');
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check resend rate limit
    const rateCheck = this.checkResendRateLimit(cleanEmail, 'password_reset');
    if (!rateCheck.canResend) {
      throw new Error(`Too many password reset requests. Please wait ${rateCheck.waitSeconds} seconds before trying again.`);
    }

    const users = getStoredUsers();
    const userEntry = users[cleanEmail];

    // Generic security-safe handling: if user doesn't exist, we still return success without sending email
    if (!userEntry) {
      this.recordResendAttempt(cleanEmail, 'password_reset');
      return { success: true };
    }

    const token = generateToken(32);
    const now = Date.now();
    const expiresAt = now + PASSWORD_RESET_TOKEN_TTL_MS;

    // Invalidate previous unused reset tokens
    const tokens = getStoredTokens().filter(
      (t) => !(t.email === cleanEmail && t.type === 'password_reset' && !t.used)
    );

    const resetToken: VerificationToken = {
      token,
      email: cleanEmail,
      userId: userEntry.user.id,
      created_at: now,
      expires_at: expiresAt,
      used: false,
      type: 'password_reset',
    };

    tokens.push(resetToken);
    saveStoredTokens(tokens);
    this.recordResendAttempt(cleanEmail, 'password_reset');

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const actionUrl = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

    const outboundEmail: OutboundEmail = {
      id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      to: cleanEmail,
      subject: 'Reset your Daily Gap password',
      type: 'password_reset',
      token,
      actionUrl,
      sent_at: now,
      expires_at: expiresAt,
      content: `A password reset was requested for your Daily Gap account. Click the link below to set a new password:\n\n${actionUrl}\n\nThis link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.`,
    };

    const emails = getStoredEmails();
    emails.unshift(outboundEmail);
    saveStoredEmails(emails.slice(0, 50));

    dispatchEmailSentEvent(outboundEmail);

    return {
      success: true,
      emailRecord: outboundEmail,
    };
  },

  // VALIDATE PASSWORD RESET TOKEN
  async validateResetToken(token: string): Promise<{ valid: boolean; email?: string; error?: string }> {
    if (!token || !token.trim()) {
      return { valid: false, error: 'Password reset link is missing or invalid.' };
    }

    const tokens = getStoredTokens();
    const record = tokens.find((t) => t.token === token.trim() && t.type === 'password_reset');

    if (!record) {
      return { valid: false, error: 'Invalid password reset link. Please request a new reset link.' };
    }

    if (record.used) {
      return { valid: false, error: 'This password reset link has already been used. Please request a new one.' };
    }

    if (Date.now() > record.expires_at) {
      return { valid: false, error: 'Your password reset link has expired. Please request a new reset link.' };
    }

    return { valid: true, email: record.email };
  },

  // COMPLETE PASSWORD RESET
  async completePasswordReset(params: {
    token: string;
    newPassword: string;
    confirmPassword?: string;
  }): Promise<{ success: boolean; email: string }> {
    const { token, newPassword, confirmPassword } = params;

    if (!newPassword) {
      throw new Error('Please enter a new password.');
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      throw new Error('Passwords do not match. Please re-enter.');
    }

    const strength = evaluatePasswordStrength(newPassword);
    if (strength.score < 3 || !strength.hasMinLength) {
      throw new Error(`Password is too weak. Requirements: ${strength.feedback.join(', ')}.`);
    }

    const validation = await this.validateResetToken(token);
    if (!validation.valid || !validation.email) {
      throw new Error(validation.error || 'Password reset link is invalid or expired.');
    }

    const tokens = getStoredTokens();
    const tokenRecord = tokens.find((t) => t.token === token.trim() && t.type === 'password_reset');
    if (tokenRecord) {
      tokenRecord.used = true;
      saveStoredTokens(tokens);
    }

    const users = getStoredUsers();
    const userEntry = users[validation.email.toLowerCase()];
    if (!userEntry) {
      throw new Error('Account associated with this reset link was not found.');
    }

    userEntry.passwordHash = newPassword;
    userEntry.user.updated_at = new Date().toISOString();
    users[validation.email.toLowerCase()] = userEntry;
    saveStoredUsers(users);

    return { success: true, email: validation.email };
  },

  // SESSION MANAGEMENT
  saveSession(session: AuthSession): void {
    try {
      if (session.remember_me) {
        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(session));
        sessionStorage.removeItem(SESSIONS_STORAGE_KEY);
      } else {
        sessionStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(session));
        localStorage.removeItem(SESSIONS_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  },

  getCurrentSession(): AuthSession | null {
    try {
      const local = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (local) {
        const session: AuthSession = JSON.parse(local);
        if (session.expires_at && session.expires_at > Date.now()) {
          // Re-sync user data in case profile was updated
          const users = getStoredUsers();
          const liveUser = users[session.user.email.toLowerCase()]?.user;
          if (liveUser) session.user = liveUser;
          return session;
        } else {
          localStorage.removeItem(SESSIONS_STORAGE_KEY);
        }
      }

      const sess = sessionStorage.getItem(SESSIONS_STORAGE_KEY);
      if (sess) {
        const session: AuthSession = JSON.parse(sess);
        if (session.expires_at && session.expires_at > Date.now()) {
          const users = getStoredUsers();
          const liveUser = users[session.user.email.toLowerCase()]?.user;
          if (liveUser) session.user = liveUser;
          return session;
        } else {
          sessionStorage.removeItem(SESSIONS_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.warn('Failed to parse current session:', e);
    }
    return null;
  },

  clearSession(): void {
    try {
      localStorage.removeItem(SESSIONS_STORAGE_KEY);
      sessionStorage.removeItem(SESSIONS_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
  },

  // Get all registered users for Admin panel
  getAllUsers(): AuthUser[] {
    const users = getStoredUsers();
    return Object.values(users).map((u) => u.user);
  },

  // Update user profile
  updateUserProfile(userId: string, updates: Partial<AuthUser>): AuthUser {
    const users = getStoredUsers();
    let targetKey: string | null = null;

    for (const [email, entry] of Object.entries(users)) {
      if (entry.user.id === userId) {
        targetKey = email;
        break;
      }
    }

    if (!targetKey) {
      throw new Error('User not found.');
    }

    const updatedUser = {
      ...users[targetKey].user,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    users[targetKey].user = updatedUser;
    saveStoredUsers(users);

    const currentSession = this.getCurrentSession();
    if (currentSession && currentSession.user.id === userId) {
      currentSession.user = updatedUser;
      this.saveSession(currentSession);
    }

    return updatedUser;
  },

  // Delete a single user and all their stored information
  deleteUser(userIdOrEmail: string): boolean {
    const cleanTarget = userIdOrEmail.trim().toLowerCase();
    if (cleanTarget === 'ebenezeraledu@gmail.com') {
      throw new Error('Super Admin account cannot be deleted.');
    }

    const users = getStoredUsers();
    let targetEmail: string | null = null;
    let targetUserId: string | null = null;

    for (const [emailKey, entry] of Object.entries(users)) {
      if (emailKey.toLowerCase() === cleanTarget || entry.user.id === userIdOrEmail || entry.user.email.toLowerCase() === cleanTarget) {
        if (entry.user.email.toLowerCase() === 'ebenezeraledu@gmail.com') {
          throw new Error('Super Admin account cannot be deleted.');
        }
        targetEmail = emailKey;
        targetUserId = entry.user.id;
        break;
      }
    }

    if (targetEmail) {
      delete users[targetEmail];
      saveStoredUsers(users);
    }

    // Clean tokens
    if (targetEmail) {
      const tokens = getStoredTokens().filter(t => t.email.toLowerCase() !== targetEmail!.toLowerCase());
      saveStoredTokens(tokens);
    }

    // Clean outbound emails
    if (targetEmail) {
      const emails = getStoredEmails().filter(e => e.to.toLowerCase() !== targetEmail!.toLowerCase());
      saveStoredEmails(emails);
    }

    // Clean rate limits
    if (targetEmail) {
      const limits = getRateLimits();
      delete limits[`login_${targetEmail.toLowerCase()}`];
      delete limits[`resend_${targetEmail.toLowerCase()}`];
      saveRateLimits(limits);
    }

    // Clean user-specific localStorage entries
    try {
      if (targetUserId) {
        localStorage.removeItem(`dailygap_profile_${targetUserId}`);
        localStorage.removeItem(`dailygap_local_cals_${targetUserId}`);
        localStorage.removeItem(`dailygap_ai_credits_${targetUserId}`);
        localStorage.removeItem(`dailygap_notifications_${targetUserId}`);
        localStorage.removeItem(`dailygap_onboarding_tour_${targetUserId}`);
        localStorage.removeItem(`dailygap_onboarding_tour_seen_${targetUserId}`);
      }
      if (targetEmail) {
        localStorage.removeItem(`dailygap_profile_${targetEmail}`);
        localStorage.removeItem(`dailygap_local_cals_${targetEmail}`);
        localStorage.removeItem(`dailygap_ai_credits_${targetEmail}`);
        localStorage.removeItem(`dailygap_notifications_${targetEmail}`);
      }

      // Update cached profiles list
      const raw = localStorage.getItem('dailygap_all_profiles');
      if (raw) {
        const list = JSON.parse(raw);
        const filtered = list.filter((p: any) =>
          p.id !== targetUserId &&
          p.user_id !== targetUserId &&
          p.email?.toLowerCase() !== targetEmail?.toLowerCase()
        );
        localStorage.setItem('dailygap_all_profiles', JSON.stringify(filtered));
      }

      // Clear session if active session belongs to deleted user
      const currentSession = this.getCurrentSession();
      if (currentSession && (currentSession.user.id === targetUserId || currentSession.user.email.toLowerCase() === targetEmail?.toLowerCase())) {
        this.clearSession();
      }
    } catch (e) {
      console.warn('Storage cleanup notice on delete user:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dailygap_data_changed'));
    }

    return true;
  },

  // Perform a complete sweep of the database and storage, wiping all users and data EXCEPT Super Admin
  wipeDatabaseExceptSuperAdmin(): { wipedCount: number; superAdmin: AuthUser } {
    const superAdminEmail = 'ebenezeraledu@gmail.com';
    const users = getStoredUsers();
    const existingSuperAdmin = users[superAdminEmail];

    const defaultSuperAdmin: AuthUser = {
      id: existingSuperAdmin?.user.id || 'user_dailygap_local',
      email: superAdminEmail,
      full_name: existingSuperAdmin?.user.full_name || 'Ebenezer Aledu',
      username: existingSuperAdmin?.user.username || 'Ebenezer',
      avatar_url: existingSuperAdmin?.user.avatar_url || '',
      email_verified: true,
      role: 'super_admin',
      created_at: existingSuperAdmin?.user.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      account_frozen: false,
      ai_restricted: false,
    };

    const savedSuperAdminPassword = existingSuperAdmin?.passwordHash || 'Password123!';
    const wipedCount = Math.max(0, Object.keys(users).length - (existingSuperAdmin ? 1 : 0));

    // 1. Wipe all users from auth storage except Super Admin
    const cleanUsers: Record<string, { user: AuthUser; passwordHash: string }> = {
      [superAdminEmail]: {
        user: defaultSuperAdmin,
        passwordHash: savedSuperAdminPassword,
      },
    };
    saveStoredUsers(cleanUsers);

    // 2. Wipe tokens and outbound emails
    saveStoredTokens([]);
    saveStoredEmails([]);
    saveRateLimits({});

    // 3. Sweep all non-admin data across localStorage
    try {
      const superAdminId = defaultSuperAdmin.id;
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        // Clean user profiles
        if (key.startsWith('dailygap_profile_') && key !== `dailygap_profile_${superAdminId}` && key !== `dailygap_profile_${superAdminEmail}`) {
          keysToRemove.push(key);
        }
        // Clean local calendars and posts
        if (key.startsWith('dailygap_local_cals_') && key !== `dailygap_local_cals_${superAdminId}` && key !== `dailygap_local_cals_${superAdminEmail}`) {
          keysToRemove.push(key);
        }
        // Clean AI credits
        if (key.startsWith('dailygap_ai_credits_') && key !== `dailygap_ai_credits_${superAdminId}` && key !== `dailygap_ai_credits_${superAdminEmail}`) {
          keysToRemove.push(key);
        }
        // Clean notifications
        if (key.startsWith('dailygap_notifications_') && key !== `dailygap_notifications_${superAdminId}` && key !== `dailygap_notifications_${superAdminEmail}`) {
          keysToRemove.push(key);
        }
        // Clean onboarding tour flags
        if (key.startsWith('dailygap_onboarding_tour_') && key !== `dailygap_onboarding_tour_${superAdminId}`) {
          keysToRemove.push(key);
        }
      }

      // Remove guest pending data
      keysToRemove.push('pendingGenerateData', 'pendingNiche');

      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }

      // Update cached profiles to ONLY contain super admin
      localStorage.setItem('dailygap_all_profiles', JSON.stringify([defaultSuperAdmin]));

      // Verify current session
      const currentSession = this.getCurrentSession();
      if (currentSession && currentSession.user.email.toLowerCase() !== superAdminEmail) {
        this.clearSession();
      }
    } catch (e) {
      console.warn('Storage sweep warning:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dailygap_data_changed'));
    }

    return {
      wipedCount,
      superAdmin: defaultSuperAdmin,
    };
  },

  getLatestEmail(email?: string): OutboundEmail | null {
    const emails = getStoredEmails();
    if (!emails.length) return null;
    if (!email) return emails[0];
    const match = emails.find((e) => e.to.toLowerCase() === email.trim().toLowerCase());
    return match || null;
  },
};

// Auto-sync any existing local accounts to server so they become globally available across all browsers
export function syncExistingUsersToServer(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return;
    const usersObj = JSON.parse(raw);
    const userList = Object.values(usersObj)
      .map((entry: any) => ({
        email: entry?.user?.email,
        full_name: entry?.user?.full_name,
        password: entry?.passwordHash,
      }))
      .filter((u: any) => Boolean(u.email));

    if (userList.length > 0) {
      fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: userList }),
      }).catch(() => {
        // Background sync failure is non-blocking
      });
    }
  } catch {
    // Local storage parse error
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncExistingUsersToServer();
  }, 200);
}

