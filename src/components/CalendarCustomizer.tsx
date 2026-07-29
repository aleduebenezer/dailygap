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
    <div className="space-y-5">
      {/* Color picker */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accent Color</label>
        <div className="flex gap-2 mt-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setCalendarColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                calendarColor === c ? "border-foreground scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Font picker */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Calendar Font</label>
        <div className="flex flex-col gap-1.5 mt-2">
          {FONTS.map((f) => (
            <button
              key={f.value}
              onClick={() => setCalendarFont(f.value)}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between ${
                calendarFont === f.value
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted text-foreground"
              }`}
              style={{ fontFamily: f.value }}
            >
              {f.label}
              {calendarFont === f.value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarCustomizer;
