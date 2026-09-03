import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun, Moon, Plus, Sparkles, LogOut, ChevronLeft, ChevronRight, X, Copy,
  ChevronDown, Trash2, MoreHorizontal, Pencil, Share2, Snowflake, Settings2, Clock, Check, Wand2, ShieldCheck,
  Menu, Settings, User, Linkedin
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { handleAiError } from "@/lib/handleAiError";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/ThemeContext";
import CalendarCustomizer from "@/components/CalendarCustomizer";
import CalendarTemplates, { CalendarTemplate } from "@/components/CalendarTemplates";
import useCalendarDecorations, { DecorationToolbar, DecorationOverlay } from "@/components/CalendarDecorations";
import { Logo } from "@/components/Logo";
import { SEO } from "@/components/SEO";
import ImageGallery from "@/components/ImageGallery";
import LinkedInConnect from "@/components/LinkedInConnect";
import OnboardingTour from "@/components/OnboardingTour";
import { NotificationCenter, sendNotification } from "@/components/NotificationCenter";
import { SearchBar } from "@/components/SearchBar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getHashtagsEnabled } from "@/lib/userPreferences";
import {
  getLocalCalendars,
  updateLocalCalendar,
  deleteLocalCalendar,
  clearLocalCalendars,
  syncServerCalendars,
} from "@/lib/localCalendarStore";
import { recordAiUsage } from "@/lib/aiUsageStore";
import { ProfileAvatarMenu } from "@/components/ProfileAvatarMenu";
import { SettingsModal } from "@/components/SettingsModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface PostEntry {
  date: string;
  content: string;
  platform?: string;
  niche?: string;
}

interface ExpandedPostState {
  date: string;
  index: number;
}

interface CalendarEntry {
  id: string;
  niche: string;
  start_date: string;
  posts: PostEntry[];
  created_at: string;
  frozen: boolean;
}

