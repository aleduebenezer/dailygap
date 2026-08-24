import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Edit2,
  ShieldCheck,
  KeyRound,
  HelpCircle,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { isValidEmail, authService } from "@/lib/authService";

interface VerificationCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onSuccess?: () => void;
  onEmailChange?: (newEmail: string) => void;
  redirectTarget?: string;
}

export function VerificationCodeModal({
  open,
  onOpenChange,
  email,
  onSuccess,
  onEmailChange,
  redirectTarget = "/dashboard",
}: VerificationCodeModalProps) {
  const navigate = useNavigate();
  const { verifyEmail, resendVerificationEmail, updateUnverifiedEmail } = useAuth();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Active code preview for seamless testing & fallback
  const [activeCodeInfo, setActiveCodeInfo] = useState<{ code: string; actionUrl: string } | null>(null);
  const [showHelper, setShowHelper] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Resend state & cooldown
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendSuccessMsg, setResendSuccessMsg] = useState<string | null>(null);

  // Change email state
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editEmailInput, setEditEmailInput] = useState(email);
  const [updatingEmail, setUpdatingEmail] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Refresh active token info whenever email or open state changes
  useEffect(() => {
    if (open && email) {
      const info = authService.getActiveVerificationToken(email);
      setActiveCodeInfo(info);
    }
  }, [open, email, resendSuccessMsg]);

  // Sync email input when prop changes
  useEffect(() => {
    setEditEmailInput(email);
  }, [email]);

  // Handle countdown timer
  useEffect(() => {
    if (!open) {
      setCode("");
      setError(null);
      setSuccess(false);
      setIsEditingEmail(false);
      setShowHelper(false);
      return;
    }

    // Start 60s cooldown when modal opens
    setCooldown(60);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open]);

  // Handle Verification
  const handleVerify = async (codeToVerify?: string) => {
    const finalCode = (codeToVerify || code).trim();
    if (!finalCode) {
      setError("Please enter your verification code.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await verifyEmail(finalCode);
      if (result.success) {
        setSuccess(true);
        toast.success("Email verified successfully! Welcome to Daily Gap.");

        setTimeout(() => {
          onOpenChange(false);
          if (onSuccess) {
            onSuccess();
          } else {
            navigate(redirectTarget.startsWith("/") ? redirectTarget : "/dashboard");
          }
        }, 1000);
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setError(err.message || "Invalid or expired verification code. Please check your code and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-verify when 6 characters are filled
  const handleCodeChange = (newVal: string) => {
    const formatted = newVal.toUpperCase();
    setCode(formatted);
    setError(null);

    if (formatted.length === 6 && !loading && !success) {
      handleVerify(formatted);
    }
  };

  const handleAutoFillCode = (codeToFill: string) => {
    setCode(codeToFill);
    handleVerify(codeToFill);
  };

  const handleCopyCode = (codeToCopy: string) => {
    navigator.clipboard.writeText(codeToCopy);
    setCopiedCode(true);
    toast.success("Verification code copied to clipboard!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Handle Resend Code
  const handleResend = async () => {
    if (!email || cooldown > 0 || resending) return;

    setResending(true);
    setError(null);
    setResendSuccessMsg(null);

    try {
      await resendVerificationEmail(email);
      setResendSuccessMsg("A fresh verification code has been dispatched to your email.");
      toast.success("Verification code dispatched! Please check your inbox or spam folder.");
      setCooldown(60);

      const refreshedInfo = authService.getActiveVerificationToken(email);
      setActiveCodeInfo(refreshedInfo);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to resend code. Please try again in a few moments.");
      toast.error(err.message || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  // Handle Update Email
  const handleSaveNewEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNewEmail = editEmailInput.trim().toLowerCase();

    if (!cleanNewEmail) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!isValidEmail(cleanNewEmail)) {
      setError("Please enter a valid email address format.");
      return;
    }
    if (cleanNewEmail === email.toLowerCase()) {
      setIsEditingEmail(false);
      return;
    }

    setUpdatingEmail(true);
    setError(null);

    try {
      await updateUnverifiedEmail(email, cleanNewEmail);
      toast.success("Email address updated! A new verification code was sent.");
      if (onEmailChange) onEmailChange(cleanNewEmail);
      setIsEditingEmail(false);
      setCode("");
      setCooldown(60);
      const updatedInfo = authService.getActiveVerificationToken(cleanNewEmail);
      setActiveCodeInfo(updatedInfo);
    } catch (err: any) {
      setError(err.message || "Failed to update email address.");
    } finally {
      setUpdatingEmail(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl border-border bg-card shadow-2xl text-card-foreground">
        <DialogHeader className="flex flex-col items-center text-center space-y-3 pb-1">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
            {success ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-500 animate-in zoom-in" />
            ) : (
              <Mail className="h-6 w-6" />
            )}
          </div>
          <DialogTitle className="text-xl font-bold font-display tracking-tight text-foreground">
            {success ? "Email Verified!" : "Verify Your Email"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            {success ? (
              "Your account has been activated. Redirecting you now..."
            ) : (
              <>
                We sent a 6-digit verification code to{" "}
                <span className="font-semibold text-foreground">{email}</span>.
                Enter the code below to activate your account.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!success && (
          <div className="space-y-5 pt-2">
            {/* Change Email Toggle & Inline Form */}
            {isEditingEmail ? (
              <form onSubmit={handleSaveNewEmail} className="space-y-2 p-3 rounded-xl border border-border bg-muted/40">
                <label className="text-xs font-semibold text-foreground">Update email address:</label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={editEmailInput}
                    onChange={(e) => setEditEmailInput(e.target.value)}
                    placeholder="name@example.com"
                    className="h-9 text-xs"
                    disabled={updatingEmail}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="hero"
                    disabled={updatingEmail || !editEmailInput.trim()}
                    className="h-9 px-3 text-xs font-semibold shrink-0"
                  >
                    {updatingEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save & Resend"}
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditEmailInput(email);
                    setIsEditingEmail(false);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <span>Wrong email address?</span>
                <button
                  type="button"
                  onClick={() => setIsEditingEmail(true)}
                  className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                >
                  <Edit2 className="h-3 w-3" /> Change
                </button>
              </div>
            )}

            {/* OTP Code Input */}
            <div className="flex flex-col items-center justify-center space-y-3">
              <label htmlFor="otp-input" className="sr-only">
                Verification Code
              </label>
              <InputOTP
                id="otp-input"
                maxLength={6}
                value={code}
                onChange={handleCodeChange}
                disabled={loading || success}
                autoFocus
              >
                <InputOTPGroup className="gap-1.5 sm:gap-2">
                  <InputOTPSlot index={0} className="h-12 w-10 sm:w-11 text-base sm:text-lg font-bold uppercase rounded-lg border border-input shadow-sm" />
                  <InputOTPSlot index={1} className="h-12 w-10 sm:w-11 text-base sm:text-lg font-bold uppercase rounded-lg border border-input shadow-sm" />
                  <InputOTPSlot index={2} className="h-12 w-10 sm:w-11 text-base sm:text-lg font-bold uppercase rounded-lg border border-input shadow-sm" />
                  <InputOTPSlot index={3} className="h-12 w-10 sm:w-11 text-base sm:text-lg font-bold uppercase rounded-lg border border-input shadow-sm" />
                  <InputOTPSlot index={4} className="h-12 w-10 sm:w-11 text-base sm:text-lg font-bold uppercase rounded-lg border border-input shadow-sm" />
                  <InputOTPSlot index={5} className="h-12 w-10 sm:w-11 text-base sm:text-lg font-bold uppercase rounded-lg border border-input shadow-sm" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Resend Success Message */}
            {resendSuccessMsg && !error && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{resendSuccessMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <Button
                variant="hero"
                size="lg"
                onClick={() => handleVerify()}
                disabled={loading || code.trim().length === 0}
                className="w-full rounded-xl gap-2 font-semibold h-11 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying code...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" /> Verify Code & Continue
                  </>
                )}
              </Button>

              {/* Instant Verification Code Assistant / Preview for Testing & Seamless Access */}
              {activeCodeInfo && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary inline-flex items-center gap-1">
                      <KeyRound className="h-3.5 w-3.5" /> Verification Code Helper
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowHelper(!showHelper)}
                      className="text-[11px] text-muted-foreground hover:text-foreground font-medium underline"
                    >
                      {showHelper ? "Hide" : "Didn't receive email?"}
                    </button>
                  </div>

                  {showHelper && (
                    <div className="pt-1.5 space-y-2 border-t border-primary/10 animate-in fade-in text-muted-foreground">
                      <p className="text-[11px] leading-relaxed">
                        If your email provider is filtering automated mail or you are testing in preview:
                      </p>
                      <div className="flex items-center justify-between bg-card border border-border px-3 py-2 rounded-lg">
                        <span className="font-mono text-sm font-bold tracking-widest text-foreground">
                          {activeCodeInfo.code}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyCode(activeCodeInfo.code)}
                            className="h-7 px-2 text-[11px] gap-1"
                          >
                            {copiedCode ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            {copiedCode ? "Copied" : "Copy"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="hero"
                            onClick={() => handleAutoFillCode(activeCodeInfo.code)}
                            className="h-7 px-2.5 text-[11px] font-semibold"
                          >
                            Auto-fill & Enter
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Resend & Help Footer */}
              <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t border-border mt-3">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || cooldown > 0}
                  className="font-medium text-primary hover:underline disabled:opacity-50 disabled:hover:no-underline inline-flex items-center gap-1.5"
                >
                  {resending ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Dispatching...
                    </>
                  ) : cooldown > 0 ? (
                    <>
                      <RefreshCw className="h-3 w-3" /> Resend code in {cooldown}s
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3" /> Resend verification code
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="hover:text-foreground font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="py-6 flex flex-col items-center justify-center space-y-2">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">Logging you in...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
