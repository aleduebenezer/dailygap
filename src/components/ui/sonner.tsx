import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2, X } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const ToastStatusIcon = ({ type }: { type: "success" | "error" | "warning" | "info" | "loading" }) => {
  switch (type) {
    case "success":
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
      );
    case "error":
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-500/20">
          <AlertCircle className="h-3.5 w-3.5" />
        </span>
      );
    case "warning":
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-500/20">
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      );
    case "loading":
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </span>
      );
    default:
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
          <Info className="h-3.5 w-3.5" />
        </span>
      );
  }
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "dark" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      closeButton={true}
      duration={4000}
      icons={{
        success: <ToastStatusIcon type="success" />,
        error: <ToastStatusIcon type="error" />,
        warning: <ToastStatusIcon type="warning" />,
        info: <ToastStatusIcon type="info" />,
        loading: <ToastStatusIcon type="loading" />,
        close: <X className="h-3.5 w-3.5" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans rounded-2xl border bg-card text-card-foreground border-border shadow-xl dark:shadow-2xl dark:shadow-black/50 p-4 pr-9 gap-3 items-start backdrop-blur-md transition-all",
          title: "font-sans font-semibold text-sm text-foreground tracking-tight leading-tight",
          description: "font-sans text-xs text-muted-foreground leading-relaxed mt-0.5",
          icon: "shrink-0 mt-0.5",
          content: "flex flex-col gap-0.5",
          actionButton:
            "font-sans bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg px-3 py-1.5 shadow-sm transition-all focus:outline-none",
          cancelButton:
            "font-sans bg-secondary hover:bg-muted text-secondary-foreground text-xs font-medium rounded-lg px-3 py-1.5 transition-all focus:outline-none",
          closeButton:
            "text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors border border-transparent hover:border-border",
        },
      }}
      {...props}
      richColors={false}
    />
  );
};

export { Toaster, toast };

