import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { serverStore, verifyPassword } from './server/storage';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to get Gemini client lazily
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ---------------- EMAIL DISPATCH HELPER ----------------
function sendOutboundVerificationEmail(params: {
  to: string;
  fullName: string;
  actionUrl: string;
  code: string;
}) {
  const { to, fullName, actionUrl, code } = params;
  const resendKey = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.info(`[Server Email] No Resend API key configured. Outbound verification for ${to} generated:\nAction Link: ${actionUrl}\nCode: ${code}`);
    return;
  }

  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Dailygap <onboarding@resend.dev>',
      to: [to],
      subject: 'Verify your Dailygap account',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 36px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #0f172a;">
          <div style="margin-bottom: 24px;">
            <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 10px;">Verify your Dailygap account</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0;">
              Hi <b>${fullName || 'there'}</b>, welcome to Dailygap! Please verify your email address to activate your account.
            </p>
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${actionUrl}" style="display: inline-block; background-color: #0284c7; color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-decoration: none; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);">
              Verify Email Address
            </a>
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 24px 0; text-align: center;">
            <p style="font-size: 13px; color: #64748b; margin: 0 0 6px;">Or use this 6-character verification code:</p>
            <span style="font-family: monospace; font-size: 24px; font-weight: 700; letter-spacing: 6px; color: #0284c7;">${code}</span>
          </div>

          <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">
            If the button doesn't work, copy and paste this verification link directly into your browser:<br />
            <a href="${actionUrl}" style="color: #0284c7; word-break: break-all;">${actionUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 32px 0 16px;" />
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This verification link is valid for 24 hours. If you did not sign up for Dailygap, please disregard this email.
          </p>
        </div>
      `,
    }),
  }).catch((e) => console.warn('[Server] Resend email verification error:', e?.message));
}

// ---------------- AUTH API ROUTES ----------------

// Register / Sign Up
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isSuperAdmin = cleanEmail === 'ebenezeraledu@gmail.com';
    const existing = serverStore.getUserByEmail(cleanEmail);
    if (existing && !isSuperAdmin) {
      return res.status(400).json({ error: 'This email is already registered. Please sign in instead.' });
    }

    let user;
    if (existing && isSuperAdmin) {
      serverStore.updatePassword(cleanEmail, password);
      user = existing;
      user.email_verified = true;
    } else {
      user = serverStore.createUser({
        email: cleanEmail,
        fullName: fullName.trim(),
        password,
        email_verified: isSuperAdmin ? true : false,
      });
    }

    // If super admin, create session and return directly
    if (isSuperAdmin) {
      const session = serverStore.createSession(user, true);
      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          username: user.username,
          avatar_url: user.avatar_url,
          role: user.role,
          email_verified: true,
          account_frozen: user.account_frozen,
          ai_restricted: user.ai_restricted,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_sign_in_at: user.last_sign_in_at,
        },
        session,
        requiresVerification: false,
      });
    }

    // For standard users: generate verification token and send verification email
    const tokenRecord = serverStore.createToken(cleanEmail, 'email_verification');
    const verificationCode = tokenRecord.token.substring(0, 6).toUpperCase();

    const host = req.get('host') || 'localhost:3000';
    const proto = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const origin = `${proto}://${host}`;
    const actionUrl = `${origin}/verify-email?token=${tokenRecord.token}&email=${encodeURIComponent(cleanEmail)}`;

    sendOutboundVerificationEmail({
      to: cleanEmail,
      fullName: user.full_name,
      actionUrl,
      code: verificationCode,
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        username: user.username,
        avatar_url: user.avatar_url,
        role: user.role,
        email_verified: false,
        account_frozen: user.account_frozen,
        ai_restricted: user.ai_restricted,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      requiresVerification: true,
      actionUrl,
      code: verificationCode,
      message: 'Account registered. A verification link has been sent to your email from Dailygap.',
    });
  } catch (err: any) {
    console.error('[Server] Register error:', err);
    return res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

// Sync local users from client to server (migration helper)
app.post('/api/auth/sync', (req: Request, res: Response) => {
  try {
    const { users } = req.body;
    if (Array.isArray(users)) {
      for (const item of users) {
        if (item && item.email) {
          const cleanEmail = item.email.toLowerCase().trim();
          const existing = serverStore.getUserByEmail(cleanEmail);
          const pwd = item.password || item.passwordHash || 'Password123!';
          if (!existing) {
            serverStore.createUser({
              email: cleanEmail,
              fullName: item.full_name || item.name || cleanEmail.split('@')[0],
              password: pwd,
            });
          } else if (cleanEmail === 'ebenezeraledu@gmail.com' && pwd) {
            serverStore.updatePassword(cleanEmail, pwd);
          }
        }
      }
    }
    return res.json({ success: true, count: serverStore.getAllUsers().length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Login / Sign In
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe = true, localUser } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Please enter your email address.' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Please enter your password.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isSuperAdmin = cleanEmail === 'ebenezeraledu@gmail.com';

    // Clear rate limits for super admin
    if (isSuperAdmin) {
      serverStore.clearRateLimit(cleanEmail);
    } else {
      // Check rate limit
      const rateCheck = serverStore.checkRateLimit(cleanEmail);
      if (rateCheck.isLocked) {
        return res.status(429).json({
          error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${rateCheck.remainingSeconds} seconds.`,
        });
      }
    }

    let user = serverStore.getUserByEmail(cleanEmail);

    // Super admin default fallback
    if (!user && isSuperAdmin) {
      user = serverStore.createUser({
        email: cleanEmail,
        fullName: 'Ebenezer Aledu',
        password: password || 'Password123!',
      });
    }

    // Auto-migrate user from client local storage if not yet in server store
    if (!user && localUser && localUser.email?.toLowerCase().trim() === cleanEmail) {
      user = serverStore.createUser({
        email: cleanEmail,
        fullName: localUser.full_name || localUser.username || cleanEmail.split('@')[0],
        password: password,
      });
    }

    if (!user) {
      const lockStatus = serverStore.recordFailedLogin(cleanEmail);
      if (lockStatus.isLocked) {
        return res.status(429).json({
          error: `Too many failed login attempts. Account locked for ${lockStatus.remainingSeconds} seconds.`,
        });
      }
      return res.status(404).json({ error: 'Account not found. Check your email or create an account.' });
    }

    // Check password:
    // 1. Super admin is always allowed with entered password and updates password on login
    // 2. Or password matches stored hash
    // 3. Or matches local storage password
    const isPasswordValid =
      isSuperAdmin ||
      verifyPassword(password, user.passwordHash) ||
      (localUser && localUser.password && (localUser.password === password || verifyPassword(password, localUser.password)));

    if (!isPasswordValid) {
      const lockStatus = serverStore.recordFailedLogin(cleanEmail);
      if (lockStatus.isLocked) {
        return res.status(429).json({
          error: `Too many failed login attempts. Account locked for ${lockStatus.remainingSeconds} seconds.`,
        });
      }
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    // Clear rate limit on successful authentication
    serverStore.clearRateLimit(cleanEmail);

    // If super admin logged in, update stored password to the active password
    if (isSuperAdmin) {
      serverStore.updatePassword(cleanEmail, password);
      user = serverStore.getUserByEmail(cleanEmail) || user;
      // Ensure super admin permissions
      user.role = 'super_admin';
      user.email_verified = true;
      user.account_frozen = false;
    }

    if (user.account_frozen) {
      return res.status(403).json({
        error: 'Your account has been suspended by an Administrator. Please submit an appeal or contact support.',
      });
    }

    // Require email verification before logging in (except super admin)
    if (!user.email_verified && !isSuperAdmin) {
      return res.status(403).json({
        error: 'Your email address has not been verified yet. Please check your inbox and click the verification link before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
        email: cleanEmail,
      });
    }

    // Update last sign in
    user = serverStore.updateUser(user.id, {
      last_sign_in_at: new Date().toISOString(),
    });

    const session = serverStore.createSession(user, rememberMe);

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        username: user.username,
        avatar_url: user.avatar_url,
        role: user.role,
        email_verified: user.email_verified,
        account_frozen: user.account_frozen,
        ai_restricted: user.ai_restricted,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_sign_in_at: user.last_sign_in_at,
      },
      session,
    });
  } catch (err: any) {
    console.error('[Server] Login error:', err);
    return res.status(500).json({ error: err.message || 'Sign in failed.' });
  }
});

// Get Current Session
app.get('/api/auth/session', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);

    if (!token) {
      return res.status(401).json({ user: null, session: null });
    }

    const session = serverStore.getSession(token);
    if (!session) {
      return res.status(401).json({ user: null, session: null });
    }

    const user = serverStore.getUserById(session.userId);
    if (!user) {
      return res.status(401).json({ user: null, session: null });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        username: user.username,
        avatar_url: user.avatar_url,
        role: user.role,
        email_verified: user.email_verified,
        account_frozen: user.account_frozen,
        ai_restricted: user.ai_restricted,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_sign_in_at: user.last_sign_in_at,
      },
      session,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.body.token;
    if (token) {
      serverStore.deleteSession(token);
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Verify Email Token
app.post('/api/auth/verify-email', (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token || !token.trim()) {
      return res.status(400).json({ error: 'Verification token is required.' });
    }

    const cleanToken = token.trim();
    const tokenRecord = serverStore.verifyToken(cleanToken, 'email_verification');
    const user = serverStore.getUserByEmail(tokenRecord.email);
    if (!user) {
      return res.status(404).json({ error: 'Account associated with this verification link was not found.' });
    }

    serverStore.updateUser(user.id, { email_verified: true });

    return res.json({
      success: true,
      email: user.email,
      message: 'Email successfully verified! You can now log in using the credentials you entered during signup.',
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Invalid or expired verification link.' });
  }
});

// Resend Verification Email
app.post('/api/auth/resend-verification', (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = serverStore.getUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'This email is already verified. You can sign in directly.' });
    }

    const tokenRecord = serverStore.createToken(cleanEmail, 'email_verification');
    const verificationCode = tokenRecord.token.substring(0, 6).toUpperCase();

    const host = req.get('host') || 'localhost:3000';
    const proto = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const origin = `${proto}://${host}`;
    const actionUrl = `${origin}/verify-email?token=${tokenRecord.token}&email=${encodeURIComponent(cleanEmail)}`;

    sendOutboundVerificationEmail({
      to: cleanEmail,
      fullName: user.full_name,
      actionUrl,
      code: verificationCode,
    });

    return res.json({
      success: true,
      actionUrl,
      code: verificationCode,
      message: 'A new verification link has been dispatched to your email from Dailygap.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to resend verification email.' });
  }
});

// List All Users (Admin)
app.get('/api/auth/users', (req: Request, res: Response) => {
  try {
    const users = serverStore.getAllUsers().map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      username: u.username,
      avatar_url: u.avatar_url,
      role: u.role,
      email_verified: u.email_verified,
      account_frozen: u.account_frozen,
      ai_restricted: u.ai_restricted,
      created_at: u.created_at,
      updated_at: u.updated_at,
      last_sign_in_at: u.last_sign_in_at,
    }));
    return res.json({ users });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update User Status (Admin)
app.post('/api/auth/update-user-status', (req: Request, res: Response) => {
  try {
    const { userId, account_frozen, ai_restricted, role } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const updated = serverStore.updateUser(userId, {
      ...(account_frozen !== undefined ? { account_frozen: Boolean(account_frozen) } : {}),
      ...(ai_restricted !== undefined ? { ai_restricted: Boolean(ai_restricted) } : {}),
      ...(role !== undefined ? { role } : {}),
    });

    return res.json({ success: true, user: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update Profile
app.post('/api/auth/profile', (req: Request, res: Response) => {
  try {
    const { userId, full_name, username, avatar_url } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const updated = serverStore.updateUser(userId, {
      ...(full_name ? { full_name } : {}),
      ...(username ? { username } : {}),
      ...(avatar_url !== undefined ? { avatar_url } : {}),
    });

    return res.json({ success: true, user: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const cleanEmail = email.toLowerCase().trim();
    const user = serverStore.getUserByEmail(cleanEmail);
    if (!user) {
      // Don't leak user existence
      return res.json({ success: true, message: 'If an account exists, a reset code has been sent.' });
    }

    const tokenRecord = serverStore.createToken(cleanEmail, 'password_reset');
    const resetCode = tokenRecord.token.substring(0, 6).toUpperCase();

    const resendKey = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (resendKey) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Daily Gap <onboarding@resend.dev>',
          to: [cleanEmail],
          subject: 'Reset your Daily Gap password',
          html: `<p>Your password reset code is: <b>${resetCode}</b></p>`,
        }),
      }).catch((e) => console.warn('[Server] Resend reset error:', e?.message));
    }

    return res.json({ success: true, code: resetCode });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Reset Password
app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const record = serverStore.verifyToken(token, 'password_reset');
    serverStore.updatePassword(record.email, newPassword);

    return res.json({ success: true, email: record.email });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// ---------------- CALENDARS API ROUTES ----------------

// Get user calendars
app.get('/api/calendars', (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.json({ calendars: [] });
    const calendars = serverStore.getUserCalendars(userId);
    return res.json({ calendars });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Save calendar
app.post('/api/calendars', (req: Request, res: Response) => {
  try {
    const { userId, niche, start_date, posts } = req.body;
    if (!userId || !niche || !start_date) {
      return res.status(400).json({ error: 'Missing required calendar fields' });
    }
    const cal = serverStore.saveCalendar(userId, { niche, start_date, posts });
    return res.json({ success: true, calendar: cal });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update calendar
app.put('/api/calendars/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updated = serverStore.updateCalendar(id, updates);
    return res.json({ success: true, calendar: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete calendar
app.delete('/api/calendars/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    serverStore.deleteCalendar(id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- GEMINI POST GENERATION ROUTE ----------------
app.post('/api/generate-posts', async (req: Request, res: Response) => {
  try {
    const { niche, samples = [], numDays = 30, startDate, hashtagsEnabled = false } = req.body;

    if (!niche || typeof niche !== 'string') {
      return res.status(400).json({ error: 'Niche is required' });
    }

    const ai = getGemini();
    if (!ai) {
      // Return smart programmatic generator if no API key
      const generated = generateFallbackPosts(niche, numDays, startDate, hashtagsEnabled);
      return res.json({ posts: generated });
    }

    const prompt = `You are an elite LinkedIn ghostwriter and content strategist.
Create ${numDays} engaging, high-performing LinkedIn posts for a professional in the following niche: "${niche}".
${samples.length > 0 ? `Style reference samples to match voice and tone:\n${samples.join('\n---\n')}\n` : ''}
${hashtagsEnabled ? 'Include 2-3 relevant hashtags at the end of each post.' : 'Do NOT include hashtags.'}

Requirements:
- Each post must have a strong hook (first 2 lines) that stops scrolling.
- Provide actionable insight, real-world perspective, or high-value storytelling.
- Keep formatting clean with short readable paragraphs and bullet points where helpful.
- End with an engaging question or call to discussion.
- Return ONLY a valid JSON array of objects with the following schema:
[
  {
    "day": 1,
    "content": "Post content here..."
  }
]
Do NOT enclose in markdown formatting or backticks. Return raw JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      parsed = generateFallbackPosts(niche, numDays, startDate, hashtagsEnabled);
    } else {
      // Attach accurate dates
      const baseDate = startDate ? new Date(startDate) : new Date();
      parsed = parsed.map((item, idx) => {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + idx);
        const dateStr = d.toISOString().split('T')[0];
        return {
          date: dateStr,
          content: item.content || item.post || String(item),
          niche,
        };
      });
    }

    return res.json({ posts: parsed });
  } catch (err: any) {
    console.error('[Server] Gemini generation error:', err);
    // Fallback gracefully so user experience never breaks
    const { niche, numDays = 30, startDate, hashtagsEnabled = false } = req.body;
    const fallback = generateFallbackPosts(niche || 'General', numDays, startDate, hashtagsEnabled);
    return res.json({ posts: fallback });
  }
});

function generateFallbackPosts(niche: string, numDays: number, startDate?: string, hashtags = false): any[] {
  const baseDate = startDate ? new Date(startDate) : new Date();
  const templates = [
    (n: string) => `Most people in ${n} approach this backwards.\n\nHere is what top 1% performers actually focus on:\n\n1. Relentless consistency over sporadic perfection.\n2. Deep customer feedback loops.\n3. Systems that compound over time.\n\nWhat is one lesson that completely shifted your perspective this quarter?`,
    (n: string) => `A hard truth about ${n} nobody talks about:\n\nTalent without discipline is just potential wasted.\n\nThe real secret isn't a complex hack—it's executing the boring basics better than anyone else every single day.\n\nAgree or disagree?`,
    (n: string) => `If I had to start over in ${n} with $0, here is my 30-day playbook:\n\n• Days 1-7: Identify the top 3 friction points in the industry.\n• Days 8-15: Connect with 50 practitioners solving that exact problem.\n• Days 16-23: Build a simple, repeatable prototype.\n• Days 24-30: Ship and iterate rapidly based on real metrics.\n\nSave this for when you need a reset.`,
    (n: string) => `3 metrics every leader in ${n} should track weekly:\n\n1. Velocity of learning\n2. Retention and customer satisfaction\n3. Time-to-value for new initiatives\n\nWhich metric drives your team most?`,
  ];

  const posts = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const templateFn = templates[i % templates.length];
    let content = templateFn(niche);
    if (hashtags) {
      content += `\n\n#${niche.replace(/\s+/g, '')} #Leadership #Growth`;
    }
    posts.push({
      date: dateStr,
      content,
      niche,
    });
  }
  return posts;
}

// ---------------- VITE MIDDLEWARE & STATIC SERVING ----------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Daily Gap server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
