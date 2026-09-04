import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sun, Moon, ArrowRight, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Landing = () => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [niche, setNiche] = useState("");

  // Redirect to sign in with confirmation if returning from Supabase email verification link
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (
        hash.includes("type=signup") ||
        hash.includes("type=email_change") ||
        hash.includes("access_token") ||
        search.includes("verified=true")
      ) {
        navigate("/auth?mode=signin&verified=true", { replace: true });
      }
    }
  }, [navigate]);

  const handleGenerate = () => {
    if (!niche.trim()) {
      toast.error("Please enter your niche or role");
      return;
    }
    navigate("/generate", { state: { niche } });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Daily Gap — AI LinkedIn Content Generator"
        description="Generate a month of trending, on-brand LinkedIn posts matched to your voice, niche, and schedule with Daily Gap's AI content engine."
        path="/"
      />
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Logo className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full" aria-label="Toggle color theme">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          {user && user.email_verified ? (
            <Button variant="hero" size="sm" className="sm:h-10 sm:px-4 rounded-xl" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="sm:h-10 sm:px-4 text-xs sm:text-sm font-semibold" onClick={() => navigate("/auth?mode=signin")}>
                Sign In
              </Button>
              <Button variant="hero" size="sm" className="sm:h-10 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold" onClick={() => navigate("/auth?mode=signup")}>
                Get Started
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 max-w-3xl mx-auto text-center w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-4 sm:space-y-6"
        >
          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight">
            Your LinkedIn,{" "}
            <span className="text-primary font-bold">on autopilot.</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
            Generate a month of trending, on-brand LinkedIn posts — matched to your voice, niche, and schedule.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 sm:mt-10 w-full max-w-xl"
        >
          <div className="glass rounded-2xl p-2 sm:p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 glow-border">
            <input
              id="niche-input"
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder="Enter your niche, role, or what you represent..."
              aria-label="Your niche, role, or what you represent"
              className="flex-1 bg-transparent px-3 sm:px-4 py-2.5 sm:py-3 text-foreground placeholder:text-muted-foreground focus:outline-none text-sm sm:text-base"
            />
            <Button variant="hero" size="lg" onClick={handleGenerate} className="rounded-xl gap-2 w-full sm:w-auto shrink-0">
              Generate <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-3">
            Try: "SaaS founder", "UI/UX designer", "Data scientist"
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 sm:mt-16 grid grid-cols-3 gap-3 sm:gap-8 text-center w-full max-w-md"
        >
          {[
            { num: "10-30", label: "Days of posts" },
            { num: "AI", label: "Trending topics" },
            { num: "Your", label: "Writing style" },
          ].map((item) => (
            <div key={item.label} className="p-2">
              <div className="font-display text-xl sm:text-2xl font-bold text-primary">{item.num}</div>
              <div className="text-muted-foreground text-xs sm:text-sm mt-1">{item.label}</div>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
};

export default Landing;
