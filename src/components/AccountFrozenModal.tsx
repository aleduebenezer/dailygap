import { useState } from "react";
import { Snowflake, Send, CheckCircle2, LogOut, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AccountFrozenModalProps {
  open: boolean;
  userEmail?: string;
  appealData?: any;
  onSignOut: () => void;
  onAppealSubmitted?: (appeal: any) => void;
}

export const AccountFrozenModal = ({
  open,
  userEmail,
  appealData: initialAppeal,
  onSignOut,
  onAppealSubmitted,
}: AccountFrozenModalProps) => {
  const [appealMessage, setAppealMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [appeal, setAppeal] = useState<any>(initialAppeal || null);

  if (!open) return null;

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealMessage.trim()) {
      toast.error("Please enter a message explaining your appeal.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-stats", {
        body: {
          action: "submit_appeal",
          message: appealMessage.trim(),
        },
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || "Failed to submit appeal");
      }

      setAppeal(data.appeal);
      toast.success("Appeal submitted successfully to Administration!");
      if (onAppealSubmitted) onAppealSubmitted(data.appeal);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit appeal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-2xl border border-destructive/30 bg-card p-6 md:p-8 shadow-2xl space-y-6 text-foreground animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Badge */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shadow-inner">
            <Snowflake className="h-8 w-8 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
              Account Frozen
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Associated account: <span className="font-medium text-foreground">{userEmail || "Your account"}</span>
            </p>
          </div>
        </div>

        {/* Warning Alert */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-semibold text-amber-700 dark:text-amber-300">Access Suspended by Administrator</p>
            <p>
              Your account has been frozen by an Administrator. All platform features, post scheduling, and account actions are temporarily suspended.
            </p>
          </div>
        </div>

        {/* Appeal Section */}
        <div className="space-y-4 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" /> Account Appeal
            </h3>
            {appeal && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                appeal.status === 'approved'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                  : appeal.status === 'dismissed'
                  ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
              }`}>
                {appeal.status === 'approved' ? 'Approved' : appeal.status === 'dismissed' ? 'Dismissed' : 'Pending Review'}
              </span>
            )}
          </div>

          {appeal ? (
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                Appeal Submitted on {new Date(appeal.submitted_at || Date.now()).toLocaleDateString()}
              </div>
              <p className="text-xs text-muted-foreground italic bg-background/50 p-3 rounded-lg border border-border">
                "{appeal.message}"
              </p>
              <p className="text-[11px] text-muted-foreground">
                Our super admin team is reviewing your request. You will be un-frozen once approved.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitAppeal} className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                If you believe your account was frozen in error, please describe your situation below to submit an appeal to the Super Admin:
              </p>
              <Textarea
                value={appealMessage}
                onChange={(e) => setAppealMessage(e.target.value)}
                placeholder="Explain why your account should be un-frozen or provide context..."
                className="min-h-[90px] text-xs resize-none"
                disabled={loading}
              />
              <Button
                type="submit"
                className="w-full gap-2 text-xs font-semibold"
                disabled={loading || !appealMessage.trim()}
              >
                {loading ? "Submitting Appeal..." : "Submit Appeal to Administrator"}
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-border flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Contact: <a href="mailto:ebenezeraledu@gmail.com" className="underline hover:text-foreground">ebenezeraledu@gmail.com</a>
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onSignOut}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>

      </div>
    </div>
  );
};
