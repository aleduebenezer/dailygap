import { useEffect, useState } from "react";
import { Linkedin, Loader2, CheckCircle2, Unlink, Repeat2, ChevronDown, Timer, MessageCircle, Hash, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PostScheduleSettings from "@/components/PostScheduleSettings";
import AutoCommentSettings from "@/components/AutoCommentSettings";
import HashtagSettings from "@/components/HashtagSettings";

interface Props {
  userId: string;
  calendarId: string | null;
  calendarNiche: string | null;
}

interface LinkedInConnection {
  id: string;
  linkedin_name: string | null;
  expires_at: string;
}

const SectionShell = ({
  icon,
  title,
  active,
  defaultOpen,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="glass rounded-xl overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted/30 transition">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-medium text-foreground">{title}</span>
            {active && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                On
              </span>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

const LinkedInConnect = ({ userId, calendarId, calendarNiche }: Props) => {
  const [connection, setConnection] = useState<LinkedInConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [autoRepost, setAutoRepost] = useState(false);
  const [autoRepostSaving, setAutoRepostSaving] = useState(false);
  const [lastReposted, setLastRepostedAt] = useState<string | null>(null);
  const [recentAuthFailure, setRecentAuthFailure] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchConnection = async () => {
    const { data } = await supabase
      .from("linkedin_connections")
      .select("id, linkedin_name, expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    setConnection(data as LinkedInConnection | null);
    setLoading(false);
  };

  const fetchAutoRepost = async () => {
    const { data } = await supabase
      .from("linkedin_auto_reposts")
      .select("enabled, last_reposted_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setAutoRepost(!!data.enabled);
      setLastRepostedAt(data.last_reposted_at);
    }
  };

  const fetchRecentFailure = async () => {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("linkedin_post_log")
      .select("error, posted_at, status")
      .eq("user_id", userId)
      .eq("status", "failed")
      .gte("posted_at", since)
      .order("posted_at", { ascending: false })
      .limit(1);
    const err = String(data?.[0]?.error || "");
    const isAuth = /reconnect|refresh_token|expired|401|unauthorized|revoked/i.test(err);
    setRecentAuthFailure(isAuth ? err : null);
  };

  useEffect(() => {
    fetchConnection();
    fetchAutoRepost();
    fetchRecentFailure();
    const onFocus = () => { fetchConnection(); fetchAutoRepost(); fetchRecentFailure(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [userId]);

  const toggleAutoRepost = async (next: boolean) => {
    setAutoRepostSaving(true);
    try {
      const { data: existing } = await supabase
        .from("linkedin_auto_reposts")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("linkedin_auto_reposts")
          .update({ enabled: next })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("linkedin_auto_reposts")
          .insert({ user_id: userId, enabled: next });
        if (error) throw error;
      }
      setAutoRepost(next);
      toast.success(next ? "Auto-repost enabled (every 4h)" : "Auto-repost disabled");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setAutoRepostSaving(false);
    }
  };

  const connect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("linkedin-oauth-start", {
        body: { returnTo: window.location.origin + "/dashboard" },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Could not start LinkedIn connection");
      window.open(data.url, "_blank", "width=600,height=700");
      toast.info("Complete the LinkedIn login in the new window");
    } catch (e: any) {
      toast.error(e.message || "Failed to start LinkedIn connection");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!connection) return;
    if (!confirm("Disconnect LinkedIn? Auto-posting will stop.")) return;
    const { error } = await supabase
      .from("linkedin_connections")
      .delete()
      .eq("id", connection.id);
    if (error) toast.error(error.message);
    else {
      toast.success("LinkedIn disconnected");
      setConnection(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Linkedin className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground">LinkedIn</h3>
        </div>

        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : connection ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              Connected as <span className="font-medium">{connection.linkedin_name || "your account"}</span>
            </div>
            {(() => {
              const msLeft = new Date(connection.expires_at).getTime() - Date.now();
              const daysLeft = Math.floor(msLeft / (24 * 60 * 60 * 1000));
              const expired = msLeft <= 0;
              const soon = !expired && daysLeft <= 7;
              const failing = !!recentAuthFailure;
              if (!expired && !soon && !failing) return null;
              const tone = expired || failing
                ? "border-red-500/40 bg-red-500/10 text-red-200"
                : "border-amber-500/40 bg-amber-500/10 text-amber-100";
              const label = expired
                ? "LinkedIn access expired — reconnect to resume auto-posting."
                : failing
                ? "Recent post failed due to LinkedIn access. Reconnect to fix."
                : `LinkedIn access expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Reconnect soon.`;
              return (
                <div className={`rounded-lg border p-2 text-[11px] flex items-start gap-2 ${tone}`}>
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <p>{label}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="hero"
                        className="h-6 text-[11px] px-2"
                        onClick={connect}
                        disabled={connecting}
                      >
                        {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Linkedin className="h-3 w-3" />}
                        Reconnect
                      </Button>
                      {failing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] px-2"
                          disabled={retrying}
                          onClick={async () => {
                            setRetrying(true);
                            try {
                              await supabase.functions.invoke("linkedin-publish-due-posts");
                              await fetchRecentFailure();
                              toast.success("Retry triggered");
                            } catch (e: any) {
                              toast.error(e.message || "Retry failed");
                            } finally {
                              setRetrying(false);
                            }
                          }}
                        >
                          {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          Retry now
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 -ml-2" onClick={disconnect}>
              <Unlink className="h-3 w-3" /> Disconnect
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Link your LinkedIn account so Daily Gap can publish your scheduled posts automatically.
            </p>
            <Button variant="hero" size="sm" className="w-full" onClick={connect} disabled={connecting}>
              {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Linkedin className="h-3.5 w-3.5" />}
              Connect LinkedIn
            </Button>
          </>
        )}
      </div>

      {connection && (
        <div className="space-y-2">
          {calendarId && calendarNiche && (
            <SectionShell
              icon={<Timer className="h-3.5 w-3.5 text-primary" />}
              title="Auto-schedule post"
            >
              <PostScheduleSettings
                userId={userId}
                calendarId={calendarId}
                calendarNiche={calendarNiche}
              />
            </SectionShell>
          )}

          {/* Auto-repost temporarily hidden */}


          <SectionShell
            icon={<MessageCircle className="h-3.5 w-3.5 text-primary" />}
            title="Auto-comment under posts"
          >
            <AutoCommentSettings userId={userId} />
          </SectionShell>

          <SectionShell
            icon={<Hash className="h-3.5 w-3.5 text-primary" />}
            title="Hashtags on posts"
          >
            <HashtagSettings userId={userId} />
          </SectionShell>
        </div>
      )}

      {!connection && (
        <p className="text-xs text-muted-foreground italic px-1">
          Connect LinkedIn to set up auto-posting, reposting and commenting.
        </p>
      )}
    </div>
  );
};

export default LinkedInConnect;
