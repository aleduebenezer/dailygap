import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ArrowRight,
  Edit2,
  Check,
  X,
  Loader2,
  ShieldCheck,
  Sun,
  Moon,
  Info,
  KeyRound,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Logo } from "@/components/Logo";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { authService, isValidEmail } from "@/lib/authService";
import { toast } from "sonner";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyEmail, resendVerificationEmail, updateUnverifiedEmail, user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const tokenParam = searchParams.get("token");
  const emailParam = searchParams.get("email") || user?.email || "";

  const getEmailProviderInfo = (userEmail: string) => {
    const domain = userEmail.split("@")[1]?.toLowerCase() || "";
    if (domain === "gmail.com" || domain === "googlemail.com") {
      return { name: "Gmail", url: "https://mail.google.com" };
    }
    if (domain === "outlook.com" || domain === "hotmail.com" || domain === "live.com" || domain === "msn.com") {
      return { name: "Outlook", url: "https://outlook.live.com" };
    }
    if (domain === "yahoo.com" || domain === "ymail.com") {
      return { name: "Yahoo Mail", url: "https://mail.yahoo.com" };
    }
    if (domain === "icloud.com") {
      return { name: "iCloud Mail", url: "https://www.icloud.com/mail" };
    }
    if (domain === "proton.me" || domain === "protonmail.com") {
      return { name: "ProtonMail", url: "https://mail.proton.me" };
    }
    return null;
  };

  // Page mode: 'verifying', 'success', 'expired', 'invalid', 'pending'
  const [status, setStatus] = useState<"verifying" | "success" | "expired" | "invalid" | "pending">(
    tokenParam ? "verifying" : "pending"
  );
  const [email, setEmail] = useState(emailParam);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resend state
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(60);

  // Active code helper for test & preview
  const [activeCodeInfo, setActiveCodeInfo] = useState<{ code: string; actionUrl: string } | null>(null);
  const [showHelper, setShowHelper] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Code input state
  const [inputCode, setInputCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  // Edit Email State
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(emailParam);
  const [editingLoading, setEditingLoading] = useState(false);

  // Sync active code info
  useEffect(() => {
    if (email) {
      const info = authService.getActiveVerificationToken(email);
      setActiveCodeInfo(info);
    }
  }, [email, resendSuccess]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Automatic redirect to sign in upon successful verification
  const [redirectCountdown, setRedirectCountdown] = useState(4);
  useEffect(() => {
    if (status === "success") {
      const targetEmail = email || emailParam;
      const timer = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate(`/auth?mode=signin&email=${encodeURIComponent(targetEmail)}&verified=true`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status, email, emailParam, navigate]);

  // Process token if in URL
  useEffect(() => {
    if (!tokenParam) {
      setStatus("pending");
      return;
    }

    const processToken = async () => {
      setStatus("verifying");
      setErrorMessage(null);
      try {
        const result = await verifyEmail(tokenParam);
        if (result.success) {
          if (result.email) setEmail(result.email);
          else if (result.user?.email) setEmail(result.user.email);
          setStatus("success");
          toast.success("Email verified successfully!");
        }
      } catch (err: any) {
        const msg = err.message || "Failed to verify email.";
        setErrorMessage(msg);
        if (msg.toLowerCase().includes("expired")) {
          setStatus("expired");
        } else {
          setStatus("invalid");
        }
      }
    };

    processToken();
  }, [tokenParam]);

  // Handle Code Verification
  const handleCodeVerify = async (codeToVerify?: string) => {
    const code = (codeToVerify || inputCode).trim();
    if (!code) {
      setErrorMessage("Please enter your verification code.");
      return;
    }

    setCodeLoading(true);
    setErrorMessage(null);
    try {
      const result = await verifyEmail(code);
      if (result.success) {
        setStatus("success");
        toast.success("Code verified successfully! Welcome to Daily Gap.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid or expired code.");
      toast.error(err.message || "Code verification failed.");
    } finally {
      setCodeLoading(false);
    }
  };

  const handleOtpChange = (newVal: string) => {
    const formatted = newVal.toUpperCase();
    setInputCode(formatted);
    setErrorMessage(null);
    if (formatted.length === 6 && !codeLoading) {
      handleCodeVerify(formatted);
    }
  };

  // Handle Resend Verification
  const handleResend = async () => {
    if (!email) {
      toast.error("Please enter an email address to resend.");
      return;
    }

    const rateCheck = authService.checkResendRateLimit(email, "verification");
    if (!rateCheck.canResend) {
      setCooldownSeconds(rateCheck.waitSeconds);
      toast.error(`Too many resend attempts. Please wait ${rateCheck.waitSeconds}s.`);
      return;
    }

    setResending(true);
    setResendSuccess(null);
    setErrorMessage(null);

    try {
      await resendVerificationEmail(email);
      setResendSuccess("Verification code sent! Please check your inbox.");
      setCooldownSeconds(60);
      toast.success("Verification code sent to your email!");
      if (status === "expired" || status === "invalid") {
        setStatus("pending");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to send verification email. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // Handle Update Email
  const handleSaveNewEmail = async () => {
    if (!newEmail.trim() || !isValidEmail(newEmail)) {
      toast.error("Please enter a valid new email address.");
      return;
    }

    setEditingLoading(true);
    try {
      const result = await updateUnverifiedEmail(email, newEmail.trim());
      setEmail(result.user.email);
      setIsEditingEmail(false);
      setResendSuccess(`Email updated. A new verification code was sent to ${result.user.email}.`);
      setCooldownSeconds(60);
      toast.success("Email updated and verification code sent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update email.");
    } finally {
      setEditingLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <SEO
        title="Verify your email — Daily Gap"
        description="Verify your email address to access your Daily Gap workspace."
        path="/verify-email"
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

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="bg-card border border-border shadow-xl rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden">
            {/* STATE 1: VERIFYING IN PROGRESS */}
            {status === "verifying" && (
              <div className="space-y-4 py-4">
                <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
                <h1 className="font-display text-2xl font-bold text-foreground">Verifying your email...</h1>
                <p className="text-sm text-muted-foreground">
                  Please wait while we confirm your verification code.
                </p>
              </div>
            )}

            {/* STATE 2: VERIFICATION SUCCESS */}
            {status === "success" && (
              <div className="space-y-5 py-2">
                <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-foreground">Email verified successfully!</h1>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Your Dailygap account has been verified and activated. You can now log in using the credentials you entered during signup.
                  </p>
                </div>

                <div className="pt-3 space-y-2.5">
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={() =>
                      navigate(
                        `/auth?mode=signin&email=${encodeURIComponent(email || emailParam)}&verified=true`
                      )
                    }
                    className="w-full rounded-xl gap-2 font-semibold h-11"
                  >
                    Log In with Your Credentials <ArrowRight className="h-4 w-4" />
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Redirecting to login in {redirectCountdown}s...
                  </p>
                </div>
              </div>
            )}

            {/* STATE 3: EXPIRED LINK */}
            {status === "expired" && (
              <div className="space-y-5 py-2">
                <div className="mx-auto h-14 w-14 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Clock className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-foreground">Verification link expired</h1>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    Your verification link or code has expired. Request a new verification email below.
                  </p>
                </div>

                {errorMessage && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive text-left">
                    {errorMessage}
                  </div>
                )}

                <div className="space-y-2.5 pt-2">
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={handleResend}
                    disabled={resending || cooldownSeconds > 0}
                    className="w-full rounded-xl gap-2 font-semibold h-11"
                  >
                    {resending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending new email...
                      </>
                    ) : cooldownSeconds > 0 ? (
                      `Resend available in ${cooldownSeconds}s`
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" /> Resend verification email
                      </>
                    )}
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

            {/* STATE 4: INVALID / ALREADY USED LINK */}
            {status === "invalid" && (
              <div className="space-y-5 py-2">
                <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-foreground">Invalid or used link</h1>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    {errorMessage || "The verification link or code is invalid or has already been used."}
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={handleResend}
                    disabled={resending || cooldownSeconds > 0}
                    className="w-full rounded-xl gap-2 font-semibold h-11"
                  >
                    {resending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending email...
                      </>
                    ) : cooldownSeconds > 0 ? (
                      `Resend available in ${cooldownSeconds}s`
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" /> Resend verification email
                      </>
                    )}
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

            {/* STATE 5: PENDING VERIFICATION (CHECK EMAIL SCREEN) */}
            {status === "pending" && (
              <div className="space-y-5">
                <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Mail className="h-7 w-7" />
                </div>

                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                    Check your email
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                    We sent a verification link from <strong className="text-foreground font-semibold">Dailygap</strong> to:
                  </p>

                  {/* Email Pill & Edit Toggle */}
                  <div className="mt-2.5">
                    {!isEditingEmail ? (
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-muted/60 border border-border text-xs font-semibold text-foreground">
                        <span className="font-mono">{email || "your email"}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewEmail(email);
                            setIsEditingEmail(true);
                          }}
                          className="text-primary hover:text-primary/80 transition-colors"
                          title="Change email"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 max-w-xs mx-auto">
                        <Input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="Correct email address"
                          className="h-8 text-xs"
                        />
                        <Button
                          size="sm"
                          variant="hero"
                          onClick={handleSaveNewEmail}
                          disabled={editingLoading}
                          className="h-8 px-2.5 text-xs rounded-lg"
                        >
                          {editingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsEditingEmail(false)}
                          className="h-8 px-2 text-xs"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Instructions Card */}
                <div className="rounded-xl border border-border/80 bg-muted/30 p-4 text-left space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground leading-relaxed">
                      Click the verification link inside your email to verify your address.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground leading-relaxed">
                      Once verified, you will be taken to sign in using the credentials you entered during signup.
                    </p>
                  </div>
                </div>

                {/* Direct Inbox Link if recognized provider */}
                {email && getEmailProviderInfo(email) && (
                  <div>
                    <a
                      href={getEmailProviderInfo(email)!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm h-11 px-4 rounded-xl bg-primary text-primary-foreground shadow-xs hover:brightness-105 transition-all"
                    >
                      <ExternalLink className="h-4 w-4" /> Open {getEmailProviderInfo(email)!.name} Inbox
                    </a>
                  </div>
                )}

                {/* Notifications & Banners */}
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

                  {errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2 text-left"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                      <p className="font-medium">{errorMessage}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Optional Manual Code Input Toggle */}
                <div className="border-t border-border/60 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Prefer to enter a verification code?
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowHelper(!showHelper)}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      {showHelper ? "Hide Code Box" : "Enter Code"}
                    </button>
                  </div>

                  {showHelper && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3 pt-1"
                    >
                      <InputOTP
                        id="verify-otp"
                        maxLength={6}
                        value={inputCode}
                        onChange={handleOtpChange}
                        disabled={codeLoading}
                        autoFocus
                      >
                        <InputOTPGroup className="gap-1.5 sm:gap-2 justify-center">
                          <InputOTPSlot index={0} className="h-11 w-9 sm:w-10 text-base font-bold uppercase rounded-lg border border-input shadow-xs" />
                          <InputOTPSlot index={1} className="h-11 w-9 sm:w-10 text-base font-bold uppercase rounded-lg border border-input shadow-xs" />
                          <InputOTPSlot index={2} className="h-11 w-9 sm:w-10 text-base font-bold uppercase rounded-lg border border-input shadow-xs" />
                          <InputOTPSlot index={3} className="h-11 w-9 sm:w-10 text-base font-bold uppercase rounded-lg border border-input shadow-xs" />
                          <InputOTPSlot index={4} className="h-11 w-9 sm:w-10 text-base font-bold uppercase rounded-lg border border-input shadow-xs" />
                          <InputOTPSlot index={5} className="h-11 w-9 sm:w-10 text-base font-bold uppercase rounded-lg border border-input shadow-xs" />
                        </InputOTPGroup>
                      </InputOTP>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCodeVerify()}
                        disabled={codeLoading || inputCode.trim().length === 0}
                        className="w-full rounded-xl gap-2 font-semibold h-9 text-xs"
                      >
                        {codeLoading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5" /> Submit Code
                          </>
                        )}
                      </Button>
                    </motion.div>
                  )}
                </div>

                {/* Instant Verification Assistant for Preview & Sandbox Testing */}
                {activeCodeInfo && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary inline-flex items-center gap-1">
                        <KeyRound className="h-3.5 w-3.5" /> Preview Testing Assistant
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full font-mono">
                        Sandbox
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Testing in preview without an external email inbox? You can simulate clicking the email verification link directly:
                    </p>
                    <div className="pt-1 flex flex-col sm:flex-row gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="hero"
                        onClick={() => {
                          const tokenMatch = activeCodeInfo.actionUrl.split("token=")[1]?.split("&")[0];
                          if (tokenMatch) {
                            navigate(`/verify-email?token=${tokenMatch}&email=${encodeURIComponent(email)}`);
                          }
                        }}
                        className="h-8 text-xs font-semibold rounded-lg gap-1.5 flex-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Simulate Clicking Email Link
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(activeCodeInfo.code);
                          setCopiedCode(true);
                          toast.success("Verification code copied!");
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className="h-8 text-xs rounded-lg gap-1"
                      >
                        {copiedCode ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        {copiedCode ? "Copied" : "Copy Code"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Resend Action */}
                <div className="space-y-2 pt-1">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleResend}
                    disabled={resending || cooldownSeconds > 0}
                    className="w-full rounded-xl gap-2 font-medium h-10 text-xs shadow-xs"
                  >
                    {resending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Dispatching...
                      </>
                    ) : cooldownSeconds > 0 ? (
                      `Resend available in ${cooldownSeconds}s`
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" /> Resend verification email
                      </>
                    )}
                  </Button>

                  {/* Tips */}
                  <div className="text-[11px] text-muted-foreground/80 flex items-center justify-center gap-1 pt-1">
                    <Info className="h-3 w-3" />
                    <span>Tip: Please check your Spam or Promotions folder for the email.</span>
                  </div>

                  <div className="pt-2 text-xs text-muted-foreground">
                    <span>Already verified? </span>
                    <Link
                      to="/auth?mode=signin"
                      className="text-primary font-bold hover:underline"
                    >
                      Sign In
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
