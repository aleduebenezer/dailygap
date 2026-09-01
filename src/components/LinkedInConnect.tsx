import { useEffect, useState } from "react";
import {
  Linkedin,
  Loader2,
  CheckCircle2,
  Unlink,
  ChevronDown,
  Timer,
  MessageCircle,
  Hash,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
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

const LOCAL_STORAGE_KEY = "dailygap_linkedin_connections";

export const getLocalConnection = (userId: string): LinkedInConnection | null => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed[userId] || null;
  } catch {
    return null;
  }
};

export const saveLocalConnection = (userId: string, conn: LinkedInConnection | null) => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (conn) {
      parsed[userId] = conn;
    } else {
      delete parsed[userId];
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(new Event("dailygap_linkedin_changed"));
  } catch (e) {
    console.warn("Failed to persist local LinkedIn connection:", e);
  }
};

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
    // 1. Check local storage first
    const local = getLocalConnection(userId);
    if (local) {
      setConnection(local);
      setLoading(false);
    }

    // 2. Sync with Supabase if configured
    try {
      if (isSupabaseConfigured) {
        const { data } = await supabase
          .from("linkedin_connections")
          .select("id, linkedin_name, expires_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (data) {
          const conn = data as LinkedInConnection;
          setConnection(conn);
          saveLocalConnection(userId, conn);
        }
      }
    } catch (e) {
      console.warn("Error fetching Supabase LinkedIn connection:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAutoRepost = async () => {
    try {
      if (isSupabaseConfigured) {
        const { data } = await supabase
          .from("linkedin_auto_reposts")
          .select("enabled, last_reposted_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (data) {
          setAutoRepost(!!data.enabled);
          setLastRepostedAt(data.last_reposted_at);
        }
      }
    } catch (e) {
      console.warn("Error fetching auto-repost:", e);
    }
  };

  const fetchRecentFailure = async () => {
    try {
      if (isSupabaseConfigured) {
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
      }
    } catch (e) {
      console.warn("Error fetching recent post failure:", e);
    }
  };

  useEffect(() => {
    fetchConnection();
    fetchAutoRepost();
    fetchRecentFailure();
    const onSync = () => {
      fetchConnection();
      fetchAutoRepost();
      fetchRecentFailure();
    };
    window.addEventListener("focus", onSync);
    window.addEventListener("dailygap_linkedin_changed", onSync);
    return () => {
      window.removeEventListener("focus", onSync);
      window.removeEventListener("dailygap_linkedin_changed", onSync);
    };
  }, [userId]);

  const toggleAutoRepost = async (next: boolean) => {
    setAutoRepostSaving(true);
    try {
      if (isSupabaseConfigured) {
        const { data: existing } = await supabase
          .from("linkedin_auto_reposts")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (existing) {
          await supabase
            .from("linkedin_auto_reposts")
            .update({ enabled: next })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("linkedin_auto_reposts")
            .insert({ user_id: userId, enabled: next });
        }
      }
      setAutoRepost(next);
      toast.success(next ? "Auto-repost enabled (every 4h)" : "Auto-repost disabled");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setAutoRepostSaving(false);
    }
  };

  const startOAuthFlow = async () => {
    setConnecting(true);
    try {
      let authUrl = "";
      if (isSupabaseConfigured) {
        // Try calling the Supabase Edge Function to get the signed LinkedIn authorization URL
        try {
          const { data, error } = await supabase.functions.invoke("linkedin-oauth-start", {
            body: { returnTo: window.location.origin + "/dashboard" },
          });

          if (!error && data?.url) {
            authUrl = data.url;
          }
        } catch (invokeErr) {
          console.warn("Edge function invoke warning:", invokeErr);
        }
      }

      // Fallback direct LinkedIn OAuth if Edge Function is not yet deployed
      if (!authUrl) {
        const clientId = "78yxa61r642kzp";
        const redirectUri = encodeURIComponent("https://hzfjbevytkwicyioiuqm.supabase.co/functions/v1/linkedin-oauth-callback");
        const state = encodeURIComponent(JSON.stringify({ uid: userId, returnTo: window.location.origin + "/dashboard", iat: Date.now() }));
        const scope = encodeURIComponent("openid profile email w_member_social");
        authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;
      }

      // Open LinkedIn in a separate popup window so iframe policies (X-Frame-Options) don't block it
      const popup = window.open(
        authUrl,
        "linkedin_oauth_window",
        "width=620,height=720,menubar=no,toolbar=no,location=yes,status=no"
      );

      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        // If popup blocker intervened, open in new tab
        window.open(authUrl, "_blank");
      }

      toast.info("Please log in and allow permissions in the LinkedIn window.");

      // Poll every 2 seconds for 60 seconds while user completes OAuth in the popup
      let pollCount = 0;
      const interval = setInterval(async () => {
        pollCount++;
        const current = await fetchConnection();
        if (current || pollCount > 30) {
          clearInterval(interval);
        }
      }, 2000);
    } catch (e: any) {
      console.error("LinkedIn connection error:", e);
      toast.error(e.message || "Could not connect to LinkedIn");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!connection) return;
    try {
      saveLocalConnection(userId, null);
      if (isSupabaseConfigured) {
        await supabase
          .from("linkedin_connections")
          .delete()
          .eq("user_id", userId);
      }
      toast.success("LinkedIn disconnected");
      setConnection(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect");
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
              const tone =
                expired || failing
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
                        onClick={startOAuthFlow}
                        disabled={connecting}
                      >
                        {connecting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Linkedin className="h-3 w-3" />
                        )}
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
                              if (isSupabaseConfigured) {
                                await supabase.functions.invoke("linkedin-publish-due-posts");
                                await fetchRecentFailure();
                              }
                              toast.success("Retry triggered");
                            } catch (e: any) {
                              toast.error(e.message || "Retry failed");
                            } finally {
                              setRetrying(false);
                            }
                          }}
                        >
                          {retrying ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Retry now
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs h-7 -ml-2 text-muted-foreground hover:text-destructive"
              onClick={disconnect}
            >
              <Unlink className="h-3 w-3" /> Disconnect
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Authorize Daily Gap with official LinkedIn OAuth to automatically publish scheduled posts to your feed.
            </p>
            <Button
              variant="hero"
              size="sm"
              className="w-full"
              onClick={startOAuthFlow}
              disabled={connecting}
            >
              {connecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Linkedin className="h-3.5 w-3.5" />
              )}
              Connect LinkedIn Account
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

