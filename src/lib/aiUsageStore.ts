import { supabase } from "@/integrations/supabase/client";

const AI_STORAGE_KEY_PREFIX = "dailygap_ai_credits_";

function getStorageKey(userId: string): string {
  return `${AI_STORAGE_KEY_PREFIX}${userId.toLowerCase().trim()}`;
}

export function getLocalAiCredits(userId: string): number {
  if (!userId) return 0;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return 0;
    const num = parseInt(raw, 10);
    return isNaN(num) ? 0 : num;
  } catch (e) {
    return 0;
  }
}

export async function recordAiUsage(userId: string, count: number = 1): Promise<void> {
  if (!userId || count <= 0) return;
  const today = new Date().toISOString().split("T")[0];

  // 1. Update local storage count
  try {
    const currentLocal = getLocalAiCredits(userId);
    localStorage.setItem(getStorageKey(userId), String(currentLocal + count));
    window.dispatchEvent(new Event("dailygap_data_changed"));
  } catch (e) {
    console.warn("Failed to store local AI credits:", e);
  }

  // 2. Persist to Supabase ai_usage_daily table
  try {
    const { data } = await supabase
      .from("ai_usage_daily")
      .select("count")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .maybeSingle();

    const currentDb = data?.count || 0;
    await supabase.from("ai_usage_daily").upsert(
      {
        user_id: userId,
        usage_date: today,
        count: currentDb + count,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,usage_date" }
    );
  } catch (e) {
    console.warn("Notice: could not record ai_usage_daily in DB:", e);
  }
}
