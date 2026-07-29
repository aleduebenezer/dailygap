import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Calendar, Sparkles, Plus, X, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Logo";
import { handleAiError } from "@/lib/handleAiError";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getHashtagsEnabled } from "@/lib/userPreferences";

const Generate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const locationState = location.state as any;
  const pendingGenData = sessionStorage.getItem("pendingGenerateData");
  const restoredData = pendingGenData ? JSON.parse(pendingGenData) : null;

  const initialNiche = locationState?.niche || restoredData?.niche || sessionStorage.getItem("pendingNiche") || "";
  const isPreview = !user;

  const [step, setStep] = useState(restoredData?.posts?.length ? 3 : 1);
  const [niche, setNiche] = useState(initialNiche);
  const [samples, setSamples] = useState<string[]>(restoredData?.samples?.length ? restoredData.samples : [""]);
  const [numDays, setNumDays] = useState(restoredData?.numDays || 10);
  const [startDate, setStartDate] = useState(() => {
    if (restoredData?.startDate) return restoredData.startDate;
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [posts, setPosts] = useState<{ date: string; content: string }[]>(restoredData?.posts || []);
  const [generating, setGenerating] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  // Clear pending data once user is authenticated and data is restored
  useEffect(() => {
    if (user && pendingGenData) {
      sessionStorage.removeItem("pendingGenerateData");
    }
  }, [user, pendingGenData]);

  const addSample = () => {
    if (samples.length < 4) setSamples([...samples, ""]);
  };

  const removeSample = (idx: number) => {
    setSamples(samples.filter((_, i) => i !== idx));
  };

  const updateSample = (idx: number, value: string) => {
    const updated = [...samples];
    updated[idx] = value;
    setSamples(updated);
  };

  const generatePosts = async () => {
    setGenerating(true);
    try {
      const hashtagsEnabled = await getHashtagsEnabled(user?.id);
      const { data, error } = await supabase.functions.invoke("generate-posts", {
        body: {
          niche,
          samples: samples.filter((s) => s.trim()),
          numDays,
          startDate,
          hashtagsEnabled,
        },
      });
      if (error) throw error;
      setPosts(data.posts);
      setStep(3);
      sessionStorage.removeItem("pendingNiche");
    } catch (err: any) {
      handleAiError(err, "Failed to generate posts");
    } finally {
      setGenerating(false);
    }
  };

  const regeneratePost = async (index: number) => {
    setRegeneratingIndex(index);
    try {
      const hashtagsEnabled = await getHashtagsEnabled(user?.id);
      const { data, error } = await supabase.functions.invoke("generate-posts", {
        body: {
          niche,
          samples: samples.filter((s) => s.trim()),
          numDays: 1,
          startDate: posts[index].date,
          regenerate: true,
          hashtagsEnabled,
        },
      });
      if (error) throw error;
      const updated = [...posts];
      updated[index] = { ...updated[index], content: data.posts[0].content };
      setPosts(updated);
      toast.success("Post regenerated!");
    } catch (err: any) {
      handleAiError(err, "Failed to regenerate");
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const saveToCalendar = async () => {
    if (!user) {
      sessionStorage.setItem("pendingGenerateData", JSON.stringify({
        niche,
        samples: samples.filter((s) => s.trim()),
        numDays,
        startDate,
        posts,
      }));
      navigate("/auth");
      return;
    }
    try {
      // Fetch existing calendars to check for date overlaps
      const { data: existing, error: fetchErr } = await supabase
        .from("calendars")
        .select("*")
        .eq("user_id", user.id);
      if (fetchErr) throw fetchErr;

      // Build a map of date -> existing calendar id for merging
      const dateToCalendar = new Map<string, { id: string; posts: any[] }>();
      (existing || []).forEach((cal: any) => {
        (cal.posts || []).forEach((p: any) => {
          if (!dateToCalendar.has(p.date)) {
            dateToCalendar.set(p.date, { id: cal.id, posts: cal.posts });
          }
        });
      });

      // Tag new posts with the niche
      const taggedPosts = posts.map((p) => ({ ...p, niche }));

      // Split into posts that go to existing calendars vs new calendar
      const mergeMap = new Map<string, any[]>(); // calendar id -> new posts to add
      const newPosts: any[] = [];

      taggedPosts.forEach((post) => {
        const match = dateToCalendar.get(post.date);
        if (match) {
          const arr = mergeMap.get(match.id) || [];
          arr.push(post);
          mergeMap.set(match.id, arr);
        } else {
          newPosts.push(post);
        }
      });

      // Merge into existing calendars
      for (const [calId, addPosts] of mergeMap) {
        const cal = (existing || []).find((c: any) => c.id === calId);
        if (!cal) continue;
        const merged = [...(cal as any).posts, ...addPosts];
        const { error } = await supabase
          .from("calendars")
          .update({ posts: merged as any })
          .eq("id", calId);
        if (error) throw error;
      }

      // Create new calendar for remaining posts
      if (newPosts.length > 0) {
        const { error } = await supabase.from("calendars").insert({
          user_id: user.id,
          niche,
          start_date: startDate,
          posts: newPosts as any,
        });
        if (error) throw error;
      }

      toast.success("Calendar saved!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to save calendar");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Generate your LinkedIn content calendar | Daily Gap"
        description="Build a personalized LinkedIn content calendar in three steps — share your niche, paste writing samples, pick your schedule, and let Daily Gap's AI write posts in your voice."
        path="/generate"
      />
      <header className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <Button variant="ghost" className="gap-2" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <span className="font-display text-lg font-bold text-foreground">Daily Gap</span>
        </div>
      </header>

      <h1 className="sr-only">Generate your LinkedIn content calendar</h1>

      <main className="max-w-3xl mx-auto px-6 pb-20">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? "w-12 bg-primary" : s < step ? "w-8 bg-primary/50" : "w-8 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Niche */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-3xl font-bold text-foreground">Tell us about you</h2>
              <p className="text-muted-foreground mt-2">What's your niche, role, or expertise?</p>
            </div>

            <input
              id="generate-niche"
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. B2B SaaS founder, AI researcher, fitness coach"
              aria-label="Your niche, role, or expertise"
              className="w-full bg-surface rounded-xl px-5 py-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-lg"
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Writing samples (optional)</label>
                {samples.length < 4 && (
                  <button onClick={addSample} className="text-primary text-sm flex items-center gap-1 hover:underline">
                    <Plus className="h-3 w-3" /> Add sample
                  </button>
                )}
              </div>
              {samples.map((sample, idx) => (
                <div key={idx} className="relative">
                  <textarea
                    value={sample}
                    onChange={(e) => updateSample(idx, e.target.value)}
                    placeholder={`Paste a LinkedIn post you've written...`}
                    aria-label={`Writing sample ${idx + 1}`}
                    rows={3}
                    className="w-full bg-surface rounded-xl px-5 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
                  />
                  {samples.length > 1 && (
                    <button onClick={() => removeSample(idx)} aria-label={`Remove writing sample ${idx + 1}`} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <Button variant="hero" size="lg" className="w-full gap-2" onClick={() => niche.trim() ? setStep(2) : toast.error("Enter your niche")}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {/* Step 2: Schedule */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-3xl font-bold text-foreground">Set your schedule</h2>
              <p className="text-muted-foreground mt-2">Choose how many days and when to start</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="generate-num-days" className="text-sm font-medium text-foreground mb-2 block">Number of posts</label>
                <input
                  id="generate-num-days"
                  type="number"
                  min={1}
                  max={30}
                  value={numDays}
                  onChange={(e) => setNumDays(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full bg-surface rounded-xl px-5 py-4 text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-lg"
                />
              </div>
              <div>
                <label htmlFor="generate-start-date" className="text-sm font-medium text-foreground mb-2 block">Start date</label>
                <input
                  id="generate-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-surface rounded-xl px-5 py-4 text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-lg"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button variant="hero" size="lg" className="flex-1 gap-2" onClick={generatePosts} disabled={generating}>
                {generating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Generate Posts
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Results */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-3xl font-bold text-foreground">Your posts are ready</h2>
              <p className="text-muted-foreground mt-2">{posts.length} posts generated • Click to edit or regenerate</p>
            </div>

            {isPreview && (
              <div className="glass rounded-2xl p-6 text-center glow-border">
                <p className="text-foreground font-medium mb-3">Sign in to see all posts & save your calendar</p>
                <Button variant="hero" onClick={() => navigate("/auth")}>Sign in to continue</Button>
              </div>
            )}

            <div className="space-y-4">
              {posts.slice(0, isPreview ? 2 : undefined).map((post, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass rounded-xl p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-primary">
                      {new Date(post.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-muted-foreground"
                      onClick={() => regeneratePost(idx)}
                      disabled={regeneratingIndex === idx}
                    >
                      <RefreshCw className={`h-3 w-3 ${regeneratingIndex === idx ? "animate-spin" : ""}`} />
                      {regeneratingIndex === idx ? "Regenerating..." : "Regenerate"}
                    </Button>
                  </div>
                  <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
                </motion.div>
              ))}
              {isPreview && posts.length > 2 && (
                <div className="text-center text-muted-foreground text-sm py-4">
                  +{posts.length - 2} more posts • Sign in to view all
                </div>
              )}
            </div>

            {!isPreview && (
              <Button variant="hero" size="lg" className="w-full gap-2" onClick={saveToCalendar}>
                <Calendar className="h-4 w-4" /> Save to Calendar
              </Button>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Generate;
