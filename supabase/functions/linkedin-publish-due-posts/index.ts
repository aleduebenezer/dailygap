import { createClient } from 'npm:@supabase/supabase-js@2';

// Helper: format date in given timezone as YYYY-MM-DD and HH:MM
function nowParts(tz: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: parseInt(get('hour')) * 60 + parseInt(get('minute')),
  };
}

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

async function downloadAsBlob(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Image fetch failed: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

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
    throw new Error('Access token expired and no refresh_token available — user must reconnect LinkedIn');
  }
  const fresh = await refreshLinkedInToken(conn.refresh_token);
  const { error } = await admin
    .from('linkedin_connections')
    .update({
      access_token: fresh.accessToken,
      refresh_token: fresh.refreshToken,
      expires_at: fresh.expiresAt,
    })
    .eq('id', conn.id);
  if (error) throw error;
  return { ...conn, access_token: fresh.accessToken, refresh_token: fresh.refreshToken, expires_at: fresh.expiresAt };
}

async function registerAndUploadImage(accessToken: string, author: string, bytes: Uint8Array) {
  const regRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: author,
        serviceRelationships: [
          { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
        ],
      },
    }),
  });
  const reg = await regRes.json();
  if (!regRes.ok) throw new Error(`registerUpload failed: ${JSON.stringify(reg)}`);
  const uploadUrl =
    reg.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const asset = reg.value.asset as string;
  const upRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: bytes,
  });
  if (!upRes.ok) throw new Error(`image upload failed: ${upRes.status}`);
  return asset as string;
}

async function publishToLinkedIn(opts: {
  accessToken: string; sub: string; text: string; imageUrl?: string;
}) {
  const { accessToken, sub, text, imageUrl } = opts;
  const author = `urn:li:person:${sub}`;
  let media: any = undefined;

  if (imageUrl) {
    try {
      const bytes = await downloadAsBlob(imageUrl);
      const asset = await registerAndUploadImage(accessToken, author, bytes);
      media = [{ status: 'READY', media: asset }];
    } catch (e) {
      console.error('Image attach failed, posting text only:', e);
      media = undefined;
    }
  }

  const payload = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: media ? 'IMAGE' : 'NONE',
        ...(media ? { media } : {}),
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`ugcPosts failed [${res.status}]: ${JSON.stringify(data)}`);
  return res.headers.get('x-restli-id') || data.id || null;
}

// ------- Comment generation -------

type CommentSpec = { type: string; needsMedia: boolean; mediaTheme?: string };

// Distribute requested types across `count` slots. If "Greeting" + "Well-wishes" both chosen,
// merge per user example (more greeting/well-wishes weight).
function planComments(count: number, types: string[]): CommentSpec[] {
  const t = types.length ? types : ['Greeting', 'Post-related', 'Well-wishes'];
  const mediaThemes: Record<string, string> = {
    Food: 'a delicious, appetizing, beautifully plated meal, natural lighting, instagram style',
    Fun: 'a funny harmless meme-style cartoon illustration, bright colors',
    'Well-wishes': 'a warm sunrise over calm scenery, peaceful vibes, photographic',
    Greeting: 'a cheerful good-morning sunrise scene, soft colors',
  };
  const mediaEligible = new Set(['Food', 'Fun', 'Well-wishes', 'Greeting']);

  // Round-robin distribute
  const plan: CommentSpec[] = [];
  for (let i = 0; i < count; i++) {
    const type = t[i % t.length];
    plan.push({
      type,
      needsMedia: mediaEligible.has(type),
      mediaTheme: mediaThemes[type],
    });
  }
  // Sort so greeting-ish comments come first naturally
  const order = ['Greeting', 'Well-wishes', 'Food', 'Fun', 'Post-related'];
  plan.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return plan;
}

