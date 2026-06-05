"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  ChevronRight, ChevronLeft, Zap, Camera, PlayCircle, Share2,
  Search, CheckCircle2, Loader2, AlertCircle, Lightbulb, Brain,
  Clock, FileText, TrendingUp, BarChart3, Target, Plus, Trash2
} from "lucide-react";

// Singleton browser supabase client (reads cookies = works after login)
const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const NICHES = ["Fitness", "Finance", "Travel", "Tech", "Food", "Beauty", "Gaming", "Education", "Lifestyle", "Comedy", "Motivation", "Fashion"];

const PHASES = [
  { id: "audit", label: "Profile Audit", icon: Search, desc: "Engagement, strengths, weaknesses" },
  { id: "competitors", label: "Competitor Analysis", icon: BarChart3, desc: "Side-by-side comparison" },
  { id: "trends", label: "Trend Research", icon: TrendingUp, desc: "Trending hooks & hashtags" },
  { id: "pipeline", label: "7-Day Content Pipeline", icon: FileText, desc: "Ready-to-post scripts" },
];

const PLATFORM_PATTERNS = {
  instagram: /instagram\.com\//i,
  youtube: /youtube\.com\/|youtu\.be\//i,
  facebook: /facebook\.com\//i,
};

function detectPlatform(url: string) {
  if (PLATFORM_PATTERNS.instagram.test(url)) return "instagram";
  if (PLATFORM_PATTERNS.youtube.test(url)) return "youtube";
  if (PLATFORM_PATTERNS.facebook.test(url)) return "facebook";
  return null;
}

function buildProfileUrl(platform: string, username: string): string {
  if (!username) return "";
  const handle = username.startsWith("@") ? username.slice(1) : username;
  switch (platform) {
    case "instagram": return `https://www.instagram.com/${handle}/`;
    case "youtube":   return `https://www.youtube.com/@${handle}`;
    case "facebook":  return `https://www.facebook.com/${handle}`;
    default:          return "";
  }
}

type AnalysisPhase = "idle" | "running" | "done" | "failed";

interface PhaseStatus {
  audit: AnalysisPhase;
  competitors: AnalysisPhase;
  trends: AnalysisPhase;
  pipeline: AnalysisPhase;
}

interface ConnectedAccount {
  platform: string;
  platform_username: string;
  platform_user_id: string;
  profile_url?: string;
}

