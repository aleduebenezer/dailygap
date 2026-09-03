import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string; // SHA-256 with salt or raw fallback
  full_name: string;
  username: string;
  avatar_url?: string;
  role: 'super_admin' | 'admin' | 'user';
  email_verified: boolean;
  account_frozen: boolean;
  ai_restricted: boolean;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string;
}

export interface StoredSession {
  token: string;
  userId: string;
  email: string;
  expires_at: number;
  remember_me: boolean;
}

export interface StoredCalendar {
  id: string;
  user_id: string;
  niche: string;
  start_date: string;
  posts: any[];
  created_at: string;
  updated_at: string;
  frozen?: boolean;
}

export interface StoredToken {
  token: string;
  email: string;
  userId: string;
  created_at: number;
  expires_at: number;
  used: boolean;
  type: 'email_verification' | 'password_reset';
}

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const CALENDARS_FILE = path.join(DATA_DIR, 'calendars.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`dailygap_salt_${password}`).digest('hex');
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  // Support both SHA-256 hashed and legacy plain text
  const hashed = hashPassword(password);
  return storedHash === hashed || storedHash === password;
}

export class ServerStore {
  private users: Map<string, StoredUser> = new Map();
  private sessions: Map<string, StoredSession> = new Map();
  private calendars: StoredCalendar[] = [];
  private tokens: StoredToken[] = [];
  private rateLimits: Map<string, { count: number; lastAttempt: number; lockedUntil?: number }> = new Map();

