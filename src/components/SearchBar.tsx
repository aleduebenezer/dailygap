import { useState, useRef, useEffect } from "react";
import { Search, X, Calendar as CalendarIcon, ArrowRight, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

export interface PostEntry {
  date: string;
  content: string;
  platform?: string;
  niche?: string;
}

export interface CalendarEntry {
  id: string;
  niche: string;
  start_date: string;
  posts: PostEntry[];
  created_at: string;
  frozen: boolean;
}

interface SearchBarProps {
  calendars: CalendarEntry[];
  onSelectPost: (calendar: CalendarEntry, post: PostEntry, dateStr: string) => void;
  className?: string;
}

export const SearchBar = ({ calendars, onSelectPost, className = "" }: SearchBarProps) => {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trimQuery = query.trim().toLowerCase();

  // Search matching posts across all calendars
  const matchingResults = trimQuery
    ? calendars.flatMap((cal) => {
        return (cal.posts || [])
          .filter((post) => {
            const content = (post.content || "").toLowerCase();
            const niche = (cal.niche || "").toLowerCase();
            const date = (post.date || "").toLowerCase();

            // Match full phrase or all search words
            const searchWords = trimQuery.split(/\s+/).filter(Boolean);
            return searchWords.every((word) => content.includes(word) || niche.includes(word) || date.includes(word));
          })
          .map((post) => ({
            calendar: cal,
            post,
          }));
      })
    : [];

  const handleSelect = (calendar: CalendarEntry, post: PostEntry) => {
    onSelectPost(calendar, post, post.date);
    setQuery("");
    setFocused(false);
  };

  // Highlight matching query in snippet text
  const getSnippet = (content: string, search: string) => {
    if (!search) return content.slice(0, 100);
    const lowerContent = content.toLowerCase();
    const index = lowerContent.indexOf(search.split(/\s+/)[0]);
    if (index === -1) return content.slice(0, 100);
    const start = Math.max(0, index - 20);
    const end = Math.min(content.length, index + 80);
    return (start > 0 ? "..." : "") + content.slice(start, end) + (end < content.length ? "..." : "");
  };

  return (
    <div ref={containerRef} className={`relative z-50 w-full max-w-sm sm:max-w-md ${className}`}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search posts across calendars..."
          className="pl-9 pr-14 h-9 text-xs rounded-full bg-background/60 hover:bg-background border-border/50 focus-visible:ring-primary/40 focus-visible:border-primary transition-all shadow-xs"
        />
        <div className="absolute right-2.5 flex items-center gap-1">
          {query ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="h-5 w-5 rounded-full hover:bg-muted"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </Button>
          ) : (
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border/60 bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Dropdown search results */}
      <AnimatePresence>
        {focused && trimQuery && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute top-11 left-0 right-0 z-[100] rounded-2xl border border-border/60 bg-background/95 backdrop-blur-md shadow-2xl overflow-hidden max-h-80 flex flex-col"
          >
            <div className="p-2.5 border-b border-border/40 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
              <span>Search Results</span>
              <span>
                {matchingResults.length} post{matchingResults.length === 1 ? "" : "s"} found
              </span>
            </div>

            <div className="overflow-y-auto divide-y divide-border/30 p-1">
              {matchingResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  <FileText className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  No posts matched "<span className="font-semibold text-foreground">{query}</span>"
                </div>
              ) : (
                matchingResults.map(({ calendar, post }, idx) => (
                  <button
                    key={`${calendar.id}-${post.date}-${idx}`}
                    onClick={() => handleSelect(calendar, post)}
                    className="w-full text-left p-2.5 rounded-xl transition-all hover:bg-primary/10 flex flex-col gap-1 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px] px-2 py-0 h-4 border-primary/30 text-primary font-medium truncate max-w-[180px]">
                        {calendar.niche}
                      </Badge>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                        <CalendarIcon className="h-3 w-3" />
                        <span>{post.date}</span>
                      </div>
                    </div>
                    <p className="text-xs text-foreground/90 font-normal line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                      {getSnippet(post.content, trimQuery)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