export default function AnalyzePage() {
  const [step, setStep] = useState(1);
  const [profileUrl, setProfileUrl] = useState("");
  const [platformDetected, setPlatformDetected] = useState<string | null>(null);
  const [urlError, setUrlError] = useState("");
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);

  // Competitors
  const [competitorMode, setCompetitorMode] = useState<"known" | "discover" | "skip">("discover");
  const [competitorUrls, setCompetitorUrls] = useState(["", "", ""]);
  const [profession, setProfession] = useState("");
  const [resume, setResume] = useState("");

  // Niche & Language
  const [niche, setNiche] = useState("");
  const [language, setLanguage] = useState<"hi" | "en">("hi");

  // Phases
  const [selectedPhases, setSelectedPhases] = useState(["audit", "competitors", "trends", "pipeline"]);

  // Running
  const [running, setRunning] = useState(false);
  const [phaseStatus, setPhaseStatus] = useState<PhaseStatus>({ audit: "idle", competitors: "idle", trends: "idle", pipeline: "idle" });
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  // Fetch connected accounts and auto-fill URL
  useEffect(() => {
    supabaseBrowser.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: accounts } = await supabaseBrowser
        .from("connected_accounts")
        .select("platform, platform_username, platform_user_id")
        .eq("user_id", session.user.id)
        .eq("is_active", true);

      if (!accounts || accounts.length === 0) return;
      setConnectedAccounts(accounts);

      // Auto-fill: if only one account connected, fill it directly
      if (accounts.length === 1) {
        const acc = accounts[0];
        const url = buildProfileUrl(acc.platform, acc.platform_username);
        if (url) {
          setProfileUrl(url);
          setPlatformDetected(acc.platform);
        }
      }
    });
  }, []);

  const handleUrlChange = (url: string) => {
    setProfileUrl(url);
    setPlatformDetected(detectPlatform(url));
    setUrlError("");
  };

  const fillConnectedAccount = (acc: ConnectedAccount) => {
    const url = buildProfileUrl(acc.platform, acc.platform_username);
    if (url) {
      setProfileUrl(url);
      setPlatformDetected(acc.platform);
      setUrlError("");
    }
  };

  const validateStep1 = () => {
    if (!profileUrl.trim()) { setUrlError("Profile URL daalna zaroori hai"); return false; }
    if (!platformDetected) { setUrlError("Valid Instagram, YouTube ya Facebook URL daalo"); return false; }
    return true;
  };

  const addCompetitor = () => {
    if (competitorUrls.length < 3) setCompetitorUrls([...competitorUrls, ""]);
  };
  const updateCompetitor = (i: number, val: string) => {
    const updated = [...competitorUrls]; updated[i] = val; setCompetitorUrls(updated);
  };
  const removeCompetitor = (i: number) => {
    setCompetitorUrls(competitorUrls.filter((_, idx) => idx !== i));
  };

  const togglePhase = (id: string) => {
    setSelectedPhases(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const runAnalysis = async () => {
    setRunning(true);

    // Get backend URL from env
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://content-engineer-api.onrender.com";

    // Get Supabase auth token — backend uses this to identify user and fetch their API keys
    let authToken = "";
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      authToken = session?.access_token || "";
    } catch {}

    if (!authToken) {
      window.location.href = "/login?next=/analyze";
      setRunning(false);
      return;
    }

    const runPhase = async (phase: keyof PhaseStatus, endpoint: string) => {
      if (!selectedPhases.includes(phase)) return;
      setPhaseStatus(p => ({ ...p, [phase]: "running" }));
      try {
        const res = await fetch(`${backendUrl}/api/analyze/${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            profileUrl,
            platform: platformDetected,
            niche,
            language,
            competitors: competitorMode === "known" ? competitorUrls.filter(Boolean) : [],
            profession: competitorMode === "discover" ? profession : "",
            resume: competitorMode === "discover" ? resume : "",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error || `Phase ${phase} failed`);
        }
        setPhaseStatus(p => ({ ...p, [phase]: "done" }));
      } catch (err: any) {
        console.error(`Phase ${phase} failed:`, err.message);
        setPhaseStatus(p => ({ ...p, [phase]: "failed" }));
      }
    };

    try {
      await runPhase("audit", "audit");
      await runPhase("competitors", "competitors");
      await runPhase("trends", "trends");
      await runPhase("pipeline", "pipeline");

      const id = `analysis_${Date.now()}`;
      setAnalysisId(id);
    } catch {
      setRunning(false);
    }
  };

  const PlatformIcon = platformDetected === "youtube" ? PlayCircle : platformDetected === "facebook" ? Share2 : Camera;

  // Running view
  if (running) {
    const allDone = Object.values(phaseStatus).every(s => s === "done" || s === "idle");
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-heading text-2xl font-bold mb-2">
            {allDone ? "Tera content strategy tayyar hai! 🎉" : "Tumhara content analyze ho raha hai..."}
          </h1>
          {!allDone && (
            <p className="text-muted-foreground text-sm flex items-center justify-center gap-1.5">
              <Clock className="w-4 h-4" /> ~90 seconds lagenge
            </p>
          )}
        </div>

        <div className="space-y-3">
          {PHASES.map((phase) => {
            const status = phaseStatus[phase.id as keyof PhaseStatus];
            if (!selectedPhases.includes(phase.id)) return null;
            return (
              <div
                key={phase.id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  status === "running"
                    ? "border-amber-400/40 bg-amber-400/5 stepper-active"
                    : status === "done"
                    ? "border-green-400/40 bg-green-400/5"
                    : "border-border bg-card opacity-50"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  status === "done" ? "stepper-done" : status === "running" ? "border-2 border-amber-400" : "bg-muted"
                }`}>
                  {status === "done" ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : status === "running" ? (
                    <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                  ) : (
                    <phase.icon className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium text-sm ${status === "running" ? "text-amber-600 dark:text-amber-400" : ""}`}>
                    {phase.label}
                    {status === "running" && " chal raha hai..."}
                    {status === "done" && " ✓"}
                  </p>
                  <p className="text-xs text-muted-foreground">{phase.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {allDone && analysisId && (
          <div className="mt-8 text-center">
            <a href={`/results/${analysisId}`} className="btn-amber px-8 py-3.5 rounded-xl font-bold text-base inline-flex items-center gap-2">
              Results Dekho <ChevronRight className="w-5 h-5" />
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold mb-1">Naya Analysis</h1>
        <p className="text-muted-foreground text-sm">Step {step} of 5</p>
        {/* Step progress */}
        <div className="flex gap-1.5 mt-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                s < step ? "amber-gradient" : s === step ? "bg-amber-400/50" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── STEP 1: Profile URL ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-xl font-semibold mb-1">Apna profile URL daalo</h2>
            <p className="text-sm text-muted-foreground">Instagram, YouTube ya Facebook — koi bhi platform</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="profile-url" className="block text-sm font-medium">Profile URL</label>
            <div className="relative">
              <input
                id="profile-url"
                type="url"
                placeholder="https://www.instagram.com/your_handle/"
                value={profileUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className={`w-full px-4 py-3 pr-12 rounded-xl border text-sm bg-background focus:outline-none focus:ring-2 transition-all ${
                  urlError ? "border-red-400 focus:ring-red-300" : "border-border focus:border-ring focus:ring-ring/30"
                }`}
              />
              {platformDetected && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <PlatformIcon className="w-5 h-5 text-amber-500" />
                </div>
              )}
            </div>
            {urlError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {urlError}
              </p>
            )}
            {platformDetected && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {platformDetected.charAt(0).toUpperCase() + platformDetected.slice(1)} profile detected
              </p>
            )}
          </div>

          {/* Connected accounts — quick select */}
          {connectedAccounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Connected Accounts — click karke fill karo:</p>
              <div className="flex flex-wrap gap-2">
                {connectedAccounts.map((acc) => {
                  const Icon = acc.platform === "instagram" ? Camera : acc.platform === "youtube" ? PlayCircle : Share2;
                  const isSelected = platformDetected === acc.platform && profileUrl.includes(acc.platform_username || "");
                  return (
                    <button
                      key={acc.platform}
                      onClick={() => fillConnectedAccount(acc)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                        isSelected
                          ? "border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400"
                          : "border-border bg-muted/30 hover:border-amber-400/50 hover:bg-amber-400/5"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="capitalize">{acc.platform}</span>
                      {acc.platform_username && (
                        <span className="text-muted-foreground">@{acc.platform_username}</span>
                      )}
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-amber-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Platform quick-fill buttons (always shown) */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { platform: "instagram", label: "Instagram", icon: Camera, example: "instagram.com/handle" },
              { platform: "youtube", label: "YouTube", icon: PlayCircle, example: "youtube.com/@channel" },
              { platform: "facebook", label: "Facebook", icon: Share2, example: "facebook.com/page" },
            ].map((p) => {
              const isConnected = connectedAccounts.some(a => a.platform === p.platform);
              return (
                <button
                  key={p.platform}
                  onClick={() => handleUrlChange(`https://www.${p.example}`)}
                  className={`relative p-3 rounded-xl border text-center transition-all text-xs ${
                    isConnected ? "border-amber-400/40 bg-amber-400/5" : "border-border bg-muted/30 hover:border-foreground/30"
                  }`}
                >
                  {isConnected && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background" />
                  )}
                  <p.icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="font-medium">{p.label}</p>
                  {isConnected && <p className="text-[10px] text-amber-600 dark:text-amber-400">Connected</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 2: Competitors / Niche Discovery ── */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-xl font-semibold mb-1">Competitors (Optional)</h2>
            <p className="text-sm text-muted-foreground">Agar competitors pata hain to daalo, warna AI dhundh dega</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => setCompetitorMode("known")}
              className={`p-4 rounded-xl border text-left transition-all ${
                competitorMode === "known" ? "border-amber-400/60 bg-amber-400/8" : "border-border hover:border-foreground/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${competitorMode === "known" ? "border-amber-400" : "border-muted-foreground"}`}>
                  {competitorMode === "known" && <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />}
                </div>
                <div>
                  <p className="font-medium text-sm">Main competitors ka URL jaanta hoon</p>
                  <p className="text-xs text-muted-foreground">Seedha competitor profiles daalo (max 3)</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setCompetitorMode("discover")}
              className={`p-4 rounded-xl border text-left transition-all ${
                competitorMode === "discover" ? "border-amber-400/60 bg-amber-400/8" : "border-border hover:border-foreground/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${competitorMode === "discover" ? "border-amber-400" : "border-muted-foreground"}`}>
                  {competitorMode === "discover" && <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">Mujhe nahi pata — Niche Discovery use karo</p>
                    <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black text-[10px] font-bold">NEW</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Apna profession batao, AI automatically competitors dhundh dega aur niche suggest karega</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setCompetitorMode("skip")}
              className={`p-4 rounded-xl border text-left transition-all ${
                competitorMode === "skip" ? "border-muted-foreground/40 bg-muted/30" : "border-border hover:border-foreground/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${competitorMode === "skip" ? "border-muted-foreground" : "border-muted-foreground/40"}`}>
                  {competitorMode === "skip" && <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />}
                </div>
                <p className="font-medium text-sm">Skip — sirf mera profile analyze karo</p>
              </div>
            </button>
          </div>

          {/* Known competitors URLs */}
          {competitorMode === "known" && (
            <div className="space-y-3">
              {competitorUrls.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="url"
                    placeholder={`Competitor ${i + 1} URL`}
                    value={url}
                    onChange={(e) => updateCompetitor(i, e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
                  />
                  {i > 0 && (
                    <button onClick={() => removeCompetitor(i)} className="p-2.5 rounded-xl border border-border hover:border-red-400/50 hover:text-red-500 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {competitorUrls.length < 3 && (
                <button onClick={addCompetitor} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
                  <Plus className="w-4 h-4" /> Add another competitor
                </button>
              )}
            </div>
          )}

          {/* Niche Discovery form */}
          {competitorMode === "discover" && (
            <div className="space-y-4 p-5 rounded-2xl border border-amber-400/20 bg-amber-400/5">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                <Lightbulb className="w-4 h-4" />
                Niche Discovery — AI se puchhte hain
              </div>
              <div className="space-y-1.5">
                <label htmlFor="profession" className="block text-sm font-medium">
                  Tumhara profession / experience <span className="text-amber-500">*</span>
                </label>
                <textarea
                  id="profession"
                  placeholder="Jaise: Fitness trainer hoon, 5 saal ka experience hai. Mainly weight loss aur muscle building pe kaam karta hoon. Abhi tak offline clients handle kiye hain..."
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/30 transition resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="resume" className="block text-sm font-medium flex items-center gap-1.5">
                  Resume ya bio <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  id="resume"
                  placeholder="Optional: Apni background, skills, achievements paste karo..."
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/30 transition resize-none"
                />
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Brain className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                AI tumhara profile data + yeh information milake niche suggest karega, target audience identify karega, aur top 3 competitors automatically dhundh dega.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Niche + Language ── */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-xl font-semibold mb-1">Niche aur Language</h2>
            <p className="text-sm text-muted-foreground">AI iske hisaab se content generate karega</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="niche-select" className="block text-sm font-medium">Tumhara niche</label>
            <select
              id="niche-select"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
            >
              <option value="">Niche chuniye</option>
              {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium">Content language</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLanguage("hi")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  language === "hi" ? "border-amber-400/60 bg-amber-400/8" : "border-border hover:border-foreground/30"
                }`}
              >
                <p className="text-2xl mb-1">🇮🇳</p>
                <p className="font-semibold text-sm">Hindi / Hinglish</p>
                <p className="text-xs text-muted-foreground">Indian creators ke liye (default)</p>
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  language === "en" ? "border-amber-400/60 bg-amber-400/8" : "border-border hover:border-foreground/30"
                }`}
              >
                <p className="text-2xl mb-1">🌐</p>
                <p className="font-semibold text-sm">English</p>
                <p className="text-xs text-muted-foreground">Pure English content</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: Select Phases ── */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-xl font-semibold mb-1">Kya analyze karna hai?</h2>
            <p className="text-sm text-muted-foreground">Sabhi selected hain by default — deselect karo agar koi chahiye nahi</p>
          </div>
          <div className="space-y-3">
            {PHASES.map((phase) => {
              const isSelected = selectedPhases.includes(phase.id);
              return (
                <button
                  key={phase.id}
                  onClick={() => togglePhase(phase.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                    isSelected ? "border-amber-400/60 bg-amber-400/8" : "border-border hover:border-foreground/30 opacity-60"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isSelected ? "btn-amber" : "bg-muted"}`}>
                    <phase.icon className={`w-5 h-5 ${isSelected ? "text-black" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{phase.label}</p>
                    <p className="text-xs text-muted-foreground">{phase.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-amber-400 border-amber-400" : "border-muted-foreground/40"}`}>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 5: Review & Run ── */}
      {step === 5 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-xl font-semibold mb-1">Review aur Run karo</h2>
            <p className="text-sm text-muted-foreground">Sab theek lagta hai? Analysis shuru karo!</p>
          </div>

          <div className="space-y-3 p-5 rounded-2xl bg-muted/30 border border-border">
            <div className="flex items-center justify-between text-sm py-2 border-b border-border">
              <span className="text-muted-foreground">Profile URL</span>
              <span className="font-medium truncate max-w-48 text-right">{profileUrl}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-2 border-b border-border">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-medium capitalize">{platformDetected || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-2 border-b border-border">
              <span className="text-muted-foreground">Mode</span>
              <span className="font-medium">{competitorMode === "discover" ? "Niche Discovery ✨" : competitorMode === "known" ? "Known competitors" : "Profile only"}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-2 border-b border-border">
              <span className="text-muted-foreground">Niche</span>
              <span className="font-medium">{niche || "Not specified"}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-2 border-b border-border">
              <span className="text-muted-foreground">Language</span>
              <span className="font-medium">{language === "hi" ? "Hindi / Hinglish 🇮🇳" : "English 🌐"}</span>
            </div>
            <div className="flex items-start justify-between text-sm py-2">
              <span className="text-muted-foreground">Phases</span>
              <div className="text-right space-y-0.5">
                {selectedPhases.map(p => <p key={p} className="font-medium text-xs">{PHASES.find(ph => ph.id === p)?.label}</p>)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-400/8 border border-amber-400/20 text-xs text-muted-foreground">
            <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
            Analysis ~90 seconds mein complete hogi. API keys securely server pe stored hain — koi bhi key network mein nahi jayegi.
          </div>

          <button
            id="run-analysis-btn"
            onClick={runAnalysis}
            className="btn-amber w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Analyze shuru karo
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
            step === 1 ? "opacity-40 cursor-not-allowed border-border" : "border-border hover:border-foreground/30 hover:bg-muted/50"
          }`}
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {step < 5 && (
          <button
            onClick={() => {
              if (step === 1 && !validateStep1()) return;
              setStep(step + 1);
            }}
            className="btn-amber px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
