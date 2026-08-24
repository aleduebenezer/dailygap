import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sun,
  Moon,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { authService, isValidEmail } from "@/lib/authService";
import { toast } from "sonner";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { requestPasswordReset } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendSuccess(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    const rateCheck = authService.checkResendRateLimit(email, "password_reset");
    if (!rateCheck.canResend) {
      setCooldownSeconds(rateCheck.waitSeconds);
      setError(`Too many password reset requests. Please wait ${rateCheck.waitSeconds}s.`);
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSubmitted(true);
      setCooldownSeconds(60);
      toast.success("Password reset instructions dispatched.");
    } catch (err: any) {
      setError(err.message || "Failed to process password reset. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim() || cooldownSeconds > 0) return;
    setResending(true);
    setResendSuccess(null);
    setError(null);

    try {
      await requestPasswordReset(email.trim());
      setResendSuccess(`Reset instructions resent to ${email.trim()}. Check your inbox.`);
      setCooldownSeconds(60);
      toast.success("Reset email resent!");
    } catch (err: any) {
      setError(err.message || "Failed to resend reset email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <SEO
        title="Forgot Password — Daily Gap"
        description="Reset your Daily Gap account password."
        path="/forgot-password"
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
            {!submitted ? (
              <div>
                <div className="text-center mb-6">
                  <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                    Reset your password
                  </h1>
                  <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                    Enter the email associated with your account and we'll send you a password reset link.
                  </p>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <p className="font-medium leading-relaxed">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-xs font-semibold text-foreground">
                      Email Address <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError(null);
                        }}
                        className="pl-9 h-10 text-sm"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="hero"
                    disabled={loading || cooldownSeconds > 0}
                    className="w-full h-11 text-sm font-semibold rounded-xl gap-2 shadow-sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending link...
                      </>
                    ) : cooldownSeconds > 0 ? (
                      `Wait ${cooldownSeconds}s to retry`
                    ) : (
                      <>
                        Send Reset Link <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 pt-5 border-t border-border/60 text-center">
                  <Link
                    to="/auth?mode=signin"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-5">
                <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 className="h-8 w-8" />
                </div>

                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                    Check your email
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                    If an account exists for <span className="font-semibold text-foreground font-mono">{email}</span>, we've sent instructions to reset your password.
                  </p>
                </div>

                <AnimatePresence>
                  {resendSuccess && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2 text-left"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                      <p className="font-medium">{resendSuccess}</p>
                    </motion.div>
                  )}

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2 text-left"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                      <p className="font-medium">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2.5 pt-2">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleResend}
                    disabled={resending || cooldownSeconds > 0}
                    className="w-full rounded-xl text-xs font-semibold h-10 gap-1.5"
                  >
                    {resending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...
                      </>
                    ) : cooldownSeconds > 0 ? (
                      `Resend available in ${cooldownSeconds}s`
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" /> Resend reset email
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => navigate("/auth?mode=signin")}
                    className="w-full text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Return to Sign In
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
