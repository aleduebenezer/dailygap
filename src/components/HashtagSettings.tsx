import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  userId: string;
}

const HashtagSettings = ({ userId }: Props) => {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const localKey = `dailygap_hashtags_${userId}`;

  useEffect(() => {
    // 1. Read local storage
    try {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.hashtags_enabled === "boolean") {
          setEnabled(parsed.hashtags_enabled);
        }
      }
    } catch (e) {
      console.warn("Could not parse local hashtags settings:", e);
    }

    // 2. Read Supabase if configured
    if (isSupabaseConfigured) {
      (async () => {
        try {
          const { data } = await supabase
            .from("user_preferences")
            .select("hashtags_enabled")
            .eq("user_id", userId)
            .maybeSingle();
          if (data) {
            setEnabled(!!data.hashtags_enabled);
            localStorage.setItem(localKey, JSON.stringify(data));
          }
        } catch (e) {
          console.warn("Error fetching Supabase hashtags setting:", e);
        } finally {
          setLoaded(true);
        }
      })();
    } else {
      setLoaded(true);
    }
  }, [userId, localKey]);

  const toggle = async (next: boolean) => {
    setSaving(true);
    setEnabled(next);

    // Save locally
    try {
      localStorage.setItem(localKey, JSON.stringify({ hashtags_enabled: next }));
    } catch (e) {
      console.warn("Could not save local hashtags setting:", e);
    }

    // Save to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const { data: existing } = await supabase
          .from("user_preferences")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (existing) {
          await supabase
            .from("user_preferences")
            .update({ hashtags_enabled: next })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("user_preferences")
            .insert({ user_id: userId, hashtags_enabled: next });
        }
      } catch (e: any) {
        console.warn("Supabase hashtag save notice:", e);
      }
    }

    toast.success(next ? "Hashtags enabled" : "Hashtags disabled");
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">Include hashtags</p>
          <p className="text-[11px] text-muted-foreground">
            Every generated post will get 1–3 relevant hashtags tied to its topic.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={toggle} disabled={saving} />
      </div>
    </div>
  );
};

export default HashtagSettings;