const Dashboard = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut, isAiRestricted } = useAuth();
  const navigate = useNavigate();
  const [calendars, setCalendars] = useState<CalendarEntry[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<CalendarEntry | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expandedPost, setExpandedPost] = useState<ExpandedPostState | null>(null);
  const [calendarColor, setCalendarColor] = useState("hsl(220, 90%, 56%)");
  const [calendarFont, setCalendarFont] = useState("'Inter', sans-serif");
  const [selectedTemplateId, setSelectedTemplateId] = useState("default");
  const [templateBg, setTemplateBg] = useState<{ image: string | null; opacity: number } | null>(null);
  const decor = useCalendarDecorations({ calendarId: selectedCalendar?.id || null, userId: user?.id || "" });

  // Clear calendar modal state
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearPassword, setClearPassword] = useState("");
  const [clearLoading, setClearLoading] = useState(false);

  // Niche edit modal state
  const [editNicheDialog, setEditNicheDialog] = useState<CalendarEntry | null>(null);
  const [editNicheValue, setEditNicheValue] = useState("");
  const [editTab, setEditTab] = useState<"rename" | "extend" | "regenerate">("rename");
  const [extendDays, setExtendDays] = useState(7);
  const [regenMode, setRegenMode] = useState<"keep" | "new">("keep");
  const [regenStartDate, setRegenStartDate] = useState("");
  const [regenNumDays, setRegenNumDays] = useState(10);
  const [editLoading, setEditLoading] = useState(false);

  // Delete niche modal state
  const [deleteNicheDialog, setDeleteNicheDialog] = useState<CalendarEntry | null>(null);

  // Edit calendar dialog state
  const [editCalendarOpen, setEditCalendarOpen] = useState(false);

  // Mobile menu and settings state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [mobileSettingsTab, setMobileSettingsTab] = useState<string | null>(null);

  // Inline post edit state
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostContent, setEditPostContent] = useState("");
  const [savingPost, setSavingPost] = useState(false);

  // Delete post dialog state
  const [deletePostDialog, setDeletePostDialog] = useState<{ date: string; content: string; nicheTag?: string; calendarId: string; originalIndex: number } | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);

  // Create post for empty day dialog state
  const [createPostDate, setCreatePostDate] = useState<string | null>(null);
  const [createPostContent, setCreatePostContent] = useState("");
  const [createPostPrompt, setCreatePostPrompt] = useState("");
  const [createPostCalendarId, setCreatePostCalendarId] = useState<string>("");
  const [createPostGenerating, setCreatePostGenerating] = useState(false);
  const [createPostSaving, setCreatePostSaving] = useState(false);
  const [createPostSource, setCreatePostSource] = useState<"ai" | "manual">("manual");

  useEffect(() => {
    const pendingGenData = sessionStorage.getItem("pendingGenerateData") || localStorage.getItem("pendingGenerateData");
    if (pendingGenData) {
      try {
        const parsed = JSON.parse(pendingGenData);
        if (parsed?.posts?.length || parsed?.niche) {
          navigate("/generate", { state: parsed });
          return;
        }
      } catch {
        navigate("/generate");
        return;
      }
    }

    fetchCalendars();
  }, [user]);

  const fetchCalendars = async () => {
    if (!user) return;
    let dbCals: CalendarEntry[] = [];
    try {
      const { data } = await supabase
        .from("calendars")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) dbCals = data as any;
    } catch (e) {
      console.warn("Error loading DB calendars:", e);
    }

    try {
      await syncServerCalendars(user.id);
    } catch {
      // Non-blocking sync fallback
    }

    const localCals = getLocalCalendars(user.id);

    const combined: CalendarEntry[] = [];
    const seenIds = new Set<string>();
    const seenSignatures = new Set<string>();

    const getSignature = (c: CalendarEntry) => {
      const nicheStr = (c.niche || "").trim().toLowerCase();
      const startDateStr = (c.start_date || "").trim();
      const posts = Array.isArray(c.posts) ? c.posts : [];
      const firstPost = posts[0] ? (posts[0].date || "") + "_" + (posts[0].content || "").substring(0, 20) : "";
      return `${c.user_id || user.id}_${nicheStr}_${startDateStr}_${posts.length}_${firstPost}`;
    };

    // 1. Process DB calendars first (authoritative)
    dbCals.forEach((c) => {
      if (!c.id) return;
      const sig = getSignature(c);
      if (!seenIds.has(c.id) && !seenSignatures.has(sig)) {
        seenIds.add(c.id);
        seenSignatures.add(sig);
        combined.push(c);
      }
    });

    // 2. Process local calendars (deduplicate against DB & other local)
    const localCalsToRemove: string[] = [];
    localCals.forEach((c) => {
      if (!c.id) return;
      const sig = getSignature(c);
      if (seenIds.has(c.id) || seenSignatures.has(sig)) {
        localCalsToRemove.push(c.id);
      } else {
        seenIds.add(c.id);
        seenSignatures.add(sig);
        combined.push(c);
      }
    });

    // Clean up local duplicates from localStorage
    localCalsToRemove.forEach((idToRemove) => {
      deleteLocalCalendar(user.id, idToRemove);
    });

    combined.sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    setCalendars(combined);
    setSelectedCalendar((prev) => {
      if (prev && combined.some((c) => c.id === prev.id)) {
        return combined.find((c) => c.id === prev.id) || prev;
      }
      return combined.length > 0 ? combined[0] : null;
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const getPostsForDate = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const allPosts: PostEntry[] = [];
    calendars.forEach((cal) => {
      if (cal.frozen) return;
      (cal.posts || []).filter((p) => p.date === dateStr).forEach((p) => {
        allPosts.push({ ...p, niche: p.niche || cal.niche });
      });
    });
    return allPosts;
  };

  const getPostsForDateStr = (dateStr: string) => {
    const allPosts: (PostEntry & { calendarId: string; originalIndex: number })[] = [];
    calendars.forEach((cal) => {
      (cal.posts || []).forEach((p, idx) => {
        if (p.date === dateStr) {
          allPosts.push({ ...p, niche: p.niche || cal.niche, calendarId: cal.id, originalIndex: idx });
        }
      });
    });
    return allPosts;
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard!");
  };

  const shareToLinkedIn = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // ignore
    }
    const shareUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(content)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
    toast.success("Post copied to clipboard! Opening LinkedIn share composer...");
  };

  const { firstDay, daysInMonth } = getDaysInMonth(currentMonth);
  const monthStr = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const meta = user?.user_metadata || {};
  const cachedProfileRaw = user ? localStorage.getItem(`dailygap_profile_${user.id}`) : null;
  let cachedProfile: any = {};
  if (cachedProfileRaw) {
    try {
      cachedProfile = JSON.parse(cachedProfileRaw);
    } catch {
      cachedProfile = {};
    }
  }

  const username =
    meta.username ||
    cachedProfile.username ||
    meta.full_name ||
    user?.email?.split("@")[0] ||
    "User";

  const email = user?.email || "";
  const avatarUrl = meta.avatar_url || cachedProfile.avatar_url || "";

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : email
    ? email.slice(0, 2).toUpperCase()
    : "DG";

  const isSuperAdmin = user?.email === "ebenezeraledu@gmail.com";

  const handleSelectSearchPost = (calendar: CalendarEntry, post: PostEntry, dateStr: string) => {
    setSelectedCalendar(calendar);
    if (dateStr) {
      const d = new Date(dateStr + "T00:00:00");
      if (!isNaN(d.getTime())) {
        setCurrentMonth(d);
      }
    }
    if (calendar.frozen) {
      calendar.frozen = false;
      setCalendars((prev) =>
        prev.map((c) => (c.id === calendar.id ? { ...c, frozen: false } : c))
      );
    }
    const dayPosts = getPostsForDateStr(dateStr);
    let targetIdx = dayPosts.findIndex(
      (p) => p.calendarId === calendar.id && p.content === post.content
    );
    if (targetIdx === -1) {
      targetIdx = dayPosts.findIndex((p) => p.calendarId === calendar.id);
    }
    if (targetIdx === -1) {
      targetIdx = 0;
    }
    setExpandedPost({ date: dateStr, index: targetIdx >= 0 ? targetIdx : 0 });
  };

  // Clear all calendars
  const handleClearAll = async () => {
    setClearLoading(true);
    try {
      if (user?.id) {
        await supabase.from("calendars").delete().eq("user_id", user.id).catch(() => {});
        clearLocalCalendars(user.id);
      }

      setCalendars([]);
      setSelectedCalendar(null);
      setShowClearDialog(false);
      setClearPassword("");
      toast.success("All calendars cleared");
      sendNotification("Calendars Cleared", "All content calendars and posts have been cleared.", "alert");
    } catch {
      toast.error("Something went wrong");
    }
    setClearLoading(false);
  };

  // Niche actions
  const handleRenameNiche = async () => {
    if (!editNicheDialog || !editNicheValue.trim()) return;
    setEditLoading(true);
    const newName = editNicheValue.trim();
    const updatedPosts = (editNicheDialog.posts || []).map((p) => ({ ...p, niche: newName }));
    
    await supabase
      .from("calendars")
      .update({ niche: newName, posts: updatedPosts as any })
      .eq("id", editNicheDialog.id);

    if (user?.id) {
      updateLocalCalendar(user.id, editNicheDialog.id, { niche: newName, posts: updatedPosts });
    }

    setEditLoading(false);
    toast.success("Niche updated");
    setEditNicheDialog(null);
    fetchCalendars();
  };

  const handleExtendNiche = async () => {
    if (!editNicheDialog) return;
    if (isAiRestricted) {
      toast.error("Your account has been restricted from using AI features by an Administrator. You can still manually create, schedule, edit, and publish posts.");
      return;
    }
    const days = Math.max(1, Math.min(30, extendDays));
    const existing = editNicheDialog.posts || [];
    const lastDate = existing.length
      ? existing.map((p) => p.date).sort().slice(-1)[0]
      : editNicheDialog.start_date;
    const next = new Date(lastDate + "T00:00:00");
    next.setDate(next.getDate() + 1);
    const newStart = next.toISOString().split("T")[0];
    setEditLoading(true);
    try {
      const hashtagsEnabled = await getHashtagsEnabled(user?.id);
      const priorPosts = (existing || []).slice(-8).map((p: any) => p.content).filter(Boolean);
      let postsData: any[] = [];

      try {
        const { data, error } = await supabase.functions.invoke("generate-posts", {
          body: { niche: editNicheDialog.niche, samples: [], numDays: days, startDate: newStart, hashtagsEnabled, priorPosts },
        });
        if (!error && data?.posts) {
          postsData = data.posts;
        }
      } catch (edgeErr) {
        console.warn("Supabase edge function notice, falling back to server API:", edgeErr);
      }

      if (!postsData || postsData.length === 0) {
        const resp = await fetch("/api/generate-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ niche: editNicheDialog.niche, samples: [], numDays: days, startDate: newStart, hashtagsEnabled }),
        });
        const data = await resp.json().catch(() => ({}));
        if (data?.posts) {
          postsData = data.posts;
        }
      }

      const tagged = (postsData || []).map((p: any) => ({ ...p, niche: editNicheDialog.niche }));
      const merged = [...existing, ...tagged];
      const { error: upErr } = await supabase
        .from("calendars")
        .update({ posts: merged as any })
        .eq("id", editNicheDialog.id);
      if (upErr) throw upErr;
      toast.success(`Added ${tagged.length} more posts`);
      sendNotification("Calendar Extended", `Added ${tagged.length} posts to "${editNicheDialog.niche}"`, "success");
      if (user?.id) {
        void recordAiUsage(user.id, tagged.length);
      }
      setEditNicheDialog(null);
      fetchCalendars();
    } catch (e: any) {
      handleAiError(e, "Failed to extend");
    }
    setEditLoading(false);
  };

  const handleRegenerateNiche = async () => {
    if (!editNicheDialog) return;
    if (isAiRestricted) {
      toast.error("Your account has been restricted from using AI features by an Administrator. You can still manually create, schedule, edit, and publish posts.");
      return;
    }
    const existing = editNicheDialog.posts || [];
    let startDate: string;
    let numDays: number;
    if (regenMode === "keep") {
      const dates = existing.map((p) => p.date).sort();
      startDate = dates[0] || editNicheDialog.start_date;
      numDays = Math.max(1, dates.length || 1);
    } else {
      startDate = regenStartDate || editNicheDialog.start_date;
      numDays = Math.max(1, Math.min(30, regenNumDays));
    }
    setEditLoading(true);
    try {
      const hashtagsEnabled = await getHashtagsEnabled(user?.id);
      const priorPosts = (existing || []).slice(-8).map((p: any) => p.content).filter(Boolean);
      let postsData: any[] = [];

      try {
        const { data, error } = await supabase.functions.invoke("generate-posts", {
          body: { niche: editNicheDialog.niche, samples: [], numDays, startDate, hashtagsEnabled, priorPosts },
        });
        if (!error && data?.posts) {
          postsData = data.posts;
        }
      } catch (edgeErr) {
        console.warn("Supabase edge function notice, using server API fallback:", edgeErr);
      }

      if (!postsData || postsData.length === 0) {
        const resp = await fetch("/api/generate-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ niche: editNicheDialog.niche, samples: [], numDays, startDate, hashtagsEnabled }),
        });
        const data = await resp.json().catch(() => ({}));
        if (data?.posts) {
          postsData = data.posts;
        }
      }

      const tagged = (postsData || []).map((p: any) => ({ ...p, niche: editNicheDialog.niche }));
      const { error: upErr } = await supabase
        .from("calendars")
        .update({ posts: tagged as any, start_date: startDate })
        .eq("id", editNicheDialog.id);
      if (upErr) throw upErr;
      toast.success("Calendar regenerated");
      sendNotification("Calendar Regenerated", `Regenerated calendar "${editNicheDialog.niche}"`, "ai");
      if (user?.id) {
        void recordAiUsage(user.id, tagged.length);
      }
      setEditNicheDialog(null);
      fetchCalendars();
    } catch (e: any) {
      handleAiError(e, "Failed to regenerate");
    }
    setEditLoading(false);
  };

  const handleDeleteNiche = async () => {
    if (!deleteNicheDialog) return;
    await supabase
      .from("calendars")
      .delete()
      .eq("id", deleteNicheDialog.id);
    if (user?.id) deleteLocalCalendar(user.id, deleteNicheDialog.id);
    if (selectedCalendar?.id === deleteNicheDialog.id) setSelectedCalendar(null);
    toast.success("Calendar deleted");
    setDeleteNicheDialog(null);
    fetchCalendars();
  };

  const handleShareNiche = async (cal: CalendarEntry) => {
    const shareText = `Check out my ${cal.niche} content calendar with ${cal.posts.length} posts!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${cal.niche} Calendar`, text: shareText });
      } catch { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success("Share text copied to clipboard!");
    }
  };

  const handleFreezeNiche = async (cal: CalendarEntry) => {
    const newFrozen = !cal.frozen;
    await supabase
      .from("calendars")
      .update({ frozen: newFrozen } as any)
      .eq("id", cal.id);
    if (user?.id) updateLocalCalendar(user.id, cal.id, { frozen: newFrozen });
    toast.success(newFrozen ? "Calendar frozen — posts hidden" : "Calendar unfrozen — posts visible");
    fetchCalendars();
  };

  // Save edited post content for a specific date+niche+index
  const handleSavePostEdit = async (date: string, nicheTag: string | undefined, originalContent: string, newContent: string) => {
    // Find the calendar that contains this post
    const targetCal = calendars.find((cal) =>
      (cal.posts || []).some((p) => p.date === date && p.content === originalContent && (p.niche || cal.niche) === (nicheTag || cal.niche))
    );
    if (!targetCal) { toast.error("Could not locate post"); return; }
    setSavingPost(true);
    let replaced = false;
    const updatedPosts = (targetCal.posts || []).map((p) => {
      if (!replaced && p.date === date && p.content === originalContent && (p.niche || targetCal.niche) === (nicheTag || targetCal.niche)) {
        replaced = true;
        return { ...p, content: newContent, edited: true };
      }
      return p;
    });
    await supabase
      .from("calendars")
      .update({ posts: updatedPosts as any })
      .eq("id", targetCal.id);
    if (user?.id) updateLocalCalendar(user.id, targetCal.id, { posts: updatedPosts });
    setSavingPost(false);
    toast.success("Post updated");
    setIsEditingPost(false);
    await fetchCalendars();
  };

  // Delete a post from its calendar
  const handleDeletePost = async () => {
    if (!deletePostDialog) return;
    const { calendarId, originalIndex } = deletePostDialog;
    const targetCal = calendars.find((cal) => cal.id === calendarId);
    if (!targetCal) { toast.error("Could not locate post"); return; }
    setDeletingPost(true);
    const updatedPosts = (targetCal.posts || []).filter((_, idx) => idx !== originalIndex);
    await supabase
      .from("calendars")
      .update({ posts: updatedPosts as any })
      .eq("id", targetCal.id);
    if (user?.id) updateLocalCalendar(user.id, targetCal.id, { posts: updatedPosts });
    setDeletingPost(false);
    toast.success("Post deleted");
    setDeletePostDialog(null);
    setExpandedPost(null);
    await fetchCalendars();
  };

  // Open create-post dialog for an empty day
  const openCreatePostForDate = (dateStr: string) => {
    const activeCals = calendars.filter((c) => !c.frozen);
    if (activeCals.length === 0) {
      toast.error("Create a calendar first to add posts");
      return;
    }
    const defaultCalId = selectedCalendar && !selectedCalendar.frozen ? selectedCalendar.id : activeCals[0].id;
    setCreatePostDate(dateStr);
    setCreatePostContent("");
    setCreatePostPrompt("");
    setCreatePostSource("manual");
    setCreatePostCalendarId(defaultCalId);
  };

  const handleGeneratePostForDate = async () => {
    if (isAiRestricted) {
      toast.error("Your account has been restricted from using AI features by an Administrator. You can still manually create, schedule, edit, and publish posts.");
      return;
    }
    if (!createPostPrompt.trim()) { toast.error("Tell the AI what to write about"); return; }
    const cal = calendars.find((c) => c.id === createPostCalendarId);
    setCreatePostGenerating(true);
    try {
      const hashtagsEnabled = await getHashtagsEnabled(user?.id);
      const priorPosts = (cal?.posts || []).slice(-8).map((p: any) => p.content).filter(Boolean);
      const { data, error } = await supabase.functions.invoke("generate-single-post", {
        body: { prompt: createPostPrompt.trim(), niche: cal?.niche || "", hashtagsEnabled, priorPosts },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCreatePostContent(data.content || "");
      setCreatePostSource("ai");
      toast.success("Draft generated");
    } catch (e: any) {
      handleAiError(e, "Failed to generate");
    }
    setCreatePostGenerating(false);
  };

  const handleSaveCreatedPost = async () => {
    if (!createPostDate || !createPostContent.trim() || !createPostCalendarId) return;
    const targetCal = calendars.find((c) => c.id === createPostCalendarId);
    if (!targetCal) { toast.error("Calendar not found"); return; }
    setCreatePostSaving(true);
    const newPost = { date: createPostDate, content: createPostContent.trim(), niche: targetCal.niche, source: createPostSource };
    const updatedPosts = [...(targetCal.posts || []), newPost];
    await supabase
      .from("calendars")
      .update({ posts: updatedPosts as any })
      .eq("id", targetCal.id);
    if (user?.id) updateLocalCalendar(user.id, targetCal.id, { posts: updatedPosts });
    setCreatePostSaving(false);
    toast.success("Post added to calendar");
    setCreatePostDate(null);
    await fetchCalendars();
  };

  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();

  return (
    <div className="min-h-screen bg-background">
      {calendars.length > 0 && (
        <OnboardingTour
          storageKey="dailygap.onboarding.dashboard.v1"
          steps={[
            {
              target: "calendars-sidebar",
              title: "Your calendars",
              description: "All the content calendars you generate live here. Click one to open it, or use the menu on each to edit, share, freeze or delete.",
              placement: "right",
            },
            {
              target: "calendar-grid",
              title: "Your posts, by day",
              description: "Every day shows the post scheduled for it. Click a day to preview, edit or generate a new post for that date.",
              placement: "left",
            },
            {
              target: "linkedin-connect",
              title: "Connect & automate",
              description: "Link your LinkedIn to auto-publish posts on schedule, enable auto-comments, and toggle hashtags on generated posts.",
              placement: "left",
            },
          ]}
        />
      )}
      <SEO
        title="Your content calendar dashboard | Daily Gap"
        description="Manage your AI-generated LinkedIn calendars, edit posts, schedule auto-publishing, and customize your content from the Daily Gap dashboard."
        path="/dashboard"
        noIndex
      />
      <h1 className="sr-only">Your content calendar dashboard</h1>
      <div className="relative z-50 max-w-6xl mx-auto px-6 pt-4 pb-2">
        <header
          className="relative z-50 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 rounded-2xl border border-border/40 backdrop-blur-md shadow-xs transition-all"
          style={{ backgroundColor: "rgba(128, 128, 128, 0.05)" }}
        >
          {/* MOBILE NAV BAR (< md) */}
          <div className="flex md:hidden items-center justify-between w-full">
            {/* Left: Profile Picture with online indicator */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="group relative flex items-center gap-2 focus:outline-none active:scale-95 transition-transform"
              aria-label="Open user profile menu"
            >
              <div className="relative">
                <Avatar className="h-9 w-9 border border-rose-200/80 dark:border-rose-900/60 shadow-2xs">
                  <AvatarImage src={avatarUrl} alt={username} />
                  <AvatarFallback className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
              </div>
            </button>

            {/* Right: Notification Center & Hamburger Menu Icon */}
            <div className="flex items-center gap-1.5">
              <NotificationCenter userId={user?.id} />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-full hover:bg-muted/60 text-foreground h-9 w-9"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* DESKTOP NAV BAR (>= md) */}
          <div className="hidden md:flex items-center justify-between w-full gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Logo className="h-7 w-7" />
            </div>

            {/* Search Bar in Top Nav Bar */}
            <div className="flex-1 max-w-xs sm:max-w-md mx-2">
              <SearchBar calendars={calendars} onSelectPost={handleSelectSearchPost} />
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Notification Icon */}
              <NotificationCenter userId={user?.id} />

              <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full" aria-label="Toggle color theme">
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>

              {isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin")}
                  className="gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10 hidden md:inline-flex"
                >
                  <ShieldCheck className="h-4 w-4" /> Super Admin
                </Button>
              )}

              {/* New Calendar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="hero" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Calendar</span>
                    <ChevronDown className="h-3 w-3 sm:ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/generate")}>
                    <Plus className="h-4 w-4 mr-2" /> Create New Calendar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowClearDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Clear All Calendars
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <ProfileAvatarMenu
                calendarId={selectedCalendar?.id || null}
                calendarNiche={selectedCalendar?.niche || null}
                onOpenEditCalendar={() => setEditCalendarOpen(true)}
              />
            </div>
          </div>
        </header>
      </div>

      <main className="max-w-6xl mx-auto px-6 pb-20">
        {calendars.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">No calendars yet</h2>
            <p className="text-muted-foreground mb-6">Generate your first content calendar</p>
            <Button variant="hero" onClick={() => navigate("/generate")}>Get Started</Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar with 0.05 opacity light grey background */}
            <div
              className="lg:col-span-1 space-y-3 p-4 rounded-2xl border border-border/40 transition-all"
              style={{ backgroundColor: "rgba(128, 128, 128, 0.05)" }}
              data-tour="calendars-sidebar"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Calendars</h3>
                <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                  {calendars.length}
                </span>
              </div>

              {/* Compressed Scrollable Calendar List */}
              <div className="max-h-64 overflow-y-auto pr-1 space-y-1.5">
                {calendars.map((cal) => (
                  <div
                    key={cal.id}
                    className={`w-full text-left glass rounded-lg px-3 py-2 transition-all flex items-center justify-between gap-2 border ${
                      selectedCalendar?.id === cal.id
                        ? "border-primary/50 bg-primary/10 shadow-sm ring-1 ring-primary/30"
                        : "border-border/40 hover:bg-card/90"
                    }`}
                  >
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => {
                        setSelectedCalendar(cal);
                        if (cal.posts.length > 0) {
                          setCurrentMonth(new Date(cal.start_date));
                        }
                      }}
                    >
                      <div className={`font-semibold text-xs truncate ${cal.frozen ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {cal.niche}
                      </div>
                      <div className="text-muted-foreground text-[10px] truncate mt-0.5">
                        {cal.posts.length} posts • {new Date(cal.created_at).toLocaleDateString()}
                        {cal.frozen && <span className="ml-1 text-primary/60">(Frozen)</span>}
                      </div>
                    </button>

                    {/* Niche more menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground" aria-label="Calendar actions">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => {
                          setEditNicheValue(cal.niche);
                          setEditTab("rename");
                          setExtendDays(7);
                          setRegenMode("keep");
                          setRegenStartDate(cal.start_date);
                          setRegenNumDays(Math.max(1, (cal.posts || []).length || 10));
                          setEditNicheDialog(cal);
                        }}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteNicheDialog(cal)} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShareNiche(cal)}>
                          <Share2 className="h-4 w-4 mr-2" /> Share
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleFreezeNiche(cal)}>
                          <Snowflake className="h-4 w-4 mr-2" /> {cal.frozen ? "Unfreeze" : "Freeze"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>

              {user && <ImageGallery userId={user.id} />}

              {user && (
                <div data-tour="linkedin-connect">
                  <LinkedInConnect
                    userId={user.id}
                    calendarId={selectedCalendar?.id || null}
                    calendarNiche={selectedCalendar?.niche || null}
                  />
                </div>
              )}
            </div>

            {/* Calendar grid */}
            <div className="lg:col-span-3" data-tour="calendar-grid">
              <div className="glass rounded-2xl p-6 relative overflow-hidden" style={{ fontFamily: calendarFont }}>
                {templateBg?.image && (
                  <div
                    className="absolute inset-0 pointer-events-none z-0"
                    style={{
                      backgroundImage: `url(${templateBg.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      opacity: templateBg.opacity,
                    }}
                  />
                )}
                <div className="flex items-center justify-between mb-6">
                  <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <h2 className="font-display text-xl font-bold text-foreground">{monthStr}</h2>
                  <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const posts = getPostsForDate(day);
                    const hasPost = posts.length > 0;
                    const isToday = dateStr === todayStr;
                    return (
                      <button
                        key={day}
                        onClick={() => hasPost
                          ? setExpandedPost({ date: dateStr, index: 0 })
                          : openCreatePostForDate(dateStr)}
                        className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all relative hover:scale-105 cursor-pointer ${
                          !hasPost ? "text-muted-foreground hover:bg-card/60" : ""
                        } ${isToday ? "ring-2 ring-primary ring-offset-1 ring-offset-background font-bold" : ""}`}
                        style={hasPost ? { backgroundColor: calendarColor + "20", color: calendarColor } : {}}
                        aria-label={hasPost ? `View posts for ${dateStr}` : `Create post for ${dateStr}`}
                      >
                        <span className={`text-xs ${isToday ? "font-bold" : "font-medium"}`}>{day}</span>
                        {hasPost && (
                          <span className="flex gap-0.5 mt-0.5">
                            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: calendarColor }} />
                            {posts.length > 1 && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: calendarColor }} />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <DecorationOverlay
                  editMode={decor.editMode}
                  decorations={decor.decorations}
                  selectedId={decor.selectedId}
                  setSelectedId={decor.setSelectedId}
                  containerRef={decor.containerRef}
                  onDrop={decor.onDrop}
                  startDrag={decor.startDrag}
                  startResize={decor.startResize}
                  handleDelete={decor.handleDelete}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Expanded post modal */}
      <AnimatePresence>
        {expandedPost && (() => {
          const dayPosts = getPostsForDateStr(expandedPost.date);
          const currentIdx = expandedPost.index;
          const currentPost = dayPosts[currentIdx];
          if (!currentPost) return null;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
              onClick={() => setExpandedPost(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass rounded-2xl p-8 max-w-lg w-full glow-border"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-primary">
                      {new Date(expandedPost.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </span>
                    {currentPost.niche && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {currentPost.niche}
                      </span>
                    )}
                    {dayPosts.length > 1 && (
                      <span className="text-xs text-muted-foreground font-medium">
                        {currentIdx + 1}/{dayPosts.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!isEditingPost && (
                      <>
                        <Button
                          variant="hero"
                          size="sm"
                          onClick={() => shareToLinkedIn(currentPost.content)}
                          className="h-8 px-2.5 text-xs gap-1.5 font-medium"
                          title="Share to LinkedIn"
                        >
                          <Linkedin className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Share on LinkedIn</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(currentPost.content)} title="Copy" aria-label="Copy post content">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditPostContent(currentPost.content); setIsEditingPost(true); }}
                          title="Edit"
                          aria-label="Edit post"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletePostDialog({ date: expandedPost.date, content: currentPost.content, nicheTag: currentPost.niche, calendarId: currentPost.calendarId, originalIndex: currentPost.originalIndex })}
                          title="Delete"
                          aria-label="Delete post"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" aria-label="Close post" onClick={() => { setIsEditingPost(false); setExpandedPost(null); }}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                {isEditingPost ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editPostContent}
                      onChange={(e) => setEditPostContent(e.target.value)}
                      className="min-h-[220px] leading-relaxed"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingPost(false)} disabled={savingPost}>
                        Cancel
                      </Button>
                      <Button
                        variant="hero"
                        size="sm"
                        disabled={savingPost || !editPostContent.trim() || editPostContent === currentPost.content}
                        onClick={() => handleSavePostEdit(expandedPost.date, currentPost.niche, currentPost.content, editPostContent.trim())}
                      >
                        <Check className="h-4 w-4 mr-1" /> {savingPost ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto pr-2">
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">{currentPost.content}</p>
                  </div>
                )}
                {dayPosts.length > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={currentIdx === 0}
                      onClick={() => setExpandedPost({ ...expandedPost, index: currentIdx - 1 })}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                    </Button>
                    <span className="text-xs text-muted-foreground">{currentIdx + 1} of {dayPosts.length}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={currentIdx === dayPosts.length - 1}
                      onClick={() => setExpandedPost({ ...expandedPost, index: currentIdx + 1 })}
                    >
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Clear all calendars dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Calendars</DialogTitle>
            <DialogDescription>
              This will permanently delete all your saved content calendars and posts. Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowClearDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClearAll} disabled={clearLoading}>
              {clearLoading ? "Clearing..." : "Clear Everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create post for empty day dialog */}
      <Dialog open={!!createPostDate} onOpenChange={(open) => !open && setCreatePostDate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Create post for {createPostDate ? new Date(createPostDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : ""}
            </DialogTitle>
            <DialogDescription>
              Write a post for this day, or let AI draft one for you. It'll be scheduled like any other post.
            </DialogDescription>
          </DialogHeader>

          {calendars.filter((c) => !c.frozen).length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Add to calendar</label>
              <select
                value={createPostCalendarId}
                onChange={(e) => setCreatePostCalendarId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {calendars.filter((c) => !c.frozen).map((c) => (
                  <option key={c.id} value={c.id}>{c.niche}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">What do you want to write on?</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. lessons from my first launch"
                value={createPostPrompt}
                onChange={(e) => setCreatePostPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !createPostGenerating && handleGeneratePostForDate()}
              />
              <Button
                variant="hero"
                onClick={handleGeneratePostForDate}
                disabled={createPostGenerating || !createPostPrompt.trim()}
                className="gap-1 shrink-0"
              >
                <Wand2 className="h-4 w-4" />
                {createPostGenerating ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Your post</label>
            <Textarea
              value={createPostContent}
              onChange={(e) => setCreatePostContent(e.target.value)}
              placeholder="Write your post here, or generate one above..."
              className="min-h-[200px] leading-relaxed"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreatePostDate(null)}>Cancel</Button>
            <Button
              variant="hero"
              onClick={handleSaveCreatedPost}
              disabled={createPostSaving || !createPostContent.trim()}
            >
              {createPostSaving ? "Saving..." : "Save post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete post dialog */}
      <Dialog open={!!deletePostDialog} onOpenChange={(open) => !open && setDeletePostDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              This will permanently remove this post from your calendar. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletePostDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePost} disabled={deletingPost}>
              {deletingPost ? "Deleting..." : "Delete Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit niche dialog */}
      <Dialog open={!!editNicheDialog} onOpenChange={(open) => !open && setEditNicheDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit "{editNicheDialog?.niche}"</DialogTitle>
            <DialogDescription>
              Rename the niche, extend it with more days, or regenerate the posts.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={editTab} onValueChange={(v) => setEditTab(v as any)} className="mt-2">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="rename">Rename</TabsTrigger>
              <TabsTrigger value="extend">Extend</TabsTrigger>
              <TabsTrigger value="regenerate">Regenerate</TabsTrigger>
            </TabsList>

            <TabsContent value="rename" className="mt-4 space-y-3">
              <label className="text-sm text-muted-foreground">Niche name</label>
              <Input
                value={editNicheValue}
                onChange={(e) => setEditNicheValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRenameNiche()}
                placeholder="Enter new niche name"
              />
              <DialogFooter className="pt-2">
                <Button variant="ghost" onClick={() => setEditNicheDialog(null)}>Cancel</Button>
                <Button onClick={handleRenameNiche} disabled={editLoading}>
                  {editLoading ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="extend" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Generate additional posts starting the day after the last existing post. Existing posts are kept.
              </p>
              <label className="text-sm text-muted-foreground">Number of extra days (1–30)</label>
              <Input
                type="number"
                min={1}
                max={30}
                value={extendDays}
                onChange={(e) => setExtendDays(parseInt(e.target.value) || 1)}
              />
              <DialogFooter className="pt-2">
                <Button variant="ghost" onClick={() => setEditNicheDialog(null)}>Cancel</Button>
                <Button variant="hero" onClick={handleExtendNiche} disabled={editLoading}>
                  {editLoading ? "Generating..." : `Add ${extendDays} day${extendDays > 1 ? "s" : ""}`}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="regenerate" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Replace all posts in this calendar with newly generated ones.
              </p>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-border hover:bg-card/60">
                  <input
                    type="radio"
                    name="regenMode"
                    checked={regenMode === "keep"}
                    onChange={() => setRegenMode("keep")}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">Keep current dates & duration</div>
                    <div className="text-xs text-muted-foreground">
                      Same start date and same number of posts as before.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-border hover:bg-card/60">
                  <input
                    type="radio"
                    name="regenMode"
                    checked={regenMode === "new"}
                    onChange={() => setRegenMode("new")}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">Use a new start date & duration</div>
                    {regenMode === "new" && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Start date</label>
                          <Input
                            type="date"
                            value={regenStartDate}
                            onChange={(e) => setRegenStartDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Days (1–30)</label>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={regenNumDays}
                            onChange={(e) => setRegenNumDays(parseInt(e.target.value) || 1)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>
              <DialogFooter className="pt-2">
                <Button variant="ghost" onClick={() => setEditNicheDialog(null)}>Cancel</Button>
                <Button variant="hero" onClick={handleRegenerateNiche} disabled={editLoading}>
                  {editLoading ? "Regenerating..." : "Regenerate"}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete niche dialog */}
      <Dialog open={!!deleteNicheDialog} onOpenChange={(open) => !open && setDeleteNicheDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Calendar</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteNicheDialog?.niche}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteNicheDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteNiche}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Calendar dialog */}
      <Dialog open={editCalendarOpen} onOpenChange={setEditCalendarOpen}>
        <DialogContent className="w-[calc(100vw-24px)] sm:max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 rounded-2xl">
          <DialogHeader className="text-left space-y-1 pr-8 sm:pr-10">
            <DialogTitle className="text-base sm:text-xl font-bold text-foreground break-words">Edit Calendar</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground break-words">
              Customize your calendar's look and feel. Pick a template, tweak the colors, change the font, or add illustrations.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="templates" className="mt-2">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto p-1 gap-1 bg-muted/60 rounded-xl">
              <TabsTrigger value="templates" className="text-xs sm:text-sm py-2 rounded-lg data-[state=active]:shadow-xs">Templates</TabsTrigger>
              <TabsTrigger value="color" className="text-xs sm:text-sm py-2 rounded-lg data-[state=active]:shadow-xs">Color</TabsTrigger>
              <TabsTrigger value="font" className="text-xs sm:text-sm py-2 rounded-lg data-[state=active]:shadow-xs">Font</TabsTrigger>
              <TabsTrigger value="illustrations" className="text-xs sm:text-sm py-2 rounded-lg data-[state=active]:shadow-xs">Illustrations</TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="mt-4 focus-visible:outline-none">
              <CalendarTemplates
                selectedTemplate={selectedTemplateId}
                onSelectTemplate={(t: CalendarTemplate) => {
                  setSelectedTemplateId(t.id);
                  setCalendarColor(t.color);
                  setCalendarFont(t.font);
                  setTemplateBg(t.bgImage ? { image: t.bgImage, opacity: t.bgOpacity } : null);
                }}
              />
            </TabsContent>

            <TabsContent value="color" className="mt-4 focus-visible:outline-none">
              <CalendarCustomizer
                calendarColor={calendarColor}
                setCalendarColor={setCalendarColor}
                calendarFont={calendarFont}
                setCalendarFont={setCalendarFont}
              />
            </TabsContent>

            <TabsContent value="font" className="mt-4 focus-visible:outline-none">
              <CalendarCustomizer
                calendarColor={calendarColor}
                setCalendarColor={setCalendarColor}
                calendarFont={calendarFont}
                setCalendarFont={setCalendarFont}
              />
            </TabsContent>

            <TabsContent value="illustrations" className="mt-4 space-y-3 focus-visible:outline-none">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Upload illustrations and drag them onto your calendar to make it your own.
              </p>
              <DecorationToolbar
                editMode={decor.editMode}
                setEditMode={decor.setEditMode}
                setSelectedId={decor.setSelectedId}
                fileInputRef={decor.fileInputRef}
                handleUpload={decor.handleUpload}
              />
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-3 sm:pt-4 border-t border-border mt-4">
            <Button variant="ghost" className="w-full sm:w-auto h-10" onClick={() => setEditCalendarOpen(false)}>Cancel</Button>
            <Button
              variant="hero"
              className="w-full sm:w-auto h-10 font-medium"
              onClick={() => {
                setEditCalendarOpen(false);
                toast.success("Calendar updated");
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Hamburger Menu Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="right"
          className="w-[88vw] max-w-sm p-0 flex flex-col justify-between border-l border-border bg-card text-card-foreground shadow-2xl z-[250]"
        >
          <div className="flex flex-col flex-1 overflow-y-auto">
            {/* Header / User Profile */}
            <div className="p-5 border-b border-border bg-muted/40 text-left">
              <div className="flex items-center gap-3 pr-8">
                <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-xs shrink-0">
                  <AvatarImage src={avatarUrl} alt={username} />
                  <AvatarFallback className="bg-primary/15 text-primary font-bold text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {username}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {email}
                  </div>
                  {isSuperAdmin && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                      <ShieldCheck className="h-3 w-3" /> Super Admin
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Content & Actions */}
            <div className="p-5 space-y-5">
              {/* Search Bar in Mobile Menu */}
              <div>
                <SearchBar
                  calendars={calendars}
                  onSelectPost={(calendar, post, dateStr) => {
                    handleSelectSearchPost(calendar, post, dateStr);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full"
                />
              </div>

              {/* Navigation Menu List */}
              <div className="space-y-3">
                {/* Primary CTA */}
                <Button
                  type="button"
                  variant="hero"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/generate");
                  }}
                  className="w-full justify-between h-11 px-4 rounded-xl text-sm font-medium shadow-xs"
                >
                  <span className="flex items-center gap-2.5">
                    <Plus className="h-4 w-4" /> Create New Calendar
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-70" />
                </Button>

                {/* Unified Menu Stack */}
                <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40 shadow-xs">
                  {/* Settings */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSettingsOpen(true);
                      setMobileSettingsTab(null);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      <div>
                        <div className="text-sm font-medium text-foreground">Settings</div>
                        <div className="text-xs text-muted-foreground">Account & integrations</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                  </button>

                  {/* Theme Switcher */}
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {theme === "dark" ? (
                        <Moon className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Sun className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-foreground">Appearance</div>
                        <div className="text-xs text-muted-foreground">Switch light or dark mode</div>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-muted text-muted-foreground capitalize border border-border/50">
                      {theme}
                    </span>
                  </button>

                  {/* Super Admin Dashboard (if authorized) */}
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate("/admin");
                      }}
                      className="w-full flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <div>
                          <div className="text-sm font-medium text-foreground">Admin Portal</div>
                          <div className="text-xs text-muted-foreground">Management & analytics</div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                    </button>
                  )}

                  {/* Clear All Calendars */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowClearDialog(true);
                    }}
                    className="w-full flex items-center justify-between p-3.5 hover:bg-destructive/10 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <div>
                        <div className="text-sm font-medium text-destructive">Clear All Calendars</div>
                        <div className="text-xs text-muted-foreground">Remove saved calendars</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer: Logout */}
          <div className="p-4 border-t border-border bg-muted/40">
            <Button
              variant="outline"
              className="w-full justify-center gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50 transition-colors font-semibold text-sm h-11 rounded-xl"
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
            >
              <LogOut className="h-4 w-4" /> Log Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile Settings Modal */}
      <SettingsModal
        open={mobileSettingsOpen}
        onOpenChange={setMobileSettingsOpen}
        defaultTab={mobileSettingsTab}
        calendarId={selectedCalendar?.id || null}
        calendarNiche={selectedCalendar?.niche || null}
        onOpenEditCalendar={() => setEditCalendarOpen(true)}
      />
    </div>
  );
};

export default Dashboard;
