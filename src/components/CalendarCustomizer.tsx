import { Check } from "lucide-react";

const COLORS = [
  "hsl(220, 90%, 56%)",
  "hsl(160, 60%, 45%)",
  "hsl(280, 70%, 55%)",
  "hsl(350, 80%, 55%)",
  "hsl(40, 90%, 55%)",
];

const FONTS = [
  { label: "Default", value: "'Inter', sans-serif" },
  { label: "Serif", value: "'Georgia', serif" },
  { label: "Mono", value: "'Courier New', monospace" },
  { label: "Rounded", value: "'Nunito', sans-serif" },
  { label: "Elegant", value: "'Playfair Display', serif" },
];

interface CalendarCustomizerProps {
  calendarColor: string;
  setCalendarColor: (c: string) => void;
  calendarFont: string;
  setCalendarFont: (f: string) => void;
}

const CalendarCustomizer = ({
  calendarColor,
  setCalendarColor,
  calendarFont,
  setCalendarFont,
}: CalendarCustomizerProps) => {
  return (
    <div className="space-y-6">
      {/* Color picker */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Accent Color Theme
        </label>
        <div className="flex flex-wrap gap-3 pt-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCalendarColor(c)}
              className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full border-2 transition-all flex items-center justify-center shadow-xs ${
                calendarColor === c
                  ? "border-foreground ring-2 ring-primary/40 scale-110 shadow-md"
                  : "border-transparent hover:scale-105 opacity-85 hover:opacity-100"
              }`}
              style={{ backgroundColor: c }}
            >
              {calendarColor === c && (
                <Check className="h-4 w-4 text-white drop-shadow-md stroke-[3]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Font picker */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Calendar Typography Font
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {FONTS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setCalendarFont(f.value)}
              className={`text-left px-3.5 py-2.5 rounded-xl text-sm transition-all flex items-center justify-between border ${
                calendarFont === f.value
                  ? "bg-primary/10 text-primary border-primary/50 shadow-xs font-semibold"
                  : "border-border/60 hover:bg-muted/50 text-foreground"
              }`}
              style={{ fontFamily: f.value }}
            >
              <span>{f.label}</span>
              {calendarFont === f.value && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarCustomizer;
