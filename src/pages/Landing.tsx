import { useState } from "react";
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

  const handleGenerate = () => {
    if (!niche.trim()) {
      toast.error("Please enter your niche or role");
      return;
    }
    if (user) {
      navigate("/generate", { state: { niche } });
    } else {
      // Store niche temporarily and show preview then prompt login
      sessionStorage.setItem("pendingNiche", niche);
      navigate("/generate", { state: { niche, preview: true } });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Daily Gap — AI LinkedIn Content Generator"
        description="Generate a month of trending, on-brand LinkedIn posts matched to your voice, niche, and schedule with Daily Gap's AI content engine."
        path="/"
      />
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="font-display text-xl font-bold text-foreground">Daily Gap</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full" aria-label="Toggle color theme">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          {user ? (
            <Button variant="glass" onClick={() => navigate("/dashboard")}>Dashboard</Button>
          ) : (
            <Button variant="glass" onClick={() => navigate("/auth")}>Sign in</Button>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight">
            Your LinkedIn,{" "}
            <span className="gradient-text">on autopilot.</span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-xl mx-auto">
            Generate a month of trending, on-brand LinkedIn posts — matched to your voice, niche, and schedule.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 w-full max-w-xl"
        >
          <div className="glass rounded-2xl p-2 flex items-center gap-2 glow-border">
            <input
              id="niche-input"
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder="Enter your niche, role, or what you represent..."
              aria-label="Your niche, role, or what you represent"
              className="flex-1 bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none text-base"
            />
            <Button variant="hero" size="lg" onClick={handleGenerate} className="rounded-xl gap-2">
              Generate <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-muted-foreground text-sm mt-3">
            Try: "SaaS founder", "UI/UX designer", "Data scientist"
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 grid grid-cols-3 gap-8 text-center"
        >
          {[
            { num: "10-30", label: "Days of posts" },
            { num: "AI", label: "Trending topics" },
            { num: "Your", label: "Writing style" },
          ].map((item) => (
            <div key={item.label}>
              <div className="font-display text-2xl font-bold gradient-text">{item.num}</div>
              <div className="text-muted-foreground text-sm mt-1">{item.label}</div>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
};

export default Landing;
