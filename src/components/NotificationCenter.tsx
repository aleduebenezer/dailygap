import { useState, useEffect } from "react";
import { Bell, Check, Trash2, Sparkles, Calendar, Info, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  type?: "info" | "success" | "alert" | "ai";
}

const STORAGE_KEY = "daily_gap_user_notifications_v1";

export const sendNotification = (title: string, message: string, type: "info" | "success" | "alert" | "ai" = "info") => {
  window.dispatchEvent(
    new CustomEvent("dailygap_notification", {
      detail: { title, message, type },
    })
  );
};

export const NotificationCenter = ({ userId }: { userId?: string }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  const storageKey = userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY;

  // Load saved notifications or seed initial ones
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setNotifications(JSON.parse(saved));
      } else {
        const initial: NotificationItem[] = [
          {
            id: "init-1",
            title: "Welcome to Daily Gap!",
            message: "Your AI LinkedIn content engine is active. Generate posts, auto-publish to LinkedIn, and manage your calendars.",
            timestamp: Date.now() - 1000 * 60 * 15,
            read: false,
            type: "ai",
          },
          {
            id: "init-2",
            title: "Search Across Calendars",
            message: "You can now use the search bar in the top navigation bar to quickly find any post by keywords or phrases.",
            timestamp: Date.now() - 1000 * 60 * 5,
            read: false,
            type: "info",
          },
        ];
        setNotifications(initial);
        localStorage.setItem(storageKey, JSON.stringify(initial));
      }
    } catch {
      // Fallback
    }
  }, [storageKey]);

  // Save changes
  const updateNotifications = (newList: NotificationItem[]) => {
    setNotifications(newList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newList));
    } catch (e) {
      console.warn("Could not persist notifications:", e);
    }
  };

  // Listen for custom notification events sent from anywhere in the app
  useEffect(() => {
    const handleCustomNotification = (e: Event) => {
      const customEvent = e as CustomEvent<{ title: string; message: string; type?: "info" | "success" | "alert" | "ai" }>;
      if (customEvent.detail) {
        const newItem: NotificationItem = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title: customEvent.detail.title,
          message: customEvent.detail.message,
          timestamp: Date.now(),
          read: false,
          type: customEvent.detail.type || "info",
        };
        setNotifications((prev) => {
          const updated = [newItem, ...prev].slice(0, 50); // keep max 50
          try {
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch (e) {
            console.warn("Could not persist notifications update:", e);
          }
          return updated;
        });
      }
    };

    window.addEventListener("dailygap_notification", handleCustomNotification);
    return () => window.removeEventListener("dailygap_notification", handleCustomNotification);
  }, [storageKey]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    updateNotifications(updated);
  };

  const clearAll = () => {
    updateNotifications([]);
  };

  const toggleRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: !n.read } : n));
    updateNotifications(updated);
  };

  const formatTimeAgo = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case "ai":
        return <Sparkles className="h-4 w-4 text-purple-500 shrink-0" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
      case "alert":
        return <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />;
      default:
        return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full hover:bg-neutral-500/20"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-foreground/80 hover:text-foreground transition-colors" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-1 right-1 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm ring-2 ring-background"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-32px)] max-w-sm sm:w-96 p-0 rounded-2xl shadow-xl border-border/50 bg-background/95 backdrop-blur-md">
        <div className="flex items-center justify-between p-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm text-foreground">Notifications</h4>
            {unreadCount > 0 && (
              <span className="text-[10px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                title="Mark all as read"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Read all
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-7 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Clear all notifications"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No notifications right now
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              <AnimatePresence initial={false}>
                {notifications.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    onClick={() => toggleRead(item.id)}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-muted/40 ${
                      !item.read ? "bg-primary/5 dark:bg-primary/10" : ""
                    }`}
                  >
                    <div className="mt-0.5">{getIcon(item.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-semibold truncate ${!item.read ? "text-foreground" : "text-foreground/80"}`}>
                          {item.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatTimeAgo(item.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                    {!item.read && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