async function generateCommentTexts(postText: string, plan: CommentSpec[]): Promise<string[]> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  const fallbackByType: Record<string, string[]> = {
    Greeting: ['Morning fam ☀️ hope your day is treating you kind so far!', 'Heyyy 👋 sending good vibes your way today!'],
    'Well-wishes': ['Wishing you a soft, sweet week ahead 💛', 'May your inbox be light and your coffee strong this week ☕'],
    Food: ['Brought breakfast btw 🥐 come grab a bite!', 'Take yourself out today, you’ve earned it 😂🍕'],
    Fun: ['Me reading this twice because it’s THAT good 😅', 'Saving this for the group chat real quick 😂'],
    'Post-related': ['This part hit different ngl 👀', 'The middle section made me stop scrolling fr.'],
  };

  if (!apiKey) {
    return plan.map((p) => {
      const arr = fallbackByType[p.type] || ['Love this 💛'];
      return arr[Math.floor(Math.random() * arr.length)];
    });
  }

  try {
    const prompt = `You are writing LinkedIn comments AS THE AUTHOR, dropping them under their own post to spark engagement. Sound like a real human friend texting — casual, warm, a little playful. NEVER sound like AI or corporate speak. Use 1-2 emojis per comment (natural placement, not at every sentence). Keep each comment 1 short sentence (max ~18 words). No hashtags. No "great post!" generic stuff. No quotes around the output.

Return ONLY a JSON array of strings, exactly ${plan.length} items, in the SAME order as the types below.

Types per comment (in order):
${plan.map((p, i) => `${i + 1}. ${p.type}`).join('\n')}

Guidelines per type:
- Greeting: friendly hello, wish them a wonderful day/morning.
- Well-wishes: warm, sweet, encouraging vibe (about their week, energy, day).
- Food: playful comment about food/treating themselves (e.g. "brought breakfast 🥐 come eat", "take 200k out your salary and take yourself out today 😂").
- Fun: light joke or playful reaction, no roast.
- Post-related: a real reaction to THIS post below — pick a specific line/idea, react like a friend would, sound human (use "ngl", "fr", "tbh" sparingly if it fits).

POST:
"""${postText.slice(0, 1500)}"""`;

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    const txt: string = data?.choices?.[0]?.message?.content ?? '';
    const match = txt.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('no array');
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr) || arr.length < plan.length) throw new Error('short array');
    return arr.slice(0, plan.length).map(String);
  } catch (e) {
    console.error('generateCommentTexts failed', e);
    return plan.map((p) => {
      const arr = fallbackByType[p.type] || ['Love this 💛'];
      return arr[Math.floor(Math.random() * arr.length)];
    });
  }
}

