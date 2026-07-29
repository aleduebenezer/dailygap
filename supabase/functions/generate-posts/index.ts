import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, samples, numDays, startDate, regenerate, hashtagsEnabled, priorPosts } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ---- Per-user daily cap (soft protection against runaway usage) ----
    const DAILY_CAP = 3; // max calendar generations per user per day
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    let userId: string | null = null;
    if (jwt) {
      const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${jwt}`, apikey: SERVICE_KEY },
      });
      if (uRes.ok) {
        const u = await uRes.json();
        userId = u?.id ?? null;
      }
    }
    if (userId) {
      const today = new Date().toISOString().split("T")[0];
      const usageRes = await fetch(
        `${SUPABASE_URL}/rest/v1/ai_usage_daily?user_id=eq.${userId}&usage_date=eq.${today}&select=count`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const rows = usageRes.ok ? await usageRes.json() : [];
      const current = rows?.[0]?.count ?? 0;
      if (current >= DAILY_CAP) {
        return new Response(
          JSON.stringify({ error: `Daily limit reached. You can generate up to ${DAILY_CAP} calendars per day. Try again tomorrow.` }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // upsert increment
      await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_daily?on_conflict=user_id,usage_date`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({ user_id: userId, usage_date: today, count: current + 1 }),
      });
    }

    const sampleText = samples && samples.length > 0
      ? `\n\nHere are writing samples from the user to match their style, tone, and language:\n${samples.map((s: string, i: number) => `Sample ${i + 1}: "${s}"`).join("\n")}`
      : "";

    const priorList: string[] = Array.isArray(priorPosts) ? priorPosts.filter((p: any) => typeof p === "string" && p.trim()).slice(-8) : [];
    const priorBlock = priorList.length > 0
      ? `\n\n# Prior posts from THIS user (ground truth about who they are)\n\nThese are posts this user has already published or approved. Treat them as evidence of the user's real life: their seniority, their industry, the tools they actually use, the kind of decisions they actually make, the size of the problems they actually deal with, the tone they naturally use.\n\n${priorList.map((p, i) => `Prior post ${i + 1}:\n"""\n${p}\n"""`).join("\n\n")}\n\nGROUNDING RULES (do not violate):\n- Only reference experiences, roles, seniority, tools, team sizes, budgets, client types, industries, and metrics that are consistent with the prior posts above. If a prior post shows someone early in their career, do not suddenly write as a VP with a team of 40.\n- Do not invent specific numbers (revenue, MRR, headcount, follower counts, deal sizes) that were not implied by prior posts. If you need a concrete detail, use a small, plausible one from what's already established, or stay qualitative.\n- Do not fabricate famous clients, exits, funding rounds, awards, or credentials.\n- If a topic would require an experience the user clearly hasn't had, write it as an observation, a question, or something you heard from a peer — not as a first-person war story.\n- Keep the level of mastery and vocabulary aligned with the prior posts. If prior posts sound like a mid-level operator, don't suddenly sound like a keynote speaker.\n- Concrete beats abstract. When you commit to a scene, use the KIND of scene the user would actually have (same seniority, same industry, same tool stack).`
      : `\n\n# No prior posts yet\nSince there is no prior post history, stay grounded and plausible: pick ONE realistic scenario the person in the given niche would actually experience, and write from inside that specific moment. Avoid grand, sweeping, abstract claims. No fabricated credentials, no fabricated metrics, no famous-client name-drops.`;


    const systemPrompt = `You are a LinkedIn ghostwriter whose only job is to produce posts that read 100% human and 0% AI. Real people wrote these. Not a model. Not a bot. A person with a point of view, a Tuesday, a bad coffee, and an opinion.

# Non-negotiable voice rules (follow ALL of them)

1. BURSTINESS. Mix very short sentences with longer, winding ones. Vary rhythm hard. A 3-word line next to a 28-word line is normal. Never let three sentences in a row share the same length or shape.

2. PERPLEXITY. Choose the less obvious word when it still fits. Avoid the statistically average phrasing. If the first word that comes to mind feels like something an AI would say, pick a different one.

3. FIRST PERSON, REAL STAKES. Write as "I" or to "you". Drop a real-feeling moment, mistake, client story, number, name of a tool, week-day, location, dollar figure, or screenshot-worthy detail. Lived texture beats abstract advice every time.

4. OPINION OVER BALANCE. Take a stand. Say the thing. Replace neutral, "on one hand / on the other" framing with a definitive view. Better to be slightly wrong and confident than perfectly hedged and forgettable.

5. SPEAK, DON'T LECTURE. Use contractions (I'm, don't, you're, it's). Start sentences with "And" or "But" when it sounds natural. Drop a short aside in parentheses now and then. Ask the reader 1 short question if it fits, not more.

6. INTRO HAS TO HOOK LIKE A HUMAN. The first 1-2 lines must read like something a person typed in a moment of frustration, surprise, or strong opinion. A scene, a confession, a contrarian take, a number, a punchline. Never start with "In today's", "In the world of", "Let's dive into", "Imagine", "Picture this", "Have you ever wondered".

# Banned AI tells (do NOT use any of these)

- Em dashes (the long dash character). Use commas, periods, or parentheses instead.
- Tricolons / lists of three ("clear, concise, and compelling", "fast, easy, and reliable").
- Paired constructions: "not only X but also Y", "it's not just X, it's Y", "more than that, it's also".
- Hype and marketing words: game-changer, game-changing, revolutionary, unlock, unleash, elevate, supercharge, leverage (as a verb), seamless, seamlessly, robust, cutting-edge, transformative, empower, harness, dive into, deep dive, delve, explore, navigate, navigating, journey, roadmap, compass, landscape, realm, in the realm of, ecosystem, paradigm, synergy, holistic, curated, bespoke, world-class, next-level, fast-paced, ever-evolving, rapidly evolving.
- Stock openers: "In today's fast-paced world", "In an era of", "Let's face it", "It's important to note that", "It goes without saying", "Picture this", "Imagine".
- Wrap-up clichés: "In conclusion", "In summary", "The bottom line is", "At the end of the day", "Here's the takeaway", "Remember:".
- Generic transitions: "This approach highlights the importance of", "This underscores", "Moreover", "Furthermore" as a paragraph starter.
- Excessive bullet lists. Default to running prose. Use a short list (max 3 items) only when it genuinely helps readability.
- Hashtag spam. Zero, or max 2 relevant ones at the very end. Never mid-post.
- Emoji overload. Zero or one, only if the voice is genuinely casual.
- "AI-typical" sentence shape: "Whether you're X, Y, or Z, doing A will help you B." Reformulate.
- Summary endings that restate the post. End on a sharp line, a question, or a small confession instead, or just stop.

# Structure (what a good post looks like)

- Hook: 1-2 short lines, scroll-stopping, specific.
- Body: 3-7 short paragraphs of 1-3 lines each, with blank lines between them (LinkedIn rhythm).
- Land on one concrete idea, lesson, or take. Not a summary of all the above.

Keep posts between 90 and 280 words. No headings, no markdown bold or italics, no code blocks. Just text and line breaks the way a person would type into the LinkedIn composer.

# Language matching

Detect the language of the user's writing samples and write the posts in that exact language. Default to English if no samples. If samples exist, mirror their cadence, favorite filler words, how casual or formal they are, whether they use questions, how long their typical sentences run.${sampleText}${priorBlock}`;

    const count = regenerate ? 1 : numDays;
    const start = new Date(startDate);

    const dates = Array.from({ length: count }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d.toISOString().split("T")[0];
    });

    const hashtagRule = hashtagsEnabled
      ? `\n\nHASHTAGS: End each post with 1 to 3 relevant hashtags directly tied to the specific topic of that post (e.g. a post about product management gets things like #ProductManagement #ProductStrategy). Place them on a single final line, separated by spaces. No generic hashtags like #linkedin, #motivation, #success. No mid-post hashtags.`
      : `\n\nHASHTAGS: Do not include any hashtags anywhere in the post.`;

    const userPrompt = `Generate ${count} LinkedIn post${count > 1 ? "s" : ""} for someone in the "${niche}" niche.
${count > 1 ? `These posts should cover different trending topics and pain points in this field.` : `This post should cover a trending topic or pain point in this field.`}${hashtagRule}

Return a JSON array with exactly ${count} objects, each with "date" and "content" fields.
Dates should be: ${dates.join(", ")}

Return ONLY valid JSON array, no markdown, no code blocks.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Add funds in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Parse the JSON from the response
    let posts;
    try {
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      posts = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse generated posts");
    }

    return new Response(JSON.stringify({ posts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-posts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
