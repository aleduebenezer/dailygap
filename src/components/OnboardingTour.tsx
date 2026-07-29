import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  description: string;
  placement?: "bottom" | "top" | "right" | "left";
}

interface Props {
  steps: TourStep[];
  storageKey: string;
  open?: boolean;
  onClose?: () => void;
}

const PADDING = 8;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_MARGIN = 12;

const OnboardingTour = ({ steps, storageKey, open, onClose }: Props) => {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Init: show if not seen (or forced open)
  useEffect(() => {
    if (open) {
      setIndex(0);
      setVisible(true);
      return;
    }
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(storageKey);
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, [open, storageKey]);

  const step = steps[index];

  // Track target element position
  useLayoutEffect(() => {
    if (!visible || !step) return;
    const findEl = () =>
      document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);

    const update = () => {
      const el = findEl();
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        // Slight delay so scroll settles
        requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          setRect(r);
        });
      } else {
        setRect(null);
      }
    };
    update();

    const ro = new ResizeObserver(update);
    const el = findEl();
    if (el) ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const interval = setInterval(update, 500);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      clearInterval(interval);
    };
  }, [visible, step]);

  const finish = () => {
    localStorage.setItem(storageKey, "1");
    setVisible(false);
    onClose?.();
  };

  const next = () => {
    if (index < steps.length - 1) setIndex(index + 1);
    else finish();
  };
  const back = () => {
    if (index > 0) setIndex(index - 1);
  };

  if (!visible || !step) return null;

  // Compute tooltip position
  let tooltipStyle: React.CSSProperties = {
    position: "fixed",
    width: TOOLTIP_WIDTH,
    zIndex: 10001,
  };
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (rect) {
    const placement = step.placement || "bottom";
    let top = 0;
    let left = 0;

    if (placement === "bottom") {
      top = rect.bottom + TOOLTIP_MARGIN;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    } else if (placement === "top") {
      top = rect.top - TOOLTIP_MARGIN - 180;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    } else if (placement === "right") {
      top = rect.top + rect.height / 2 - 90;
      left = rect.right + TOOLTIP_MARGIN;
    } else {
      top = rect.top + rect.height / 2 - 90;
      left = rect.left - TOOLTIP_WIDTH - TOOLTIP_MARGIN;
    }

    // Clamp within viewport
    left = Math.min(Math.max(12, left), vw - TOOLTIP_WIDTH - 12);
    top = Math.min(Math.max(12, top), vh - 220);

    tooltipStyle.top = top;
    tooltipStyle.left = left;
  } else {
    // Centered fallback
    tooltipStyle.top = vh / 2 - 100;
    tooltipStyle.left = vw / 2 - TOOLTIP_WIDTH / 2;
  }

  const spotlight = rect
    ? {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] pointer-events-none">
      {/* Dim backdrop with spotlight cutout via box-shadow */}
      {spotlight ? (
        <div
          className="fixed rounded-xl pointer-events-auto transition-all duration-300"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            outline: "2px solid hsl(var(--primary))",
            outlineOffset: 2,
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/60 pointer-events-auto" />
      )}

      {/* Tooltip card */}
      <div
        style={tooltipStyle}
        className="pointer-events-auto rounded-2xl bg-card border border-border shadow-2xl p-5"
      >
        <button
          onClick={finish}
          aria-label="Skip tour"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-[11px] font-medium text-primary uppercase tracking-wider mb-1">
          Step {index + 1} of {steps.length}
        </div>
        <h4 className="font-display text-base font-semibold text-foreground mb-1.5">
          {step.title}
        </h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {step.description}
        </p>

        <div className="flex items-center justify-between gap-2 mt-5">
          <button
            onClick={finish}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="ghost" size="sm" onClick={back}>
                Back
              </Button>
            )}
            <Button variant="hero" size="sm" onClick={next}>
              {index === steps.length - 1 ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OnboardingTour;
