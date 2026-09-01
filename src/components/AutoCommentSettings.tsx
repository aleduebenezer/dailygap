import { useEffect, useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TYPES = ["Fun", "Post-related", "Food", "Greeting", "Well-wishes"] as const;
type CType = (typeof TYPES)[number];

interface Props {
  userId: string;
}

const AutoCommentSettings = ({ userId }: Props) => {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState(5);
  const [types, setTypes] = useState<CType[]>(["Greeting", "Post-related", "Well-wishes"]);
  const [attachMedia, setAttachMedia] = useState(false);

  const localKey = `dailygap_autocomments_${userId}`;

  useEffect(() => {
    // 1. Read local storage
    try {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.enabled === "boolean") setEnabled(parsed.enabled);
        if (parsed.comment_count) setCount(parsed.comment_count);
        if (parsed.comment_types) setTypes(parsed.comment_types);
        if (typeof parsed.attach_media === "boolean") setAttachMedia(parsed.attach_media);
      }
    } catch (e) {
      console.warn("Could not parse local auto-comments:", e);
    }

    // 2. Read Supabase if configured
    if (isSupabaseConfigured) {
      (async () => {
        try {
          const { data } = await supabase
            .from("linkedin_auto_comments")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
          if (data) {
            setEnabled(!!data.enabled);
            setCount(data.comment_count || 5);
            setTypes((data.comment_types as CType[]) || ["Greeting", "Post-related", "Well-wishes"]);
            setAttachMedia(!!data.attach_media);
            localStorage.setItem(localKey, JSON.stringify(data));
          }
        } catch (e) {
          console.warn("Error fetching Supabase auto-comments:", e);
        } finally {
          setLoaded(true);
        }
      })();
    } else {
      setLoaded(true);
    }
  }, [userId, localKey]);

  const toggleType = (t: CType) => {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const save = async () => {
    if (enabled && types.length === 0) {
      toast.error("Pick at least one comment type");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      enabled,
      comment_count: count,
      comment_types: types,
      attach_media: attachMedia,
    };

    // Save locally
    try {
      localStorage.setItem(localKey, JSON.stringify(payload));
    } catch (e) {
      console.warn("Could not save local auto-comments:", e);
    }

    // Save to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const { data: existing } = await supabase
          .from("linkedin_auto_comments")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (existing) {
          await supabase
            .from("linkedin_auto_comments")
            .update(payload)
            .eq("id", existing.id);
        } else {
          await supabase.from("linkedin_auto_comments").insert(payload);
        }
      } catch (e: any) {
        console.warn("Supabase auto-comment save notice:", e);
      }
    }

    toast.success(enabled ? "Auto-comments enabled" : "Settings saved (off)");
    setSaving(false);
  };

  if (!loaded) return null;

  const mediaEligible = types.some((t) => ["Food", "Fun", "Greeting", "Well-wishes"].includes(t));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">Auto-comment under new posts</span>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        After each scheduled post goes live, drop a set of human-feeling comments under it.
      </p>

      <div className="space-y-2">
        <label className="text-[11px] text-muted-foreground block">
          How many comments? <span className="text-foreground font-medium">{count}</span>
        </label>
        <input
          type="range"
          min={1}
          max={10}
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground block">Comment vibes (pick any)</label>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => {
            const on = types.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                  on
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 p-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <div className="leading-tight">
            <div className="text-xs text-foreground font-medium">Attach memes / images</div>
            <div className="text-[10px] text-muted-foreground">
              Added to Fun, Food, Greeting & Well-wishes comments only.
            </div>
          </div>
        </div>
        <Switch checked={attachMedia} onCheckedChange={setAttachMedia} disabled={!mediaEligible} />
      </div>

      <Button variant="hero" size="sm" className="w-full" onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save comment settings"}
      </Button>
    </div>
  );
};

export default AutoCommentSettings;

