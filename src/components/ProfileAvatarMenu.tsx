import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, ShieldCheck, User, Sparkles } from "lucide-react";
import { SettingsModal } from "@/components/SettingsModal";

interface ProfileAvatarMenuProps {
  calendarId?: string | null;
  calendarNiche?: string | null;
  onOpenEditCalendar?: () => void;
}

export function ProfileAvatarMenu({
  calendarId = null,
  calendarNiche = null,
  onOpenEditCalendar,
}: ProfileAvatarMenuProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

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

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const openSettingsWithTab = (tab: string) => {
    setActiveTab(tab);
    setSettingsOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group relative flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background transition-transform active:scale-95"
            aria-label="User account menu"
          >
            <Avatar className="h-9 w-9 border-2 border-primary/30 group-hover:border-primary shadow-sm transition-colors">
              <AvatarImage src={avatarUrl} alt={username} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl border-border/80 shadow-xl bg-card">
          {/* USER INFO HEADER */}
          <DropdownMenuLabel className="p-3 font-normal">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-primary/20">
                <AvatarImage src={avatarUrl} alt={username} />
                <AvatarFallback className="bg-primary/15 text-primary font-bold text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-foreground truncate">{username}</span>
                <span className="text-xs text-muted-foreground truncate">{email}</span>
                {isSuperAdmin && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                    <ShieldCheck className="h-3 w-3" /> Super Admin
                  </span>
                )}
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="my-1 border-border/40" />

          {/* MENU OPTIONS */}
          <DropdownMenuItem
            onClick={() => openSettingsWithTab("profile")}
            className="p-2.5 rounded-xl cursor-pointer hover:bg-accent/80 focus:bg-accent/80 transition-colors flex items-center gap-2.5 text-sm font-medium text-foreground"
          >
            <Settings className="h-4 w-4 text-primary" />
            Settings
          </DropdownMenuItem>

          {isSuperAdmin && (
            <DropdownMenuItem
              onClick={() => navigate("/admin")}
              className="p-2.5 rounded-xl cursor-pointer hover:bg-accent/80 focus:bg-accent/80 transition-colors flex items-center gap-2.5 text-sm font-medium text-primary"
            >
              <ShieldCheck className="h-4 w-4" />
              Super Admin Dashboard
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="my-1 border-border/40" />

          <DropdownMenuItem
            onClick={handleLogout}
            className="p-2.5 rounded-xl cursor-pointer hover:bg-destructive/10 focus:bg-destructive/10 text-destructive transition-colors flex items-center gap-2.5 text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        defaultTab={activeTab}
        calendarId={calendarId}
        calendarNiche={calendarNiche}
        onOpenEditCalendar={onOpenEditCalendar}
      />
    </>
  );
}
