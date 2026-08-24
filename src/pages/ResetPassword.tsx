import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ArrowRight,
  Sun,
  Moon,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { authService, evaluatePasswordStrength } from "@/lib/authService";
import { toast } from "sonner";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completePasswordReset } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const tokenParam = searchParams.get("token") || "";

  // Validation status: 'checking', 'valid', 'expired', 'invalid', 'used', 'success'
  const [tokenStatus, setTokenStatus] = useState<"checking" | "valid" | "expired" | "invalid" | "used" | "success">("checking");
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Form states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Async & Field errors
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!tokenParam) {
      setTokenStatus("invalid");
      setTokenError("Password reset link is missing token parameter.");
      return;
    }

    const checkToken = async () => {
      setTokenStatus("checking");
      setTokenError(null);
      const res = await authService.validateResetToken(tokenParam);
      if (res.valid) {
        setTokenStatus("valid");
      } else {
        const err = res.error || "Invalid reset link";
        setTokenError(err);
        if (err.toLowerCase().includes("expired")) {
          setTokenStatus("expired");
        } else if (err.toLowerCase().includes("already been used")) {
          setTokenStatus("used");
        } else {
          setTokenStatus("invalid");
        }
      }
    };

    checkToken();
  }, [tokenParam]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!newPassword) {
      errors.newPassword = "New password is required";
    } else {
      const strength = evaluatePasswordStrength(newPassword);
      if (strength.score < 3 || !strength.hasMinLength) {
        errors.newPassword = `Weak password: ${strength.feedback[0] || "Requirements not met"}`;
      }
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Confirm password is required";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await completePasswordReset({
        token: tokenParam,
        newPassword,
        confirmPassword,
      });

      setTokenStatus("success");
      toast.success("Password updated successfully!");
    } catch (err: any) {
      setGeneralError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <SEO
        title="Set New Password — Daily Gap"
        description="Create a new secure password for your Daily Gap account."
        path="/reset-password"
      />

      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-6xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
          <Logo className="h-7 w-7" />
          <span className="font-display font-bold text-lg text-foreground tracking-tight">Daily Gap</span>
        </Link>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full h-9 w-9"
          aria-label="Toggle color theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="bg-card border border-border shadow-xl rounded-2xl p-6 sm:p-8 relative overflow-hidden">
            {/* STATE 1: CHECKING TOKEN */}
            {tokenStatus === "checking" && (
              <div className="space-y-4 py-6 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
                <h1 className="font-display text-xl font-bold text-foreground">Validating reset link...</h1>
                <p className="text-xs text-muted-foreground">Please wait a moment.</p>
              </div>
            )}

            {/* STATE 2: EXPIRED TOKEN */}
            {tokenStatus === "expired" && (
              <div className="space-y-5 text-center py-2">
                <div className="mx-auto h-14 w-14 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Clock className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-foreground">Reset link expired</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    Your password reset link has expired for security reasons. Please request a new one.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={() => navigate("/forgot-password")}
                    className="w-full rounded-xl gap-2 font-semibold h-11"
                  >
                    Request a new reset link <ArrowRight className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => navigate("/auth?mode=signin")}
                    className="w-full text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Back to Sign In
                  </Button>
                </div>
              </div>
            )}

            {/* STATE 3: INVALID OR USED TOKEN */}
            {(tokenStatus === "invalid" || tokenStatus === "used") && (
              <div className="space-y-5 text-center py-2">
                <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-foreground">
                    {tokenStatus === "used" ? "Reset link already used" : "Invalid reset link"}
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    {tokenError || "This password reset link is invalid, broken, or has already been used to update your password."}
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={() => navigate("/forgot-password")}
                    className="w-full rounded-xl gap-2 font-semibold h-11"
                  >
                    Request a new reset link <ArrowRight className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => navigate("/auth?mode=signin")}
                    className="w-full rounded-xl text-xs font-semibold h-10"
                  >
                    Back to Sign In
                  </Button>
                </div>
              </div>
            )}

            {/* STATE 4: SUCCESS CONFIRMATION */}
            {tokenStatus === "success" && (
              <div className="space-y-5 text-center py-2">
                <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-foreground">Password updated successfully</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    Your password has been changed. You can now sign in with your new password.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={() => navigate("/auth?mode=signin")}
                    className="w-full rounded-xl gap-2 font-semibold h-11"
                  >
                    Sign In <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STATE 5: VALID TOKEN FORM */}
            {tokenStatus === "valid" && (
              <div>
                <div className="text-center mb-6">
                  <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                    Set a new password
                  </h1>
                  <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                    Choose a strong, unique password to secure your account.
                  </p>
                </div>

                <AnimatePresence>
                  {generalError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <p className="font-medium leading-relaxed">{generalError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  {/* New Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-new-password" className="text-xs font-semibold text-foreground">
                      New Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="reset-new-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (fieldErrors.newPassword) {
                            setFieldErrors((prev) => ({ ...prev, newPassword: "" }));
                          }
                        }}
                        className={`pl-9 pr-9 h-10 text-sm ${fieldErrors.newPassword ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        aria-invalid={Boolean(fieldErrors.newPassword)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {fieldErrors.newPassword && (
                      <p className="text-[11px] text-destructive font-medium">{fieldErrors.newPassword}</p>
                    )}
                  </div>

                  {/* Password strength checklist */}
                  {newPassword.length > 0 && <PasswordRequirements password={newPassword} />}

                  {/* Confirm New Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-confirm-password" className="text-xs font-semibold text-foreground">
                      Confirm New Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="reset-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter your new password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (fieldErrors.confirmPassword) {
                            setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
                          }
                        }}
                        className={`pl-9 pr-9 h-10 text-sm ${fieldErrors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        aria-invalid={Boolean(fieldErrors.confirmPassword)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && (
                      <p className="text-[11px] text-destructive font-medium">{fieldErrors.confirmPassword}</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="hero"
                      disabled={submitting}
                      className="w-full h-11 text-sm font-semibold rounded-xl gap-2 shadow-sm"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Resetting password...
                        </>
                      ) : (
                        <>
                          Reset Password <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
