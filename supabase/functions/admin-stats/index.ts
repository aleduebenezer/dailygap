import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Identify caller
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = claims.claims.sub as string;
    const admin = createClient(url, service);

    // If POST method, check for action payloads (appeal submission or status toggles)
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const action = body.action;

      if (action === 'submit_appeal') {
        // Any authenticated user can submit an appeal for their frozen account
        const appealMessage = body.message;
        if (!appealMessage || typeof appealMessage !== 'string' || !appealMessage.trim()) {
          return new Response(JSON.stringify({ error: 'Appeal message is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data: userRecord } = await admin.auth.admin.getUserById(callerId);
        const currentMeta = userRecord?.user?.user_metadata || {};
        const appealData = {
          message: appealMessage.trim(),
          submitted_at: new Date().toISOString(),
          status: 'pending',
        };
        await admin.auth.admin.updateUserById(callerId, {
          user_metadata: { ...currentMeta, appeal: appealData },
        });
        return new Response(JSON.stringify({ success: true, appeal: appealData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Remaining actions require Admin privilege
      const { data: userData } = await admin.auth.admin.getUserById(callerId);
      const callerEmail = userData?.user?.email;
      const isSuperAdminEmail = callerEmail === 'ebenezeraledu@gmail.com';
      const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', { _user_id: callerId, _role: 'admin' });
      if (!isSuperAdminEmail && (roleErr || !isAdmin)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'update_user_status') {
        const { target_user_id, ai_restricted, account_frozen } = body;
        if (!target_user_id) {
          return new Response(JSON.stringify({ error: 'target_user_id is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data: targetUser } = await admin.auth.admin.getUserById(target_user_id);
        if (!targetUser?.user) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // Protect Super Admin from self-freezing
        if (targetUser.user.email === 'ebenezeraledu@gmail.com' && account_frozen === true) {
          return new Response(JSON.stringify({ error: 'Super Admin account cannot be frozen' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const currentMeta = targetUser.user.user_metadata || {};
        const newMeta = {
          ...currentMeta,
          ...(ai_restricted !== undefined ? { ai_restricted: Boolean(ai_restricted) } : {}),
          ...(account_frozen !== undefined ? { account_frozen: Boolean(account_frozen) } : {}),
        };
        await admin.auth.admin.updateUserById(target_user_id, { user_metadata: newMeta });
        return new Response(JSON.stringify({ success: true, target_user_id, user_metadata: newMeta }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'resolve_appeal') {
        const { target_user_id, unfreeze } = body;
        const { data: targetUser } = await admin.auth.admin.getUserById(target_user_id);
        if (!targetUser?.user) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const currentMeta = targetUser.user.user_metadata || {};
        const newMeta = {
          ...currentMeta,
          ...(unfreeze ? { account_frozen: false } : {}),
          appeal: currentMeta.appeal ? { ...currentMeta.appeal, status: unfreeze ? 'approved' : 'dismissed', resolved_at: new Date().toISOString() } : null,
        };
        await admin.auth.admin.updateUserById(target_user_id, { user_metadata: newMeta });
        return new Response(JSON.stringify({ success: true, target_user_id, user_metadata: newMeta }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Verify admin for GET data
    const { data: userData } = await admin.auth.admin.getUserById(callerId);
    const callerEmail = userData?.user?.email;
    const isSuperAdminEmail = callerEmail === 'ebenezeraledu@gmail.com';
    const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', { _user_id: callerId, _role: 'admin' });
    if (!isSuperAdminEmail && (roleErr || !isAdmin)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch data including profiles, ai_usage_daily, etc.
    const [{ data: users }, { data: profilesData }, { data: calendars }, { data: postLog }, { data: linkedinConns }, { data: aiUsage }] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => ({ data: { users: [] } })),
      admin.from('profiles').select('*').catch(() => ({ data: [] })),
      admin.from('calendars').select('id, user_id, niche, posts, created_at, frozen').catch(() => ({ data: [] })),
      admin.from('linkedin_post_log').select('user_id, calendar_id, status, posted_at, error').catch(() => ({ data: [] })),
      admin.from('linkedin_connections').select('user_id, linkedin_name, created_at').catch(() => ({ data: [] })),
      admin.from('ai_usage_daily').select('user_id, usage_date, count, created_at').catch(() => ({ data: [] })),
    ]);

    const usersList = (users as any)?.users || [];
    const profs = (profilesData as any) || [];
    const cals = (calendars as any) || [];
    const logs = (postLog as any) || [];
    const conns = (linkedinConns as any) || [];
    const usage = (aiUsage as any) || [];

    // Aggregate per user
    type Row = {
      user_id: string;
      email: string;
      created_at: string;
      last_sign_in_at: string | null;
      ai_restricted: boolean;
      account_frozen: boolean;
      appeal: any;
      linkedin_connected: boolean;
      linkedin_name: string | null;
      calendars: number;
      total_posts: number;
      generated_posts: number;
      manual_posts: number;
      edited_posts: number;
      posted_success: number;
      posted_failed: number;
      success_rate: number;
      ai_credits_total: number;
      ai_usage_records: any[];
    };

    const rows = new Map<string, Row>();
    
    // 1. Add all users from Supabase Auth admin listUsers
    for (const u of usersList) {
      if (!u || !u.id) continue;
      rows.set(u.id, {
        user_id: u.id,
        email: u.email || '(no email)',
        created_at: u.created_at || new Date().toISOString(),
        last_sign_in_at: u.last_sign_in_at || null,
        ai_restricted: Boolean(u.user_metadata?.ai_restricted),
        account_frozen: Boolean(u.user_metadata?.account_frozen),
        appeal: u.user_metadata?.appeal || null,
        linkedin_connected: false,
        linkedin_name: null,
        calendars: 0,
        total_posts: 0,
        generated_posts: 0,
        manual_posts: 0,
        edited_posts: 0,
        posted_success: 0,
        posted_failed: 0,
        success_rate: 0,
        ai_credits_total: 0,
        ai_usage_records: [],
      });
    }

    // 2. Add any users from profiles table if not already present
    for (const p of profs) {
      if (!p || !p.id) continue;
      if (!rows.has(p.id)) {
        rows.set(p.id, {
          user_id: p.id,
          email: p.email || `user_${p.id.slice(0, 6)}@dailygap.com`,
          created_at: p.created_at || new Date().toISOString(),
          last_sign_in_at: p.last_sign_in_at || null,
          ai_restricted: false,
          account_frozen: false,
          appeal: null,
          linkedin_connected: false,
          linkedin_name: null,
          calendars: 0,
          total_posts: 0,
          generated_posts: 0,
          manual_posts: 0,
          edited_posts: 0,
          posted_success: 0,
          posted_failed: 0,
          success_rate: 0,
          ai_credits_total: 0,
          ai_usage_records: [],
        });
      } else {
        const existing = rows.get(p.id)!;
        if (!existing.last_sign_in_at && p.last_sign_in_at) {
          existing.last_sign_in_at = p.last_sign_in_at;
        }
      }
    }

    // 3. Process LinkedIn connections & create fallback user rows if missing
    for (const conn of conns) {
      if (!conn?.user_id) continue;
      let r = rows.get(conn.user_id);
      if (!r) {
        r = {
          user_id: conn.user_id,
          email: `user_${conn.user_id.slice(0, 6)}@dailygap.com`,
          created_at: conn.created_at || new Date().toISOString(),
          last_sign_in_at: null,
          ai_restricted: false,
          account_frozen: false,
          appeal: null,
          linkedin_connected: true,
          linkedin_name: conn.linkedin_name || null,
          calendars: 0,
          total_posts: 0,
          generated_posts: 0,
          manual_posts: 0,
          edited_posts: 0,
          posted_success: 0,
          posted_failed: 0,
          success_rate: 0,
          ai_credits_total: 0,
          ai_usage_records: [],
        };
        rows.set(conn.user_id, r);
      } else {
        r.linkedin_connected = true;
        r.linkedin_name = conn.linkedin_name || null;
      }
    }

    for (const uRec of usage) {
      const r = rows.get(uRec.user_id);
      if (r) {
        r.ai_credits_total += Number(uRec.count || 0);
        r.ai_usage_records.push(uRec);
      }
    }

    for (const cal of cals) {
      const r = rows.get(cal.user_id);
      if (!r) continue;
      r.calendars += 1;
      const posts = Array.isArray(cal.posts) ? cal.posts : [];
      r.total_posts += posts.length;
      for (const p of posts) {
        const source = (p as any)?.source;
        const edited = !!(p as any)?.edited;
        if (source === 'manual') r.manual_posts += 1;
        else r.generated_posts += 1;
        if (edited) r.edited_posts += 1;
      }
    }

    for (const log of logs) {
      const r = rows.get(log.user_id);
      if (!r) continue;
      if (log.status === 'success') r.posted_success += 1;
      else if (log.status === 'failed' || log.status === 'error') r.posted_failed += 1;
    }

    const perUser = Array.from(rows.values()).map((r) => {
      const attempts = r.posted_success + r.posted_failed;
      r.success_rate = attempts > 0 ? Math.round((r.posted_success / attempts) * 100) : 0;
      return r;
    }).sort((a, b) => b.total_posts - a.total_posts);

    // Overall totals
    const totals = perUser.reduce((acc, r) => {
      acc.calendars += r.calendars;
      acc.total_posts += r.total_posts;
      acc.generated_posts += r.generated_posts;
      acc.manual_posts += r.manual_posts;
      acc.edited_posts += r.edited_posts;
      acc.posted_success += r.posted_success;
      acc.posted_failed += r.posted_failed;
      acc.ai_credits_total += r.ai_credits_total;
      if (r.linkedin_connected) acc.linkedin_connected += 1;
      if (r.ai_restricted) acc.ai_restricted_count += 1;
      if (r.account_frozen) acc.account_frozen_count += 1;
      if (r.appeal && r.appeal.status === 'pending') acc.pending_appeals_count += 1;
      return acc;
    }, {
      calendars: 0, total_posts: 0, generated_posts: 0, manual_posts: 0, edited_posts: 0,
      posted_success: 0, posted_failed: 0, linkedin_connected: 0, ai_credits_total: 0,
      ai_restricted_count: 0, account_frozen_count: 0, pending_appeals_count: 0
    });

    const attemptsTotal = totals.posted_success + totals.posted_failed;
    const overallSuccessRate = attemptsTotal > 0 ? Math.round((totals.posted_success / attemptsTotal) * 100) : 0;

    return new Response(JSON.stringify({
      summary: {
        total_users: usersList.length,
        active_users_7d: usersList.filter((u: any) => u.last_sign_in_at && (Date.now() - new Date(u.last_sign_in_at).getTime() < 7 * 86400000)).length,
        linkedin_connected: totals.linkedin_connected,
        total_calendars: totals.calendars,
        total_posts: totals.total_posts,
        generated_posts: totals.generated_posts,
        manual_posts: totals.manual_posts,
        edited_posts: totals.edited_posts,
        posted_success: totals.posted_success,
        posted_failed: totals.posted_failed,
        overall_success_rate: overallSuccessRate,
        ai_credits_total: totals.ai_credits_total,
        ai_restricted_count: totals.ai_restricted_count,
        account_frozen_count: totals.account_frozen_count,
        pending_appeals_count: totals.pending_appeals_count,
      },
      users: perUser,
      rawCalendars: cals,
      rawLogs: logs,
      rawConns: conns,
      rawAiUsage: usage,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
