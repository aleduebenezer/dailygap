import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Calendar, Sparkles, Plus, X, RefreshCw } from "lucide-react";
import { handleAiError } from "@/lib/handleAiError";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { ProfileAvatarMenu } from "@/components/ProfileAvatarMenu";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getHashtagsEnabled } from "@/lib/userPreferences";
import { saveLocalCalendar } from "@/lib/localCalendarStore";
import { recordAiUsage } from "@/lib/aiUsageStore";

const Generate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAiRestricted } = useAuth();

  const locationState = location.state as any;

  // Retrieve pending generation data from location state, sessionStorage, or localStorage
  const getPendingGenData = () => {
    if (locationState?.posts?.length) return locationState;
    try {
      const s = sessionStorage.getItem("pendingGenerateData");
      if (s) {
        const p = JSON.parse(s);
        if (p?.posts?.length || p?.niche) return p;
      }
    } catch (_e) {
      // ignore
    }
    try {
      const l = localStorage.getItem("pendingGenerateData");
      if (l) {
        const p = JSON.parse(l);
        if (p?.posts?.length || p?.niche) return p;
      }
    } catch (_e) {
      // ignore
    }
    return null;
  };

  const restoredData = getPendingGenData();
  const initialNiche = locationState?.niche || restoredData?.niche || sessionStorage.getItem("pendingNiche") || localStorage.getItem("pendingNiche") || "";

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

  // Sync niche to storage whenever updated
  useEffect(() => {
    if (niche.trim()) {
      sessionStorage.setItem("pendingNiche", niche);
      localStorage.setItem("pendingNiche", niche);
    }
  }, [niche]);

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
    if (isAiRestricted) {
      toast.error("Your account has been restricted from using AI generation features by an Administrator. You can still manually create and schedule posts.");
      return;
    }
    setGenerating(true);
    try {
      const hashtagsEnabled = await getHashtagsEnabled(user?.id);
      let postsResult: any[] | null = null;

      try {
        const { data, error } = await supabase.functions.invoke("generate-posts", {
          body: {
            niche,
            samples: samples.filter((s) => s.trim()),
            numDays,
            startDate,
            hashtagsEnabled,
          },
        });
        if (!error && data?.posts) {
          postsResult = data.posts;
        }
      } catch (edgeErr) {
        console.warn("Supabase edge function notice, falling back to server API:", edgeErr);
      }

      if (!postsResult || postsResult.length === 0) {
        const resp = await fetch("/api/generate-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            niche,
            samples: samples.filter((s) => s.trim()),
            numDays,
            startDate,
            hashtagsEnabled,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (data?.posts) {
          postsResult = data.posts;
        }
      }

      if (!postsResult || postsResult.length === 0) {
        throw new Error("Failed to generate posts. Please try again.");
      }

      setPosts(postsResult);
      setStep(3);

      const genDataToStore = {
        niche,
        samples: samples.filter((s) => s.trim()),
        numDays,
        startDate,
        posts: postsResult,
        timestamp: Date.now(),
      };
      sessionStorage.setItem("pendingGenerateData", JSON.stringify(genDataToStore));
      localStorage.setItem("pendingGenerateData", JSON.stringify(genDataToStore));

      if (user?.id) {
        void recordAiUsage(user.id, postsResult?.length || numDays || 1);
      }
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
      let newContent: string | null = null;

      try {
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
        if (!error && data?.posts?.[0]?.content) {
          newContent = data.posts[0].content;
        }
      } catch (edgeErr) {
        console.warn("Supabase edge function notice, using server API fallback:", edgeErr);
      }

      if (!newContent) {
        const resp = await fetch("/api/generate-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            niche,
            samples: samples.filter((s) => s.trim()),
            numDays: 1,
            startDate: posts[index].date,
            hashtagsEnabled,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (data?.posts?.[0]?.content) {
          newContent = data.posts[0].content;
        }
      }

      if (!newContent) throw new Error("Failed to regenerate post.");

      const updated = [...posts];
      updated[index] = { ...updated[index], content: newContent };
      setPosts(updated);
      toast.success("Post regenerated!");

      const genDataToStore = {
        niche,
        samples: samples.filter((s) => s.trim()),
        numDays,
        startDate,
        posts: updated,
        timestamp: Date.now(),
      };
      sessionStorage.setItem("pendingGenerateData", JSON.stringify(genDataToStore));
      localStorage.setItem("pendingGenerateData", JSON.stringify(genDataToStore));

      if (user?.id) {
        void recordAiUsage(user.id, 1);
      }
    } catch (err: any) {
      handleAiError(err, "Failed to regenerate");
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const saveToCalendar = async () => {
    const userId = user?.id || "user_dailygap_local";
    const taggedPosts = posts.map((p) => ({ ...p, niche }));

    try {
      let dbSaveSuccess = false;

      // Try fetching existing calendars from Supabase
      const { data: existing, error: fetchErr } = await supabase
        .from("calendars")
        .select("*")
        .eq("user_id", userId);

      if (!fetchErr && existing) {
        const dateToCalendar = new Map<string, { id: string; posts: any[] }>();
        existing.forEach((cal: any) => {
          (cal.posts || []).forEach((p: any) => {
            if (!dateToCalendar.has(p.date)) {
              dateToCalendar.set(p.date, { id: cal.id, posts: cal.posts });
            }
          });
        });

        const mergeMap = new Map<string, any[]>();
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

        let hasError = false;

        for (const [calId, addPosts] of mergeMap) {
          const cal = existing.find((c: any) => c.id === calId);
          if (!cal) continue;
          const merged = [...(cal as any).posts, ...addPosts];
          const { error } = await supabase
            .from("calendars")
            .update({ posts: merged as any })
            .eq("id", calId);
          if (error) {
            hasError = true;
            break;
          }
        }

        if (!hasError && newPosts.length > 0) {
          const { error } = await supabase.from("calendars").insert({
            user_id: userId,
            niche,
            start_date: startDate,
            posts: newPosts as any,
          });
          if (!error) {
            dbSaveSuccess = true;
          }
        } else if (!hasError) {
          dbSaveSuccess = true;
        }
      }

      if (!dbSaveSuccess) {
        saveLocalCalendar(userId, {
          niche,
          start_date: startDate,
          posts: taggedPosts,
        });
      }

      sessionStorage.removeItem("pendingGenerateData");
      localStorage.removeItem("pendingGenerateData");
      toast.success("Calendar saved!");
      navigate("/dashboard");
    } catch (err: any) {
      console.warn("DB save notice, saving locally:", err);
      saveLocalCalendar(userId, {
        niche,
        start_date: startDate,
        posts: taggedPosts,
      });
      sessionStorage.removeItem("pendingGenerateData");
      localStorage.removeItem("pendingGenerateData");
      toast.success("Calendar saved!");
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Generate your LinkedIn content calendar | Daily Gap"
        description="Build a personalized LinkedIn content calendar in three steps — share your niche, paste writing samples, pick your schedule, and let Daily Gap's AI write posts in your voice."
        path="/generate"
      />
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-5xl mx-auto w-full">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => navigate("/dashboard")}
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 sm:gap-3">
          <ProfileAvatarMenu />
        </div>
      </header>

      <h1 className="sr-only">Generate your LinkedIn content calendar</h1>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-20 w-full">
        {isAiRestricted && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300 text-sm flex items-start gap-3 shadow-sm">
            <Sparkles className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">AI Generation Restricted</p>
              <p className="text-xs mt-0.5 leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                Your account has been restricted from generating posts using AI features by an Administrator. You can still manually create, schedule, edit, and publish posts on your dashboard.
              </p>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8 sm:mb-10">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? "w-10 sm:w-12 bg-primary" : s < step ? "w-6 sm:w-8 bg-primary/50" : "w-6 sm:w-8 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Niche */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Tell us about you</h2>
              <p className="text-muted-foreground text-sm sm:text-base mt-2">What's your niche, role, or expertise?</p>
            </div>

            <input
              id="generate-niche"
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. B2B SaaS founder, AI researcher, fitness coach"
              aria-label="Your niche, role, or expertise"
              className="w-full bg-surface rounded-xl px-4 sm:px-5 py-3 sm:py-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base sm:text-lg"
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-medium text-foreground">Writing samples (optional)</label>
                {samples.length < 4 && (
                  <button onClick={addSample} className="text-primary text-xs sm:text-sm flex items-center gap-1 hover:underline">
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
                    className="w-full bg-surface rounded-xl px-4 sm:px-5 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
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
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Set your schedule</h2>
              <p className="text-muted-foreground text-sm sm:text-base mt-2">Choose how many days and when to start</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="generate-num-days" className="text-xs sm:text-sm font-medium text-foreground mb-2 block">Number of posts</label>
                <input
                  id="generate-num-days"
                  type="number"
                  min={1}
                  max={30}
                  value={numDays}
                  onChange={(e) => setNumDays(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full bg-surface rounded-xl px-4 sm:px-5 py-3 sm:py-4 text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base sm:text-lg"
                />
              </div>
              <div>
                <label htmlFor="generate-start-date" className="text-xs sm:text-sm font-medium text-foreground mb-2 block">Start date</label>
                <input
                  id="generate-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-surface rounded-xl px-4 sm:px-5 py-3 sm:py-4 text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base sm:text-lg"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" size="lg" className="w-full sm:flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button variant="hero" size="lg" className="w-full sm:flex-1 gap-2" onClick={generatePosts} disabled={generating}>
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
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Your posts are ready</h2>
              <p className="text-muted-foreground text-xs sm:text-sm mt-2">{posts.length} posts generated • Click to edit or regenerate</p>
            </div>

            <div className="space-y-4">
              {posts.map((post, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass rounded-xl p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <span className="text-xs sm:text-sm font-medium text-primary">
                      {new Date(post.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-muted-foreground text-xs"
                      onClick={() => regeneratePost(idx)}
                      disabled={regeneratingIndex === idx}
                    >
                      <RefreshCw className={`h-3 w-3 ${regeneratingIndex === idx ? "animate-spin" : ""}`} />
                      {regeneratingIndex === idx ? "Regenerating..." : "Regenerate"}
                    </Button>
                  </div>
                  <p className="text-foreground text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
                </motion.div>
              ))}
            </div>

            <Button variant="hero" size="lg" className="w-full gap-2" onClick={saveToCalendar}>
              <Calendar className="h-4 w-4" /> Save to Calendar
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Generate;
