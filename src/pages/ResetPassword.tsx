import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated successfully!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Invalid or expired reset link.</p>
          <Button variant="hero" onClick={() => navigate("/auth")}>Back to Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <SEO
        title="Reset your Daily Gap password"
        description="Securely set a new password for your Daily Gap account."
        path="/reset-password"
        noIndex
      />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Button variant="ghost" className="mb-6 gap-2" onClick={() => navigate("/auth")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="glass rounded-2xl p-8 glow-border">
          <div className="flex items-center gap-2 mb-6">
            <Logo className="h-7 w-7" />
            <span className="font-display text-xl font-bold text-foreground">Daily Gap</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Set new password</h1>
          <p className="text-muted-foreground text-sm mb-6">Enter your new password below</p>
          <form onSubmit={handleReset} className="space-y-4">
            <input
              id="reset-new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              aria-label="New password"
              required
              minLength={6}
              className="w-full bg-surface rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              id="reset-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              aria-label="Confirm new password"
              required
              minLength={6}
              className="w-full bg-surface rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button variant="hero" className="w-full" size="lg" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
