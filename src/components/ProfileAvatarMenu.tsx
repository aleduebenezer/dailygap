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
  const [activeTab, setActiveTab] = useState<string | null>(null);

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

  const openSettingsWithTab = (tab: string | null = null) => {
    setActiveTab(tab);
    setSettingsOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group relative flex items-center gap-2.5 px-2.5 py-1 rounded-full hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background transition-all active:scale-95 text-left border border-border/40 bg-background/50 backdrop-blur-xs"
            aria-label="User account menu"
          >
            <div className="relative shrink-0">
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border border-rose-200/80 dark:border-rose-900/60 shadow-2xs">
                <AvatarImage src={avatarUrl} alt={username} />
                <AvatarFallback className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
            </div>

            <div className="flex flex-col min-w-0 pr-0.5">
              <span className="text-xs font-bold text-foreground leading-tight truncate max-w-[110px] sm:max-w-[150px]">
                {username}
              </span>
              <span className="text-[10px] text-muted-foreground/80 leading-tight truncate max-w-[110px] sm:max-w-[150px]">
                {email}
              </span>
            </div>
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
            onClick={() => openSettingsWithTab(null)}
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
