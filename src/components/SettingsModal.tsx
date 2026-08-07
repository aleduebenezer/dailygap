import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Trash2,
  Phone,
  Mail,
  Loader2,
  Sparkles,
  Calendar as CalendarIcon,
  Settings2,
} from "lucide-react";
import LinkedInConnect from "@/components/LinkedInConnect";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
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
  defaultTab = "profile",
  calendarId = null,
  calendarNiche = null,
  onOpenEditCalendar,
}: SettingsModalProps) {
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();

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

  // Load User Data
  useEffect(() => {
    if (!user) return;

    // 1. Check local storage cache or metadata
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

      // Update Supabase auth user metadata
      await supabase.auth.updateUser({
        data: updatedMetadata,
      });

      // Sync to local storage
      const profileData = {
        id: user.id,
        email,
        username: username.trim(),
        avatar_url: avatarUrl,
        phone: phone.trim(),
        notifications,
        updated_at: new Date().toISOString(),
      };

      localStorage.setItem(`dailygap_profile_${user.id}`, JSON.stringify(profileData));

      // Also update all profiles list
      try {
        const rawProfs = localStorage.getItem("dailygap_all_profiles");
        let allProfs = rawProfs ? JSON.parse(rawProfs) : [];
        const idx = allProfs.findIndex((p: any) => p.id === user.id);
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
      toast.success("Profile updated successfully!");
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
        toast.success("Profile picture updated! Click 'Save Changes' to apply.");
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
      toast.success("Notification preferences updated");
    }
  };

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : email
    ? email.slice(0, 2).toUpperCase()
    : "DG";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-border bg-card">
        <DialogHeader className="p-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
              <User className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold font-display">Account Settings</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Manage your profile, connected accounts, security, and preferences.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6">
          <Tabs defaultValue={defaultTab} className="flex flex-col sm:flex-row gap-6 w-full items-start">
            <TabsList className="flex flex-col h-auto w-full sm:w-48 bg-muted/40 p-1.5 rounded-xl gap-1 shrink-0 border border-border/40">
              <TabsTrigger value="profile" className="w-full justify-start rounded-lg gap-2.5 px-3 py-2 text-xs font-medium text-left data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <User className="h-4 w-4 text-primary" /> Profile
              </TabsTrigger>
              <TabsTrigger value="calendar" className="w-full justify-start rounded-lg gap-2.5 px-3 py-2 text-xs font-medium text-left data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <CalendarIcon className="h-4 w-4 text-primary" /> Calendar
              </TabsTrigger>
              <TabsTrigger value="linkedin" className="w-full justify-start rounded-lg gap-2.5 px-3 py-2 text-xs font-medium text-left data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Linkedin className="h-4 w-4 text-primary" /> LinkedIn
              </TabsTrigger>
              <TabsTrigger value="security" className="w-full justify-start rounded-lg gap-2.5 px-3 py-2 text-xs font-medium text-left data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Lock className="h-4 w-4 text-primary" /> Security
              </TabsTrigger>
              <TabsTrigger value="notifications" className="w-full justify-start rounded-lg gap-2.5 px-3 py-2 text-xs font-medium text-left data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Bell className="h-4 w-4 text-primary" /> Alerts
              </TabsTrigger>
              <TabsTrigger value="appearance" className="w-full justify-start rounded-lg gap-2.5 px-3 py-2 text-xs font-medium text-left data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Sun className="h-4 w-4 text-primary" /> Theme
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 w-full min-w-0">

            {/* TAB 1: EDIT PROFILE INFO */}
            <TabsContent value="profile" className="space-y-6">
              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* Profile Picture Upload & Presets */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="relative group">
                    <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-md">
                      <AvatarImage src={avatarUrl} alt={username} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
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

                  <div className="space-y-2 text-center sm:text-left flex-1">
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
                    <div className="flex items-center gap-1.5 pt-2">
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
                    <Label htmlFor="username" className="text-xs font-medium">
                      Username / Full Name
                    </Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. Ebenezer Aledu"
                      className="h-9 text-sm"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Input
                        id="email"
                        value={email}
                        disabled
                        className="h-9 text-sm pr-8 bg-muted/40 cursor-not-allowed opacity-80"
                      />
                      <Mail className="h-4 w-4 absolute right-2.5 top-2.5 text-muted-foreground" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Email is verified and linked to your login account.
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-medium">
                      Phone Number (Optional)
                    </Label>
                    <div className="relative">
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="h-9 text-sm pl-8"
                      />
                      <Phone className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Account Role</Label>
                    <div className="h-9 px-3 rounded-md border border-border/50 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {user?.email === "ebenezeraledu@gmail.com" ? "Super Administrator" : "Standard User"}
                      </span>
                      {user?.email === "ebenezeraledu@gmail.com" && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                          <ShieldCheck className="h-3 w-3" /> Admin
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="hero" disabled={savingProfile} className="gap-2">
                    {savingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Save Profile Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* TAB: CALENDAR SETTINGS & CUSTOMIZATION */}
            <TabsContent value="calendar" className="space-y-4">
              <div className="rounded-xl border border-border/60 p-5 bg-card space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      {calendarNiche ? `Active Calendar: ${calendarNiche}` : "Calendar Settings"}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Customize your content calendar's design, templates, color themes, typography fonts, or visual illustration overlays.
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <CalendarIcon className="h-5 w-5" />
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border border-border/40 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Calendar Customization</span>
                    <span className="text-primary font-semibold">Templates • Colors • Fonts</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Switch between sleek modern themes, gradient accent palettes, custom fonts, or add drag-and-drop illustrations directly onto your calendar grid.
                  </p>
                  <Button
                    type="button"
                    variant="hero"
                    className="w-full gap-2 mt-2"
                    onClick={() => {
                      onOpenChange(false);
                      if (onOpenEditCalendar) {
                        onOpenEditCalendar();
                      } else {
                        toast.info("Select a calendar on your dashboard to customize design");
                      }
                    }}
                  >
                    <Settings2 className="h-4 w-4" /> Open Calendar Customizer (Edit Design)
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: CONNECT LINKEDIN */}
            <TabsContent value="linkedin" className="space-y-4">
              <div className="rounded-xl border border-border/60 p-4 bg-card">
                <LinkedInConnect
                  userId={user?.id || ""}
                  calendarId={calendarId}
                  calendarNiche={calendarNiche}
                />
              </div>
            </TabsContent>

            {/* TAB 3: CHANGE PASSWORD */}
            <TabsContent value="security" className="space-y-5">
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs font-medium">
                    New Password
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="h-9 text-sm"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs font-medium">
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="h-9 text-sm"
                    required
                  />
                </div>

                <Button type="submit" variant="hero" disabled={updatingPassword} className="gap-2 mt-2">
                  {updatingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Updating...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Change Password
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* TAB 4: NOTIFICATION SETTINGS */}
            <TabsContent value="notifications" className="space-y-4">
              <div className="space-y-4 rounded-xl border border-border/60 p-4 bg-card">
                <div className="flex items-center justify-between py-2 border-b border-border/40">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Email Notifications</h4>
                    <p className="text-xs text-muted-foreground">
                      Receive email updates for scheduled content calendar posts.
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailAlerts}
                    onCheckedChange={(val) => handleSaveNotifications("emailAlerts", val)}
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-border/40">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">LinkedIn Auto-Post Status</h4>
                    <p className="text-xs text-muted-foreground">
                      Get notified when a post successfully publishes or fails on LinkedIn.
                    </p>
                  </div>
                  <Switch
                    checked={notifications.postAlerts}
                    onCheckedChange={(val) => handleSaveNotifications("postAlerts", val)}
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-border/40">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Weekly Digest</h4>
                    <p className="text-xs text-muted-foreground">
                      Summary of post performance and engagement insights once a week.
                    </p>
                  </div>
                  <Switch
                    checked={notifications.weeklyDigest}
                    onCheckedChange={(val) => handleSaveNotifications("weeklyDigest", val)}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Product Updates</h4>
                    <p className="text-xs text-muted-foreground">
                      News about new AI tools and Daily Gap feature additions.
                    </p>
                  </div>
                  <Switch
                    checked={notifications.productUpdates}
                    onCheckedChange={(val) => handleSaveNotifications("productUpdates", val)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* TAB 5: CHANGE THEME MODE */}
            <TabsContent value="appearance" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 ${
                    theme === "light"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                      : "border-border hover:border-muted-foreground/30 bg-card"
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Sun className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-foreground block">Light Theme</span>
                    <span className="text-xs text-muted-foreground">Bright, high contrast look</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 ${
                    theme === "dark"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                      : "border-border hover:border-muted-foreground/30 bg-card"
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <Moon className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-foreground block">Dark Theme</span>
                    <span className="text-xs text-muted-foreground">Sleek, eye-friendly night canvas</span>
                  </div>
                </button>
              </div>
            </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