async function generateMediaImage(theme: string): Promise<Uint8Array | null> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return null;
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: `Generate an image: ${theme}` }],
        modalities: ['image', 'text'],
      }),
    });
    if (!res.ok) {
      console.error('image gen failed', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const imgB64 =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ??
      data?.choices?.[0]?.message?.images?.[0]?.url ??
      null;
    if (!imgB64) return null;
    const base64 = imgB64.includes(',') ? imgB64.split(',')[1] : imgB64;
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch (e) {
    console.error('generateMediaImage error', e);
    return null;
  }
}

async function postComment(
  accessToken: string,
  sub: string,
  postUrn: string,
  text: string,
  imageAsset?: string,
) {
  const encoded = encodeURIComponent(postUrn);
  const body: any = {
    actor: `urn:li:person:${sub}`,
    object: postUrn,
    message: { text },
  };
  if (imageAsset) {
    body.content = [{ type: 'IMAGE', entity: imageAsset }];
  }
  const res = await fetch(`https://api.linkedin.com/v2/socialActions/${encoded}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    // If image attach was rejected, retry without it
    if (imageAsset) {
      console.error(`comment with image failed [${res.status}]: ${errBody} — retrying text-only`);
      return postComment(accessToken, sub, postUrn, text);
    }
    throw new Error(`comment failed [${res.status}]: ${errBody}`);
  }
}

async function dropConfiguredComments(
  admin: any,
  conn: any,
  postUrn: string,
  postText: string,
  userId: string,
) {
  const { data: settings } = await admin
    .from('linkedin_auto_comments')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!settings || !settings.enabled) return;

  const count = Math.max(1, Math.min(10, settings.comment_count || 5));
  const types: string[] = (settings.comment_types && settings.comment_types.length)
    ? settings.comment_types
    : ['Greeting', 'Post-related', 'Well-wishes'];
  const attachMedia = !!settings.attach_media;

  const plan = planComments(count, types);
  const texts = await generateCommentTexts(postText, plan);
  const author = `urn:li:person:${conn.linkedin_sub}`;

  for (let i = 0; i < plan.length; i++) {
    const spec = plan[i];
    const text = texts[i];
    let asset: string | undefined;

    if (attachMedia && spec.needsMedia && spec.mediaTheme) {
      try {
        const bytes = await generateMediaImage(spec.mediaTheme);
        if (bytes) asset = await registerAndUploadImage(conn.access_token, author, bytes);
      } catch (e) {
        console.error('media for comment failed', e);
      }
    }

    try {
      await postComment(conn.access_token, conn.linkedin_sub, postUrn, text, asset);
    } catch (e) {
      console.error('comment error', e);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

Deno.serve(async (_req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: schedules } = await admin
    .from('post_schedules')
    .select('*')
    .eq('enabled', true);

  if (!schedules || schedules.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results: any[] = [];

  for (const sch of schedules) {
    try {
      const { date: today, minutes: nowMin } = nowParts(sch.timezone || 'UTC');
      const startMin = timeToMin(sch.start_time);
      // Fire as soon as start_time has passed today; ignore narrow end_time
      // (cron runs every 15 min — a 2-min window would otherwise be missed).
      if (nowMin < startMin) continue;
      if (!sch.calendar_id) continue;

      // Skip if we've already succeeded for this calendar today.
      const { data: successToday } = await admin
        .from('linkedin_post_log')
        .select('id')
        .eq('user_id', sch.user_id)
        .eq('calendar_id', sch.calendar_id)
        .eq('post_date', today)
        .eq('status', 'success')
        .limit(1);
      if (successToday && successToday.length > 0) continue;

      // Rate-limit retries: if we tried (success OR failed) in the last 10 min,
      // don't fire again this tick — prevents the cron from re-publishing when
      // a previous run is still in flight or LinkedIn briefly stalled.
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: recentAttempt } = await admin
        .from('linkedin_post_log')
        .select('id')
        .eq('user_id', sch.user_id)
        .eq('calendar_id', sch.calendar_id)
        .eq('post_date', today)
        .gte('posted_at', tenMinAgo)
        .limit(1);
      if (recentAttempt && recentAttempt.length > 0) continue;

      const { data: cal } = await admin
        .from('calendars')
        .select('*')
        .eq('id', sch.calendar_id)
        .maybeSingle();
      if (!cal || cal.frozen) continue;

      const posts = (cal.posts as any[]) || [];
      const indexed = posts.map((p, i) => ({ ...p, _i: i }));
      const target = indexed.find((p) => p.date === today);
      if (!target) continue;


      const { data: connRaw } = await admin
        .from('linkedin_connections')
        .select('*')
        .eq('user_id', sch.user_id)
        .maybeSingle();
      if (!connRaw) {
        await admin.from('linkedin_post_log').insert({
          user_id: sch.user_id, calendar_id: sch.calendar_id, post_date: today,
          post_index: target._i, status: 'failed', error: 'No LinkedIn connection',
        });
        continue;
      }

      let conn;
      try {
        conn = await ensureFreshToken(admin, connRaw);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin.from('linkedin_post_log').insert({
          user_id: sch.user_id, calendar_id: sch.calendar_id, post_date: today,
          post_index: target._i, status: 'failed', error: msg,
        });
        continue;
      }

      const { data: imgs } = await admin
        .from('gallery_images')
        .select('image_url')
        .eq('user_id', sch.user_id);
      const imageUrl = imgs && imgs.length > 0
        ? imgs[Math.floor(Math.random() * imgs.length)].image_url
        : undefined;

      try {
        const urn = await publishToLinkedIn({
          accessToken: conn.access_token,
          sub: conn.linkedin_sub,
          text: target.content,
          imageUrl,
        });
        await admin.from('linkedin_post_log').insert({
          user_id: sch.user_id, calendar_id: sch.calendar_id, post_date: today,
          post_index: target._i, linkedin_post_urn: urn, status: 'success',
        });
        results.push({ user: sch.user_id, ok: true, urn });

        if (urn) {
          try {
            await dropConfiguredComments(admin, conn, urn, target.content, sch.user_id);
          } catch (e) {
            console.error('dropConfiguredComments error', e);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin.from('linkedin_post_log').insert({
          user_id: sch.user_id, calendar_id: sch.calendar_id, post_date: today,
          post_index: target._i, status: 'failed', error: msg,
        });
        results.push({ user: sch.user_id, ok: false, error: msg });
      }
    } catch (e) {
      console.error('Schedule processing error', e);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
