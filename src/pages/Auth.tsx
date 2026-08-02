import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const cleanEmail = email.toLowerCase().trim();
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }

      if (cleanEmail === "ebenezeraledu@gmail.com") {
        toast.success("Super Admin signed in successfully");
        navigate("/admin");
        return;
      }

      toast.success(isLogin ? "Welcome back!" : "Account created successfully!");
      const pendingNiche = sessionStorage.getItem("pendingNiche");
      const pendingGenData = sessionStorage.getItem("pendingGenerateData");
      if (pendingGenData) {
        const genData = JSON.parse(pendingGenData);
        navigate("/generate", { state: genData });
      } else if (pendingNiche) {
        navigate("/generate", { state: { niche: pendingNiche } });
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email address");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Check your email for a password reset link!");
      setIsForgotPassword(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <SEO
        title="Sign in or create your Daily Gap account"
        description="Sign in to Daily Gap or create a free account to generate AI-powered LinkedIn content calendars tailored to your voice and niche."
        path="/auth"
        noIndex
      />
      <h1 className="sr-only">Sign in to Daily Gap</h1>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Button variant="ghost" className="mb-6 gap-2" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="glass rounded-2xl p-8 glow-border">
          <div className="flex items-center gap-2 mb-6">
            <Logo className="h-7 w-7" />
            <span className="font-display text-xl font-bold text-foreground">Daily Gap</span>
          </div>

          {isForgotPassword ? (
            <>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Reset password</h2>
              <p className="text-muted-foreground text-sm mb-6">We'll send you a link to reset your password</p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  aria-label="Email address"
                  required
                  className="w-full bg-surface rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button variant="hero" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-4">
                <button onClick={() => setIsForgotPassword(false)} className="text-primary hover:underline font-medium">
                  Back to sign in
                </button>
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                {isLogin ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                {isLogin ? "Sign in to access your content calendar" : "Start generating social media posts today"}
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  aria-label="Email address"
                  required
                  className="w-full bg-surface rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  aria-label="Password"
                  required
                  minLength={6}
                  className="w-full bg-surface rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {isLogin && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-primary text-sm hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
                <Button variant="hero" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Loading..." : isLogin ? "Sign in" : "Create account"}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-4">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary hover:underline font-medium"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
