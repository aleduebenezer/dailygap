import { createClient } from 'npm:@supabase/supabase-js@2';

const REPOST_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

async function refreshLinkedInToken(refreshToken: string) {
  const clientId = Deno.env.get('LINKEDIN_CLIENT_ID')!;
  const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET')!;
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string) || refreshToken,
    expiresAt: new Date(Date.now() + ((data.expires_in as number) || 3600) * 1000).toISOString(),
  };
}

async function ensureFreshToken(admin: any, conn: any) {
  const expiresMs = new Date(conn.expires_at).getTime();
  if (expiresMs - Date.now() > 24 * 60 * 60 * 1000) return conn;
  if (!conn.refresh_token) {
    throw new Error('Access token expired and no refresh_token — user must reconnect LinkedIn');
  }
  const fresh = await refreshLinkedInToken(conn.refresh_token);
  await admin.from('linkedin_connections').update({
    access_token: fresh.accessToken,
    refresh_token: fresh.refreshToken,
    expires_at: fresh.expiresAt,
  }).eq('id', conn.id);
  return { ...conn, access_token: fresh.accessToken, refresh_token: fresh.refreshToken, expires_at: fresh.expiresAt };
}

// Fetch latest post URN authored by the member.
// Requires r_member_social or w_member_social-with-read; if it 403s we fall back to the latest URN we logged.
async function fetchLatestPostUrn(accessToken: string, sub: string): Promise<string | null> {
  const author = encodeURIComponent(`urn:li:person:${sub}`);
  const url = `https://api.linkedin.com/rest/posts?author=${author}&q=author&count=10&sortBy=LAST_MODIFIED`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': '202603',
      'X-Restli-Protocol-Version': '2.0.0',
    },
  });
  if (!res.ok) {
    console.log('fetchLatestPostUrn failed', res.status, await res.text().catch(() => ''));
    return null;
  }
  const data = await res.json().catch(() => ({}));
  const elements = data?.elements || [];
  const first = elements.find((p: any) => p?.id && p?.lifecycleState === 'PUBLISHED') || elements[0];
  return first?.id || null;
}

async function reshare(accessToken: string, sub: string, parentUrn: string): Promise<string | null> {
  const author = `urn:li:person:${sub}`;
  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202603',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author,
      commentary: '',
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
      reshareContext: { parent: parentUrn },
    }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`reshare failed [${res.status}]: ${txt}`);
  return res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id') || null;
}

Deno.serve(async (_req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: settings } = await admin
    .from('linkedin_auto_reposts')
    .select('*')
    .eq('enabled', true);

  if (!settings || settings.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results: any[] = [];
  const now = Date.now();

  for (const s of settings) {
    try {
      if (s.last_reposted_at && now - new Date(s.last_reposted_at).getTime() < REPOST_INTERVAL_MS) continue;

      const { data: connRaw } = await admin
        .from('linkedin_connections')
        .select('*')
        .eq('user_id', s.user_id)
        .maybeSingle();
      if (!connRaw) {
        await admin.from('linkedin_auto_reposts').update({ last_error: 'No LinkedIn connection' }).eq('id', s.id);
        continue;
      }

      let conn;
      try {
        conn = await ensureFreshToken(admin, connRaw);
      } catch (e) {
        await admin.from('linkedin_auto_reposts').update({ last_error: e instanceof Error ? e.message : String(e) }).eq('id', s.id);
        continue;
      }

      // Try fetching latest post directly from LinkedIn; fall back to our log.
      let parentUrn = await fetchLatestPostUrn(conn.access_token, conn.linkedin_sub);
      if (!parentUrn) {
        const { data: lastLog } = await admin
          .from('linkedin_post_log')
          .select('linkedin_post_urn')
          .eq('user_id', s.user_id)
          .eq('status', 'success')
          .not('linkedin_post_urn', 'is', null)
          .order('posted_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        parentUrn = lastLog?.linkedin_post_urn || null;
      }

      if (!parentUrn) {
        await admin.from('linkedin_auto_reposts').update({
          last_error: 'No recent post found to reshare (needs r_member_social scope or a prior auto-posted post).',
        }).eq('id', s.id);
        continue;
      }

      // Avoid resharing the same URN repeatedly back-to-back.
      if (s.last_reposted_urn === parentUrn && s.last_reposted_at && now - new Date(s.last_reposted_at).getTime() < REPOST_INTERVAL_MS * 2) {
        continue;
      }

      try {
        const newUrn = await reshare(conn.access_token, conn.linkedin_sub, parentUrn);
        await admin.from('linkedin_auto_reposts').update({
          last_reposted_at: new Date().toISOString(),
          last_reposted_urn: parentUrn,
          last_error: null,
        }).eq('id', s.id);
        results.push({ user: s.user_id, ok: true, reshared: parentUrn, newUrn });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin.from('linkedin_auto_reposts').update({ last_error: msg }).eq('id', s.id);
        results.push({ user: s.user_id, ok: false, error: msg });
      }
    } catch (e) {
      console.error('auto-repost error', e);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
