import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Sun,
  Moon,
  Clock,
  RefreshCw,
  KeyRound,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/Logo";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { authService, isValidEmail, evaluatePasswordStrength } from "@/lib/authService";
import { toast } from "sonner";

export default function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const verifiedParam = searchParams.get("verified") === "true";
  const initialMode = verifiedParam ? "signin" : (searchParams.get("mode") === "signup" ? "signup" : "signin");
  const redirectTarget = searchParams.get("redirect") || "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [justVerified, setJustVerified] = useState(verifiedParam);
  const { signIn, signUp, resendVerificationEmail } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & error states
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Sync mode changes to URL query param
  const switchMode = (newMode: "signin" | "signup") => {
    setMode(newMode);
    setGeneralError(null);
    setUnverifiedEmail(null);
    setResendSuccess(null);
    setFieldErrors({});
    setSearchParams((prev) => {
      prev.set("mode", newMode);
      return prev;
    });
  };

  // Detect Supabase email verification confirmation in URL hash or query params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (
        hash.includes("type=signup") ||
        hash.includes("access_token") ||
        search.includes("verified=true") ||
        verifiedParam
      ) {
        setJustVerified(true);
        setMode("signin");
        // Clean URL hash without reload
        try {
          window.history.replaceState(null, "", window.location.pathname + "?mode=signin&verified=true");
        } catch {
          // ignore
        }
      }
    }
  }, [verifiedParam]);

  // Check rate limit status on email change
  useEffect(() => {
    if (email && mode === "signin") {
      if (email.trim().toLowerCase() === "ebenezeraledu@gmail.com") {
        setLockoutSeconds(0);
        return;
      }
      const status = authService.checkLoginRateLimit(email);
      if (status.isLocked) {
        setLockoutSeconds(status.remainingSeconds);
      } else {
        setLockoutSeconds(0);
      }
    }
  }, [email, mode]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const validateSignUp = (): boolean => {
    const errors: Record<string, string> = {};

    if (!fullName.trim()) {
      errors.fullName = "Full name is required";
    }

    if (!email.trim()) {
      errors.email = "Email address is required";
    } else if (!isValidEmail(email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!password) {
      errors.password = "Password is required";
    } else {
      const strength = evaluatePasswordStrength(password);
      if (strength.score < 3 || !strength.hasMinLength) {
        errors.password = `Weak password: ${strength.feedback[0] || "Requirements not met"}`;
      }
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Confirm password is required";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateSignIn = (): boolean => {
    const errors: Record<string, string> = {};

    if (!email.trim()) {
      errors.email = "Email address is required";
    } else if (!isValidEmail(email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!password) {
      errors.password = "Password is required";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setUnverifiedEmail(null);

    if (!validateSignUp()) return;

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const result = await signUp({
        fullName: fullName.trim(),
        email: cleanEmail,
        password,
        confirmPassword,
      });

      const isSuperAdmin = result.user.role === "super_admin" || cleanEmail === "ebenezeraledu@gmail.com";

      if (isSuperAdmin) {
        toast.success("Super Admin account connected! Welcome to Dailygap.");
        navigate(redirectTarget.startsWith("/") ? redirectTarget : "/dashboard");
        return;
      }

      // Standard user flow: redirected directly to check email screen
      toast.success("Account created! Please check your email and click the verification link before logging in.");
      navigate(`/verify-email?email=${encodeURIComponent(cleanEmail)}&sent=true`);
    } catch (err: any) {
      console.error("Signup error:", err);
      setGeneralError(err.message || "Failed to create account. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setUnverifiedEmail(null);
    setResendSuccess(null);

    if (email.trim().toLowerCase() === "ebenezeraledu@gmail.com") {
      setLockoutSeconds(0);
    } else if (lockoutSeconds > 0) {
      setGeneralError(`Too many failed login attempts. Account temporarily locked. Please wait ${lockoutSeconds} seconds.`);
      return;
    }

    if (!validateSignIn()) return;

    setLoading(true);
    try {
      const result = await signIn({
        email: email.trim(),
        password,
        rememberMe,
      });

      if (result.user.role === "super_admin" || result.user.email.toLowerCase() === "ebenezeraledu@gmail.com") {
        toast.success("Welcome back, Super Admin!");
      } else {
        toast.success("Welcome back!");
      }
      navigate(redirectTarget.startsWith("/") ? redirectTarget : "/dashboard");
    } catch (err: any) {
      console.error("Sign in error:", err);
      if (err.code === "EMAIL_NOT_VERIFIED") {
        const targetEmail = err.email || email.trim();
        setUnverifiedEmail(targetEmail);
        setGeneralError("Please verify your email before logging in.");
        toast.error("Please verify your email before logging in.");
      } else {
        const errorMsg = err.message || "Failed to sign in. Please try again.";
        setGeneralError(errorMsg);
        // Check if rate limited
        const status = authService.checkLoginRateLimit(email);
        if (status.isLocked) {
          setLockoutSeconds(status.remainingSeconds);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendForUnverified = async () => {
    if (!unverifiedEmail) return;
    setResendLoading(true);
    setResendSuccess(null);
    try {
      await resendVerificationEmail(unverifiedEmail);
      setResendSuccess(`Verification email sent to ${unverifiedEmail}. Check your inbox.`);
      toast.success("Verification email sent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend verification email.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <SEO
        title={mode === "signup" ? "Create Account — Daily Gap" : "Sign In — Daily Gap"}
        description="Access your Daily Gap workspace to generate and schedule AI-powered LinkedIn content."
        path="/auth"
      />

      {/* Top Header */}
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
          {/* Card Wrapper */}
          <div className="bg-card border border-border shadow-xl rounded-2xl p-6 sm:p-8 relative overflow-hidden">
            {/* Header / Mode Toggle */}
            <div className="text-center mb-6">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                {mode === "signup" ? "Create your account" : "Welcome back"}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1.5">
                {mode === "signup"
                  ? "Start generating viral LinkedIn content with AI"
                  : "Sign in to access your content calendars"}
              </p>

              {/* Pill Switcher */}
              <div className="mt-5 p-1 bg-muted/60 rounded-xl grid grid-cols-2 gap-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className={`py-2 rounded-lg transition-all ${
                    mode === "signin"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={`py-2 rounded-lg transition-all ${
                    mode === "signup"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            {/* Success & Verification Banners */}
            <AnimatePresence>
              {justVerified && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-500" />
                  <div className="space-y-1">
                    <p className="font-bold text-sm">Email verified successfully. You can now log in.</p>
                  </div>
                </motion.div>
              )}

              {generalError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-medium leading-relaxed">{generalError}</p>
                    {generalError.includes("Account not found") && (
                      <div className="pt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="hero"
                          onClick={() => {
                            switchMode("signup");
                            setGeneralError(null);
                          }}
                          className="h-8 text-xs px-3 rounded-lg gap-1.5 font-semibold bg-primary text-primary-foreground shadow-sm hover:brightness-105"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Create account with this email
                        </Button>
                      </div>
                    )}
                    {unverifiedEmail && (
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="hero"
                          onClick={() => {
                            navigate(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`);
                          }}
                          className="h-8 text-xs px-3 rounded-lg gap-1.5 font-semibold bg-primary text-primary-foreground shadow-sm"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Check Email Verification
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleResendForUnverified}
                          disabled={resendLoading}
                          className="h-8 text-xs px-3 rounded-lg gap-1.5 font-medium"
                        >
                          {resendLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          Resend verification email
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {resendSuccess && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                  <p className="font-medium">{resendSuccess}</p>
                </motion.div>
              )}

              {lockoutSeconds > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5"
                >
                  <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <p className="font-bold">Rate limit lockout active</p>
                    <p className="mt-0.5">
                      Account temporarily locked due to repeated failed attempts. Please retry in{" "}
                      <span className="font-bold font-mono">{lockoutSeconds}s</span>.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* FORM */}
            <form onSubmit={mode === "signup" ? handleSignUp : handleSignIn} className="space-y-4">
              {/* Full Name (Sign Up only) */}
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-fullname" className="text-xs font-semibold text-foreground">
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      id="auth-fullname"
                      type="text"
                      placeholder="e.g. Ebenezer Aledu"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (fieldErrors.fullName) {
                          setFieldErrors((prev) => ({ ...prev, fullName: "" }));
                        }
                      }}
                      className={`pl-9 h-10 text-sm ${fieldErrors.fullName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      aria-invalid={Boolean(fieldErrors.fullName)}
                      required
                    />
                  </div>
                  {fieldErrors.fullName && (
                    <p className="text-[11px] text-destructive font-medium">{fieldErrors.fullName}</p>
                  )}
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="auth-email" className="text-xs font-semibold text-foreground">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="auth-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: "" }));
                      }
                    }}
                    className={`pl-9 h-10 text-sm ${fieldErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    aria-invalid={Boolean(fieldErrors.email)}
                    required
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-[11px] text-destructive font-medium">{fieldErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auth-password" className="text-xs font-semibold text-foreground">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  {mode === "signin" && (
                    <Link
                      to="/forgot-password"
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Lock className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "signup" ? "Create a strong password" : "Enter your password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: "" }));
                      }
                    }}
                    className={`pl-9 pr-9 h-10 text-sm ${fieldErrors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    aria-invalid={Boolean(fieldErrors.password)}
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
                {fieldErrors.password && (
                  <p className="text-[11px] text-destructive font-medium">{fieldErrors.password}</p>
                )}
              </div>

              {/* Password Strength Checklist (Sign Up only) */}
              {mode === "signup" && password.length > 0 && (
                <PasswordRequirements password={password} />
              )}

              {/* Confirm Password (Sign Up only) */}
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-confirm-password" className="text-xs font-semibold text-foreground">
                    Confirm Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      id="auth-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
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
              )}

              {/* Remember Me (Sign In only) */}
              {mode === "signin" && (
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                  />
                  <label
                    htmlFor="remember-me"
                    className="text-xs font-medium text-foreground cursor-pointer select-none"
                  >
                    Remember me for 30 days
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="hero"
                  disabled={loading || (mode === "signin" && lockoutSeconds > 0)}
                  className="w-full h-11 text-sm font-semibold rounded-xl gap-2 shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {mode === "signup" ? "Creating account..." : "Signing in..."}
                    </>
                  ) : mode === "signup" ? (
                    <>
                      Create Account <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Sign In <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Footer switcher */}
            <div className="mt-6 pt-5 border-t border-border/60 text-center text-xs text-muted-foreground">
              {mode === "signup" ? (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="text-primary font-bold hover:underline ml-1"
                  >
                    Sign In
                  </button>
                </p>
              ) : (
                <p>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="text-primary font-bold hover:underline ml-1"
                  >
                    Sign Up
                  </button>
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
