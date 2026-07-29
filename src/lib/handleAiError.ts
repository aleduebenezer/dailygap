import { toast } from "sonner";

/**
 * Turn a Supabase edge function error into a friendly toast.
 * Detects AI Gateway 402 (credits exhausted) and 429 (rate limited).
 */
export function handleAiError(err: any, fallback = "Something went wrong") {
  const raw =
    (typeof err === "string" ? err : "") +
    " " +
    (err?.message || "") +
    " " +
    (err?.context?.body ? JSON.stringify(err.context.body) : "") +
    " " +
    (err?.error || "");

  const text = raw.toLowerCase();

  if (text.includes("402") || text.includes("credits exhausted") || text.includes("credits_exhausted")) {
    toast.error("Out of AI credits", {
      description: "Your workspace ran out of AI credits. Top up in workspace settings to keep generating.",
      action: {
        label: "Open settings",
        onClick: () => window.open("https://lovable.dev/settings/plans", "_blank"),
      },
      duration: 8000,
    });
    return;
  }

  if (text.includes("429") || text.includes("rate limit")) {
    toast.error("Too many requests", {
      description: "The AI is rate-limited right now. Please wait a moment and try again.",
      duration: 6000,
    });
    return;
  }

  toast.error(err?.message || fallback);
}