  constructor() {
    ensureDataDir();
    this.loadFromDisk();
    this.ensureDefaultAdmin();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const raw = fs.readFileSync(USERS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((u: StoredUser) => {
            this.users.set(u.email.toLowerCase().trim(), u);
          });
        }
      }
    } catch (e) {
      console.warn('[ServerStore] Failed to read users.json:', e);
    }

    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((s: StoredSession) => {
            if (s.expires_at > Date.now()) {
              this.sessions.set(s.token, s);
            }
          });
        }
      }
    } catch (e) {
      console.warn('[ServerStore] Failed to read sessions.json:', e);
    }

    try {
      if (fs.existsSync(CALENDARS_FILE)) {
        const raw = fs.readFileSync(CALENDARS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.calendars = parsed;
        }
      }
    } catch (e) {
      console.warn('[ServerStore] Failed to read calendars.json:', e);
    }

    try {
      if (fs.existsSync(TOKENS_FILE)) {
        const raw = fs.readFileSync(TOKENS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.tokens = parsed;
        }
      }
    } catch (e) {
      console.warn('[ServerStore] Failed to read tokens.json:', e);
    }
  }

  private saveUsers() {
    try {
      ensureDataDir();
      const list = Array.from(this.users.values());
      fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('[ServerStore] Error saving users:', e);
    }
  }

  private saveSessions() {
    try {
      ensureDataDir();
      const list = Array.from(this.sessions.values()).filter((s) => s.expires_at > Date.now());
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('[ServerStore] Error saving sessions:', e);
    }
  }

  private saveCalendars() {
    try {
      ensureDataDir();
      fs.writeFileSync(CALENDARS_FILE, JSON.stringify(this.calendars, null, 2), 'utf-8');
    } catch (e) {
      console.error('[ServerStore] Error saving calendars:', e);
    }
  }

  private saveTokens() {
    try {
      ensureDataDir();
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(this.tokens, null, 2), 'utf-8');
    } catch (e) {
      console.error('[ServerStore] Error saving tokens:', e);
    }
  }

  private ensureDefaultAdmin() {
    const adminEmail = 'ebenezeraledu@gmail.com';
    this.clearRateLimit(adminEmail);
    const existing = this.users.get(adminEmail);
    if (!existing) {
      const admin: StoredUser = {
        id: 'user_dailygap_local',
        email: adminEmail,
        passwordHash: hashPassword('Password123!'),
        full_name: 'Ebenezer Aledu',
        username: 'Ebenezer',
        avatar_url: '',
        role: 'super_admin',
        email_verified: true,
        account_frozen: false,
        ai_restricted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.users.set(adminEmail, admin);
      this.saveUsers();
    } else {
      existing.role = 'super_admin';
      existing.email_verified = true;
      existing.account_frozen = false;
      this.users.set(adminEmail, existing);
    }
  }

  // User methods
  getUserByEmail(email: string): StoredUser | undefined {
    const clean = email.toLowerCase().trim();
    return this.users.get(clean);
  }

  getUserById(id: string): StoredUser | undefined {
    for (const u of this.users.values()) {
      if (u.id === id) return u;
    }
    return undefined;
  }

  getAllUsers(): StoredUser[] {
    return Array.from(this.users.values());
  }

  createUser(params: {
    email: string;
    password: string;
    fullName: string;
  }): StoredUser {
    const cleanEmail = params.email.toLowerCase().trim();
    if (this.users.has(cleanEmail)) {
      throw new Error('This email is already registered. Please sign in instead.');
    }

    const isSuperAdmin = cleanEmail === 'ebenezeraledu@gmail.com';
    const id = isSuperAdmin
      ? 'user_dailygap_local'
      : `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const username = params.fullName.trim().split(' ')[0] || (isSuperAdmin ? 'Ebenezer' : 'User');

    const newUser: StoredUser = {
      id,
      email: cleanEmail,
      passwordHash: hashPassword(params.password),
      full_name: params.fullName.trim(),
      username,
      avatar_url: '',
      role: isSuperAdmin ? 'super_admin' : 'user',
      email_verified: true, // auto-verified on signup
      account_frozen: false,
      ai_restricted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.users.set(cleanEmail, newUser);
    this.saveUsers();
    return newUser;
  }

  updateUser(id: string, updates: Partial<StoredUser>): StoredUser {
    const user = this.getUserById(id);
    if (!user) throw new Error('User not found');

    if (updates.email && updates.email !== user.email) {
      this.users.delete(user.email.toLowerCase().trim());
      user.email = updates.email.toLowerCase().trim();
    }
    if (updates.full_name) user.full_name = updates.full_name;
    if (updates.username) user.username = updates.username;
    if (updates.avatar_url !== undefined) user.avatar_url = updates.avatar_url;
    if (updates.role) user.role = updates.role;
    if (updates.email_verified !== undefined) user.email_verified = updates.email_verified;
    if (updates.account_frozen !== undefined) user.account_frozen = updates.account_frozen;
    if (updates.ai_restricted !== undefined) user.ai_restricted = updates.ai_restricted;
    if (updates.last_sign_in_at) user.last_sign_in_at = updates.last_sign_in_at;
    user.updated_at = new Date().toISOString();

    this.users.set(user.email.toLowerCase().trim(), user);
    this.saveUsers();
    return user;
  }

  updatePassword(email: string, newPassword: string): void {
    const user = this.getUserByEmail(email);
    if (!user) throw new Error('User not found');
    user.passwordHash = hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    this.users.set(user.email.toLowerCase().trim(), user);
    this.saveUsers();
  }

  // Session methods
  createSession(user: StoredUser, rememberMe = true): StoredSession {
    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
    const session: StoredSession = {
      token,
      userId: user.id,
      email: user.email,
      expires_at,
      remember_me: rememberMe,
    };
    this.sessions.set(token, session);
    this.saveSessions();
    return session;
  }

  getSession(token: string): StoredSession | undefined {
    if (!token) return undefined;
    const session = this.sessions.get(token);
    if (!session) return undefined;
    if (Date.now() > session.expires_at) {
      this.sessions.delete(token);
      this.saveSessions();
      return undefined;
    }
    return session;
  }

  deleteSession(token: string): void {
    this.sessions.delete(token);
    this.saveSessions();
  }

  // Rate limit
  checkRateLimit(email: string): { isLocked: boolean; remainingSeconds: number } {
    const key = email.toLowerCase().trim();
    if (key === 'ebenezeraledu@gmail.com') {
      return { isLocked: false, remainingSeconds: 0 };
    }
    const record = this.rateLimits.get(key);
    if (!record) return { isLocked: false, remainingSeconds: 0 };
    const now = Date.now();
    if (record.lockedUntil && record.lockedUntil > now) {
      return { isLocked: true, remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
    }
    return { isLocked: false, remainingSeconds: 0 };
  }

  recordFailedLogin(email: string): { isLocked: boolean; remainingSeconds: number } {
    const key = email.toLowerCase().trim();
    if (key === 'ebenezeraledu@gmail.com') {
      return { isLocked: false, remainingSeconds: 0 };
    }
    const now = Date.now();
    const record = this.rateLimits.get(key) || { count: 0, lastAttempt: now };
    record.count += 1;
    record.lastAttempt = now;
    if (record.count >= 5) {
      record.lockedUntil = now + 60 * 1000;
      this.rateLimits.set(key, record);
      return { isLocked: true, remainingSeconds: 60 };
    }
    this.rateLimits.set(key, record);
    return { isLocked: false, remainingSeconds: 0 };
  }

  clearRateLimit(email: string): void {
    this.rateLimits.delete(email.toLowerCase().trim());
  }

  // Tokens (verification & password reset)
  createToken(email: string, type: 'email_verification' | 'password_reset'): StoredToken {
    const token = crypto.randomBytes(16).toString('hex');
    const cleanEmail = email.toLowerCase().trim();
    const user = this.getUserByEmail(cleanEmail);
    const ttl = type === 'email_verification' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const record: StoredToken = {
      token,
      email: cleanEmail,
      userId: user?.id || '',
      created_at: Date.now(),
      expires_at: Date.now() + ttl,
      used: false,
      type,
    };
    this.tokens = this.tokens.filter(
      (t) => !(t.email === cleanEmail && t.type === type && !t.used)
    );
    this.tokens.push(record);
    this.saveTokens();
    return record;
  }

  verifyToken(tokenOrCode: string, type: 'email_verification' | 'password_reset'): StoredToken {
    const clean = tokenOrCode.trim();
    const found = this.tokens.find(
      (t) =>
        t.type === type &&
        !t.used &&
        (t.token === clean || t.token.substring(0, 6).toUpperCase() === clean.toUpperCase())
    );
    if (!found) throw new Error('Invalid or missing verification code.');
    if (Date.now() > found.expires_at) throw new Error('Verification code has expired.');
    found.used = true;
    this.saveTokens();
    return found;
  }

  // Calendars
  getUserCalendars(userId: string): StoredCalendar[] {
    return this.calendars
      .filter((c) => c.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  saveCalendar(userId: string, data: { niche: string; start_date: string; posts: any[] }): StoredCalendar {
    const cal: StoredCalendar = {
      id: `cal_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      user_id: userId,
      niche: data.niche,
      start_date: data.start_date,
      posts: data.posts || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      frozen: false,
    };
    this.calendars.unshift(cal);
    this.saveCalendars();
    return cal;
  }

  updateCalendar(id: string, updates: Partial<StoredCalendar>): StoredCalendar {
    const index = this.calendars.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Calendar not found');
    this.calendars[index] = {
      ...this.calendars[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.saveCalendars();
    return this.calendars[index];
  }

  deleteCalendar(id: string): void {
    this.calendars = this.calendars.filter((c) => c.id !== id);
    this.saveCalendars();
  }
}

export const serverStore = new ServerStore();
