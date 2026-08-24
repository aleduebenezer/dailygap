import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  Linkedin,
  Lock,
  Bell,
  Sun,
  Moon,
  Upload,
  Camera,
  ShieldCheck,
  CheckCircle2,
  Phone,
  Mail,
  Loader2,
  Calendar as CalendarIcon,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import LinkedInConnect from "@/components/LinkedInConnect";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string | null;
  calendarId?: string | null;
  calendarNiche?: string | null;
  onOpenEditCalendar?: () => void;
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200",
];

export function SettingsModal({
  open,
  onOpenChange,
  defaultTab = null,
  calendarId = null,
  calendarNiche = null,
  onOpenEditCalendar,
}: SettingsModalProps) {
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();

  // Active Category (null = Main categories menu)
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Profile Form State
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Form State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Notification Toggles State
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    postAlerts: true,
    weeklyDigest: false,
    productUpdates: true,
  });

  // When modal opens, set to main menu or defaultTab
  useEffect(() => {
    if (open) {
      setActiveCategory(defaultTab || null);
    }
  }, [open, defaultTab]);

  // Load User Data
  useEffect(() => {
    if (!user) return;

    // Check local storage cache or metadata
    const cachedProfileRaw = localStorage.getItem(`dailygap_profile_${user.id}`);
    let cachedProfile: any = {};
    if (cachedProfileRaw) {
      try {
        cachedProfile = JSON.parse(cachedProfileRaw);
      } catch {
        cachedProfile = {};
      }
    }

    const meta = user.user_metadata || {};
    const defaultUsername =
      meta.username ||
      cachedProfile.username ||
      meta.full_name ||
      user.email?.split("@")[0] ||
      "User";

    setUsername(defaultUsername);
    setEmail(user.email || "");
    setPhone(meta.phone || cachedProfile.phone || "");
    setAvatarUrl(meta.avatar_url || cachedProfile.avatar_url || "");

    if (meta.notifications || cachedProfile.notifications) {
      setNotifications((prev) => ({
        ...prev,
        ...(meta.notifications || cachedProfile.notifications),
      }));
    }
  }, [user, open]);

  // Handle Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);

    try {
      const updatedMetadata = {
        username: username.trim(),
        avatar_url: avatarUrl,
        phone: phone.trim(),
        notifications,
      };

      // Update Supabase auth user metadata if session exists
      try {
        await supabase.auth.updateUser({
          data: updatedMetadata,
        });
      } catch (_e) {
        // Safe to ignore if running locally without active auth session
      }

      // Sync to local storage
      const profileData = {
        id: user?.id || "user_dailygap_local",
        email,
        username: username.trim(),
        avatar_url: avatarUrl,
        phone: phone.trim(),
        notifications,
        updated_at: new Date().toISOString(),
      };

      localStorage.setItem(`dailygap_profile_${user?.id || "user_dailygap_local"}`, JSON.stringify(profileData));

      // Also update all profiles list
      try {
        const rawProfs = localStorage.getItem("dailygap_all_profiles");
        let allProfs = rawProfs ? JSON.parse(rawProfs) : [];
        const uId = user?.id || "user_dailygap_local";
        const idx = allProfs.findIndex((p: any) => p.id === uId);
        if (idx >= 0) {
          allProfs[idx] = { ...allProfs[idx], ...profileData };
        } else {
          allProfs.push(profileData);
        }
        localStorage.setItem("dailygap_all_profiles", JSON.stringify(allProfs));
      } catch (e) {
        console.warn("Failed to update local profiles cache", e);
      }

      await refreshUser();
      toast.success("Profile changes saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile changes");
    } finally {
      setSavingProfile(false);
    }
  };

  // Custom Avatar File Upload handler
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be under 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
        toast.success("Photo selected! Click 'Save Profile' to apply.");
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Password Update
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success("Password changed successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Handle Notification Save
  const handleSaveNotifications = (key: keyof typeof notifications, value: boolean) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);

    if (user) {
      const cached = localStorage.getItem(`dailygap_profile_${user.id}`);
      let parsed = cached ? JSON.parse(cached) : {};
      parsed.notifications = updated;
      localStorage.setItem(`dailygap_profile_${user.id}`, JSON.stringify(parsed));

      supabase.auth.updateUser({
        data: { notifications: updated },
      });
      toast.success("Notification preference updated");
    }
  };

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : email
    ? email.slice(0, 2).toUpperCase()
    : "DG";

  const categories = [
    {
      id: "profile",
      title: "Profile & Account",
      description: "Manage your display name, profile photo, phone number, and email",
      icon: User,
    },
    {
      id: "calendar",
      title: "Calendar Customization",
      description: "Themes, typography fonts, color palettes, and layout styles",
      icon: CalendarIcon,
    },
    {
      id: "linkedin",
      title: "LinkedIn Integration",
      description: "Automated posting, profile connection, and schedule queue",
      icon: Linkedin,
    },
    {
      id: "notifications",
      title: "Notifications & Alerts",
      description: "Configure email notifications, posting updates, and digests",
      icon: Bell,
    },
    {
      id: "appearance",
      title: "Theme & Appearance",
      description: "Switch between Light and Dark interface modes",
      icon: theme === "dark" ? Moon : Sun,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-24px)] sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-0 gap-0 rounded-2xl border-border/80 bg-card text-card-foreground shadow-2xl">
        {/* HEADER */}
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/60 bg-muted/10 pr-12 sm:pr-14">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {activeCategory ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveCategory(null)}
                  className="h-8 px-2 gap-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
              ) : null}

              <div className="min-w-0 flex-1">
                <DialogTitle className="text-sm sm:text-base md:text-lg font-semibold text-foreground break-words leading-snug">
                  {activeCategory
                    ? categories.find((c) => c.id === activeCategory)?.title || "Settings"
                    : "Settings"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 break-words line-clamp-2 leading-tight">
                  {activeCategory
                    ? categories.find((c) => c.id === activeCategory)?.description
                    : "Manage your account preferences, integrations, and customization."}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* BODY */}
        <div className="p-4 sm:p-6 overflow-x-hidden">
          <AnimatePresence mode="wait">
            {/* VIEW 1: CATEGORY SELECTION MENU */}
            {!activeCategory && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.12 }}
                className="space-y-4"
              >
                {/* User quick badge */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/50">
                  <Avatar className="h-10 w-10 border border-border shrink-0">
                    <AvatarImage src={avatarUrl} alt={username} />
                    <AvatarFallback className="bg-muted text-foreground font-semibold text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{username}</div>
                    <div className="text-xs text-muted-foreground truncate">{email}</div>
                  </div>
                </div>

                {/* Unified Category List */}
                <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40 shadow-xs">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategory(cat.id)}
                        className="w-full flex items-center justify-between gap-3 px-3.5 sm:px-4 py-3 sm:py-3.5 hover:bg-muted/40 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                              {cat.title}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {cat.description}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* VIEW 2: PROFILE TAB */}
            {activeCategory === "profile" && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <form onSubmit={handleSaveProfile} className="space-y-5">
                  {/* Avatar Upload */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 p-4 rounded-xl bg-muted/30 border border-border">
                    <div className="relative group shrink-0">
                      <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-primary/20 shadow-md">
                        <AvatarImage src={avatarUrl} alt={username} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg sm:text-xl">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <label
                        htmlFor="avatar-file-input"
                        className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-medium"
                      >
                        <Camera className="h-5 w-5" />
                      </label>
                      <input
                        id="avatar-file-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                    </div>

                    <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground">Profile Picture</h4>
                      <p className="text-xs text-muted-foreground">
                        Upload your photo or choose a preset avatar below.
                      </p>

                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="gap-1 text-xs"
                          onClick={() => document.getElementById("avatar-file-input")?.click()}
                        >
                          <Upload className="h-3 w-3" /> Upload Custom Image
                        </Button>
                        {avatarUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => setAvatarUrl("")}
                          >
                            Remove Photo
                          </Button>
                        )}
                      </div>

                      {/* Presets */}
                      <div className="flex items-center justify-center sm:justify-start gap-1.5 pt-2">
                        <span className="text-[11px] text-muted-foreground mr-1">Presets:</span>
                        {PRESET_AVATARS.map((url, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setAvatarUrl(url)}
                            className={`h-7 w-7 rounded-full overflow-hidden border-2 transition-all ${
                              avatarUrl === url
                                ? "border-primary scale-110 shadow-sm ring-2 ring-primary/20"
                                : "border-transparent opacity-70 hover:opacity-100"
                            }`}
                          >
                            <img src={url} alt={`Avatar preset ${i}`} className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="username" className="text-xs font-semibold text-foreground">
                        Username / Full Name
                      </Label>
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. Ebenezer Aledu"
                        className="h-10 text-sm"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Input
                          id="email"
                          value={email}
                          disabled
                          className="h-10 text-sm pr-8 bg-muted/40 cursor-not-allowed opacity-80"
                        />
                        <Mail className="h-4 w-4 absolute right-2.5 top-3 text-muted-foreground" />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Email is verified and linked to your login account.
                      </span>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="phone" className="text-xs font-semibold text-foreground">
                        Phone Number (Optional)
                      </Label>
                      <div className="relative">
                        <Input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="h-10 text-sm pl-8"
                        />
                        <Phone className="h-3.5 w-3.5 absolute left-2.5 top-3 text-muted-foreground" />
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM ACTION BAR */}
                  <div className="pt-4 border-t border-border mt-6">
                    <Button type="submit" variant="hero" disabled={savingProfile} className="w-full gap-2 font-medium">
                      {savingProfile ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Save Profile
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* VIEW 3: CALENDAR CUSTOMIZER */}
            {activeCategory === "calendar" && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className="space-y-4 max-w-full"
              >
                <div className="rounded-xl border border-border p-3.5 sm:p-5 bg-card space-y-4 max-w-full overflow-hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-foreground break-words leading-snug">
                        {calendarNiche ? `Active Calendar: ${calendarNiche}` : "Calendar Settings"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1.5 break-words leading-relaxed">
                        Customize your content calendar's design, templates, color themes, typography fonts, or visual illustration overlays.
                      </p>
                    </div>
                    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                  </div>

                  <div className="p-3 sm:p-4 rounded-lg bg-muted/30 border border-border space-y-3 max-w-full">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <span className="text-muted-foreground font-medium">Design & Layout Options</span>
                      <span className="text-primary font-semibold">Templates • Colors • Fonts</span>
                    </div>
                    <p className="text-xs text-muted-foreground break-words leading-relaxed">
                      Switch between sleek modern themes, gradient accent palettes, custom fonts, or add drag-and-drop illustrations directly onto your calendar grid.
                    </p>
                    <Button
                      type="button"
                      variant="hero"
                      className="w-full gap-2 mt-2 whitespace-normal h-auto py-2.5 px-3 text-xs sm:text-sm font-medium text-center leading-snug"
                      onClick={() => {
                        onOpenChange(false);
                        if (onOpenEditCalendar) {
                          onOpenEditCalendar();
                        } else {
                          toast.info("Select a calendar on your dashboard to customize design");
                        }
                      }}
                    >
                      <Settings2 className="h-4 w-4 shrink-0" />
                      <span>Open Calendar Customizer (Edit Design)</span>
                    </Button>
                  </div>
                </div>

                {/* BOTTOM ACTION BAR */}
                <div className="pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="hero"
                    onClick={() => setActiveCategory(null)}
                    className="w-full gap-1.5 text-xs sm:text-sm font-medium h-10"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Done
                  </Button>
                </div>
              </motion.div>
            )}

            {/* VIEW 4: LINKEDIN CONNECT */}
            {activeCategory === "linkedin" && (
              <motion.div
                key="linkedin"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className="space-y-4 max-w-full"
              >
                <div className="rounded-xl border border-border p-3.5 sm:p-4 bg-card max-w-full overflow-hidden">
                  <LinkedInConnect
                    userId={user?.id || ""}
                    calendarId={calendarId}
                    calendarNiche={calendarNiche}
                  />
                </div>

                {/* BOTTOM ACTION BAR */}
                <div className="pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="hero"
                    onClick={() => setActiveCategory(null)}
                    className="w-full gap-1.5 text-xs sm:text-sm font-medium h-10"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Done
                  </Button>
                </div>
              </motion.div>
            )}

            {/* VIEW: NOTIFICATIONS */}
            {activeCategory === "notifications" && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className="space-y-4 max-w-full"
              >
                <div className="space-y-3 sm:space-y-4 rounded-xl border border-border p-3.5 sm:p-4 bg-card max-w-full overflow-hidden">
                  <div className="flex items-start justify-between py-2 border-b border-border gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-foreground break-words">Email Notifications</h4>
                      <p className="text-xs text-muted-foreground break-words mt-0.5 leading-relaxed">
                        Receive email updates for scheduled content calendar posts.
                      </p>
                    </div>
                    <Switch
                      checked={notifications.emailAlerts}
                      onCheckedChange={(val) => handleSaveNotifications("emailAlerts", val)}
                      className="shrink-0 mt-1"
                    />
                  </div>

                  <div className="flex items-start justify-between py-2 border-b border-border gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-foreground break-words">LinkedIn Auto-Post Status</h4>
                      <p className="text-xs text-muted-foreground break-words mt-0.5 leading-relaxed">
                        Get notified when a post successfully publishes or fails on LinkedIn.
                      </p>
                    </div>
                    <Switch
                      checked={notifications.postAlerts}
                      onCheckedChange={(val) => handleSaveNotifications("postAlerts", val)}
                      className="shrink-0 mt-1"
                    />
                  </div>

                  <div className="flex items-start justify-between py-2 border-b border-border gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-foreground break-words">Weekly Digest</h4>
                      <p className="text-xs text-muted-foreground break-words mt-0.5 leading-relaxed">
                        Summary of post performance and engagement insights once a week.
                      </p>
                    </div>
                    <Switch
                      checked={notifications.weeklyDigest}
                      onCheckedChange={(val) => handleSaveNotifications("weeklyDigest", val)}
                      className="shrink-0 mt-1"
                    />
                  </div>

                  <div className="flex items-start justify-between py-2 gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-foreground break-words">Product Updates</h4>
                      <p className="text-xs text-muted-foreground break-words mt-0.5 leading-relaxed">
                        News about new AI tools and Daily Gap feature additions.
                      </p>
                    </div>
                    <Switch
                      checked={notifications.productUpdates}
                      onCheckedChange={(val) => handleSaveNotifications("productUpdates", val)}
                      className="shrink-0 mt-1"
                    />
                  </div>
                </div>

                {/* BOTTOM ACTION BAR */}
                <div className="pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="hero"
                    onClick={() => {
                      toast.success("Notification preferences saved!");
                      setActiveCategory(null);
                    }}
                    className="w-full gap-1.5 text-xs sm:text-sm font-medium h-10"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Done
                  </Button>
                </div>
              </motion.div>
            )}

            {/* VIEW 7: THEME & APPEARANCE */}
            {activeCategory === "appearance" && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all text-left group ${
                      theme === "light"
                        ? "border-primary bg-accent/40 shadow-xs ring-1 ring-primary"
                        : "border-border/70 hover:border-border bg-card/60"
                    }`}
                  >
                    <div className="h-16 sm:h-20 rounded-lg border border-border/80 bg-white p-2 sm:p-2.5 flex flex-col justify-between mb-2.5 sm:mb-3 shadow-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-slate-300" />
                        <div className="h-2 w-2 rounded-full bg-slate-300" />
                        <div className="h-2 w-2 rounded-full bg-slate-300" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 w-16 rounded-sm bg-slate-200" />
                        <div className="h-2 w-24 rounded-sm bg-slate-100" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Light Mode</div>
                        <div className="text-xs text-muted-foreground">High contrast day theme</div>
                      </div>
                      {theme === "light" && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all text-left group ${
                      theme === "dark"
                        ? "border-primary bg-accent/40 shadow-xs ring-1 ring-primary"
                        : "border-border/70 hover:border-border bg-card/60"
                    }`}
                  >
                    <div className="h-16 sm:h-20 rounded-lg border border-slate-700 bg-slate-900 p-2 sm:p-2.5 flex flex-col justify-between mb-2.5 sm:mb-3 shadow-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-slate-700" />
                        <div className="h-2 w-2 rounded-full bg-slate-700" />
                        <div className="h-2 w-2 rounded-full bg-slate-700" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 w-16 rounded-sm bg-slate-700" />
                        <div className="h-2 w-24 rounded-sm bg-slate-800" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Dark Mode</div>
                        <div className="text-xs text-muted-foreground">Sleek obsidian night theme</div>
                      </div>
                      {theme === "dark" && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  </button>
                </div>

                {/* BOTTOM ACTION BAR */}
                <div className="pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="hero"
                    onClick={() => {
                      toast.success(`Theme set to ${theme} mode`);
                      setActiveCategory(null);
                    }}
                    className="w-full gap-1.5 text-xs sm:text-sm font-medium"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Done
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

