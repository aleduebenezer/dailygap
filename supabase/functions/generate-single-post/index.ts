import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, niche, samples, hashtagsEnabled, priorPosts } = await req.json();
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ---- Per-user daily cap for single-post regen ----
    const DAILY_CAP = 30;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    let userId: string | null = null;
    if (jwt) {
      const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${jwt}`, apikey: SERVICE_KEY },
      });
      if (uRes.ok) {
        const u = await uRes.json();
        userId = u?.id ?? null;
        if (u?.user_metadata?.ai_restricted === true) {
          return new Response(
            JSON.stringify({ error: "Your account has been restricted from using AI generation features by an Administrator." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
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
          JSON.stringify({ error: `Daily limit reached. You can regenerate up to ${DAILY_CAP} single posts per day. Try again tomorrow.` }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
      ? `\n\nWriting samples to mirror style/tone/language:\n${samples.map((s: string, i: number) => `Sample ${i + 1}: "${s}"`).join("\n")}`
      : "";

    const priorList: string[] = Array.isArray(priorPosts) ? priorPosts.filter((p: any) => typeof p === "string" && p.trim()).slice(-8) : [];
    const priorBlock = priorList.length > 0
      ? `\n\nPrior posts from THIS user (ground truth about who they are):\n${priorList.map((p, i) => `Prior ${i + 1}:\n"""\n${p}\n"""`).join("\n\n")}\n\nGROUNDING RULES:\n- Match the seniority, industry, tool stack, team size, and level of mastery shown in the prior posts. Do not upgrade or downgrade the user's real role.\n- Do not fabricate specific numbers (revenue, MRR, headcount, followers, deal sizes), famous clients, exits, funding, awards, or credentials that aren't already implied by prior posts.\n- If a topic would require an experience the user clearly hasn't had, write it as an observation, question, or peer story — not as a first-person war story.\n- Pick ONE specific, realistic scene the user would actually live. Concrete beats abstract. No sweeping thought-leader claims.`
      : `\n\nNo prior post history. Stay grounded: commit to ONE specific, realistic scene a person in this niche would actually experience. No fabricated metrics, credentials, or famous-client name-drops. Concrete beats abstract.`;

    const systemPrompt = `You are a LinkedIn ghostwriter. Write ONE single LinkedIn post that reads 100% human.

Rules:
- Burstiness: mix very short and longer sentences.
- First person, real stakes, opinion over balance, contractions.
- No em dashes, no tricolons, no "not only X but Y", no hype words (game-changer, unlock, leverage, seamless, dive into, delve, journey, landscape, realm, ecosystem, paradigm, synergy, holistic, curated, world-class, fast-paced, ever-evolving).
- No stock openers ("In today's...", "Let's face it", "Picture this", "Imagine").
- No wrap-up clichés ("In conclusion", "At the end of the day", "The bottom line").
- Hook in the first 1-2 short lines.
- 3-7 short paragraphs of 1-3 lines each, with blank lines.
- 90-280 words. No markdown, no headings.
${hashtagsEnabled
  ? '- HASHTAGS: End the post with 1 to 3 relevant hashtags directly tied to the specific topic (e.g. product management post gets #ProductManagement #ProductStrategy). Single final line, space-separated. No generic ones like #linkedin, #motivation.'
  : '- HASHTAGS: Do not include any hashtags anywhere in the post.'}
- Detect language from samples if any; else English.
${niche ? `\nNiche context: "${niche}"` : ""}${sampleText}${priorBlock}

Return ONLY the post text, nothing else.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write a single LinkedIn post about: ${prompt.trim()}` },
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
    const content = (data.choices?.[0]?.message?.content || "").trim();

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-single-post error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
