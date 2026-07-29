import { createClient } from 'npm:@supabase/supabase-js@2';

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const page = (opts: { success: boolean; title: string; message: string; returnTo: string }) => {
  const { success, title, message, returnTo } = opts;
  const accent = success ? '#22c55e' : '#ef4444';
  const icon = success
    ? '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>'
    : '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escape(title)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background:#0a0a0a; color:#fff; margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
  .card { max-width: 420px; width: 100%; background:#131316; border:1px solid #26262b; border-radius:16px; padding:36px 28px; text-align:center; box-shadow: 0 20px 60px rgba(0,0,0,.4); }
  .icon { margin-bottom:16px; display:flex; justify-content:center; }
  h1 { font-size:20px; margin:0 0 10px; font-weight:600; }
  p { color:#a1a1aa; font-size:14px; line-height:1.55; margin:0 0 22px; }
  .btn { display:inline-block; width:100%; padding:11px 16px; border-radius:10px; border:none; cursor:pointer; font-weight:600; font-size:14px; background:${accent}; color:#0a0a0a; text-decoration:none; }
  .btn.secondary { background:transparent; color:#a1a1aa; border:1px solid #2e2e35; margin-top:10px; }
  .btn:hover { opacity:.92; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${escape(title)}</h1>
    <p>${escape(message)}</p>
    <button type="button" class="btn" onclick="closeOrReturn()">Close this window</button>
    <a class="btn secondary" href="${escape(returnTo || '/')}">Back to app</a>
  </div>
  <script>
    function closeOrReturn(){
      try { window.close(); } catch(_) {}
      setTimeout(function(){
        if (!window.closed) window.location.href = ${JSON.stringify(returnTo || '/')};
      }, 150);
    }
    // If opened as a popup, close automatically after a brief moment.
    if (window.opener && window.opener !== window) {
      setTimeout(function(){ try { window.close(); } catch(_) {} }, 1200);
    }
  </script>
</body>
</html>`;
};

const htmlResponse = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  let returnTo = '/dashboard';
  let userId = '';
  try {
    if (stateRaw) {
      const [payload, sig] = stateRaw.split('.');
      if (!payload || !sig) throw new Error('Malformed state');

      // Verify HMAC signature so an attacker can't forge a state with someone else's uid.
      const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
      );
      const sigBytes = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
      const ok = await crypto.subtle.verify(
        'HMAC', key, sigBytes, new TextEncoder().encode(payload)
      );
      if (!ok) throw new Error('Invalid state signature');

      const decoded = JSON.parse(atob(payload));
      // Reject states older than 15 minutes
      if (!decoded.iat || Date.now() - decoded.iat > 15 * 60 * 1000) {
        throw new Error('State expired');
      }
      userId = decoded.uid;
      if (decoded.returnTo) returnTo = decoded.returnTo;
    }
  } catch (_) {}

  if (errorParam || !code || !userId) {
    return htmlResponse(page({
      success: false,
      title: 'Connection failed',
      message: errorParam
        ? `LinkedIn returned an error: ${errorParam}. Please try connecting again.`
        : 'We couldn\'t complete the LinkedIn connection. Please try again.',
      returnTo,
    }), 400);
  }

  try {
    const clientId = Deno.env.get('LINKEDIN_CLIENT_ID')!;
    const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET')!;
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/linkedin-oauth-callback`;

    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);

    const accessToken = tokenData.access_token as string;
    const refreshToken = (tokenData.refresh_token as string) || null;
    const expiresIn = (tokenData.expires_in as number) || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Fetch profile via OIDC userinfo
    const profRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const prof = await profRes.json();
    if (!profRes.ok) throw new Error(`Profile fetch failed: ${JSON.stringify(prof)}`);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: upsertErr } = await adminClient
      .from('linkedin_connections')
      .upsert({
        user_id: userId,
        linkedin_sub: prof.sub,
        linkedin_name: prof.name || null,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      }, { onConflict: 'user_id' });
    if (upsertErr) throw upsertErr;

    return htmlResponse(page({
      success: true,
      title: 'LinkedIn connected',
      message: `You're all set${prof.name ? `, ${prof.name}` : ''}. You can close this window and return to Daily Gap — your posts will publish automatically from here.`,
      returnTo,
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return htmlResponse(page({
      success: false,
      title: 'Connection failed',
      message: `Something went wrong while linking your LinkedIn account: ${msg}. Please close this window and try again.`,
      returnTo,
    }), 500);
  }
});
