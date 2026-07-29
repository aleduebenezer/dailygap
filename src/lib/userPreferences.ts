import { supabase } from "@/integrations/supabase/client";

export async function getHashtagsEnabled(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("user_preferences")
    .select("hashtags_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data?.hashtags_enabled;
}
