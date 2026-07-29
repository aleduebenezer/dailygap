import { useState, useEffect } from "react";
import { Clock, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PostScheduleSettingsProps {
  userId: string;
  calendarId: string;
  calendarNiche: string;
}

const TIMEZONES = [
  { label: "WAT (West Africa)", value: "Africa/Lagos" },
  { label: "CAT (Central Africa)", value: "Africa/Maputo" },
  { label: "EAT (East Africa)", value: "Africa/Nairobi" },
  { label: "GMT", value: "Etc/GMT" },
  { label: "EST (US Eastern)", value: "America/New_York" },
  { label: "PST (US Pacific)", value: "America/Los_Angeles" },
  { label: "CET (Central Europe)", value: "Europe/Berlin" },
  { label: "IST (India)", value: "Asia/Kolkata" },
];

const PostScheduleSettings = ({ userId, calendarId, calendarNiche }: PostScheduleSettingsProps) => {
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("08:15");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchSchedule();
  }, [calendarId]);

  const fetchSchedule = async () => {
    const { data } = await supabase
      .from("post_schedules")
      .select("*")
      .eq("user_id", userId)
      .eq("calendar_id", calendarId)
      .maybeSingle();

    if (data) {
      setStartTime(data.start_time);
      setEndTime(data.end_time);
      setTimezone(data.timezone);
      setEnabled(data.enabled);
    }
    setLoaded(true);
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("post_schedules")
        .select("id")
        .eq("user_id", userId)
        .eq("calendar_id", calendarId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("post_schedules")
          .update({ start_time: startTime, end_time: endTime, timezone, enabled })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("post_schedules")
          .insert({
            user_id: userId,
            calendar_id: calendarId,
            start_time: startTime,
            end_time: endTime,
            timezone,
            enabled,
          });
        if (error) throw error;
      }

      toast.success(enabled ? "Auto-posting schedule saved!" : "Schedule saved (disabled)");
    } catch (err: any) {
      toast.error(err.message || "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Timer className="h-3.5 w-3.5" /> Auto-Post Schedule
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{enabled ? "Active" : "Off"}</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Posts for <span className="font-medium text-foreground">{calendarNiche}</span> will be published to LinkedIn within your time window.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">From</label>
            <div className="relative">
              <Clock className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-surface rounded-lg pl-8 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">To</label>
            <div className="relative">
              <Clock className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-surface rounded-lg pl-8 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full bg-surface rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="hero"
          size="sm"
          className="w-full"
          onClick={saveSchedule}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Schedule"}
        </Button>

        {!enabled && (
          <p className="text-xs text-muted-foreground text-center italic">
            Enable the toggle above to activate auto-posting
          </p>
        )}
      </div>
    </div>
  );
};

export default PostScheduleSettings;
