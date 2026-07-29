import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  userId: string;
}

const HashtagSettings = ({ userId }: Props) => {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("hashtags_enabled")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) setEnabled(!!data.hashtags_enabled);
      setLoaded(true);
    })();
  }, [userId]);

  const toggle = async (next: boolean) => {
    setSaving(true);
    setEnabled(next);
    try {
      const { data: existing } = await supabase
        .from("user_preferences")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("user_preferences")
          .update({ hashtags_enabled: next })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_preferences")
          .insert({ user_id: userId, hashtags_enabled: next });
        if (error) throw error;
      }
      toast.success(next ? "Hashtags enabled" : "Hashtags disabled");
    } catch (e: any) {
      setEnabled(!next);
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
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
