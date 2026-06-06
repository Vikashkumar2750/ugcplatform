"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  Download, Copy, ExternalLink, FileText, BarChart3,
  TrendingUp, Calendar, Zap, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, ThumbsUp, Loader2,
  Target, Hash, Music, Lightbulb, ArrowRight, Star, RefreshCw
} from "lucide-react";

const TABS = [
  { id: "audit", label: "Profile Audit", icon: BarChart3 },
  { id: "competitors", label: "Competitor Analysis", icon: Target },
  { id: "trends", label: "Trend Report", icon: TrendingUp },
  { id: "pipeline", label: "Content Pipeline", icon: FileText },
  { id: "schedule", label: "Posting Schedule", icon: Calendar },
];

interface AnalysisData {
  id: string;
  profileUrl: string;
  platform: string;
  niche: string;
  language: string;
  createdAt: string;
  audit?: any;
  competitors?: any;
  trends?: any;
  pipeline?: any;
  _meta?: { provider: string; model: string; dataSource: string };
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? "text-green-400" : score >= 45 ? "text-amber-400" : "text-red-400";
  return (
    <div className={`text-5xl font-heading font-extrabold ${color}`}>
      {score}<span className="text-2xl">/100</span>
    </div>
  );
}

// ── ER display: cap at 50% for micro-accounts with unrealistic values ──────────
function formatER(er: number | string | undefined): { display: string; capped: boolean } {
  if (er === undefined || er === null || er === "") return { display: "—", capped: false };
  const raw = typeof er === "string" ? parseFloat(er.replace("%", "")) : er;
  if (isNaN(raw)) return { display: String(er), capped: false };
  if (raw > 50) return { display: `${(50).toFixed(1)}%`, capped: true };
  return { display: `${raw.toFixed(2)}%`, capped: false };
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("audit");
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  // ── Per-tab regenerate ─────────────────────────────────────────────────────
  const regenerateTab = async (tab: string) => {
    if (!data) return;
    setRegenerating(tab);
    setRegenError(null);
    try {
      const sb = createSupabaseClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Session expired — please refresh the page and try again");

      const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://content-engineer-api.onrender.com";
      const endpointMap: Record<string, string> = {
        audit: "audit", competitors: "competitors", trends: "trends", pipeline: "pipeline",
      };
      const endpoint = endpointMap[tab];
      if (!endpoint) throw new Error("Unknown tab");

      const res = await fetch(`${BACKEND}/api/analyze/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({
          profileUrl: data.profileUrl || window.location.pathname.split("/").pop(),
          platform: data.platform,
          niche: data.niche,
          language: data.language || "hi",
          // Extract competitor usernames from either full response or AI JSON format
          competitors: (
            (data.competitors as any)?.competitors?.map((c: any) => c.username || c.handle).filter(Boolean) ||
            (Array.isArray((data.competitors as any)?.scrapedStats)
              ? (data.competitors as any).scrapedStats.map((c: any) => c.username).filter(Boolean)
              : [])
          ),
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Backend error ${res.status}: ${errBody.substring(0, 200)}`);
      }
      const json = await res.json();
      if (!json || typeof json !== "object") throw new Error("Invalid response from server");

      // BUG-FIX: For competitors tab, store the FULL response (preserves scrapedStats, dataQuality etc.)
      // For other tabs, store just the tab data
      const newTabData = tab === "competitors"
        ? json  // Full response object: { success, competitors, scrapedStats, dataQuality, ... }
        : (json[tab] ?? json["resultData"] ?? json);
      if (!newTabData || typeof newTabData !== "object") {
        throw new Error(`Empty ${tab} data returned. Try again or re-run full analysis.`);
      }

      // Safe merge into existing data
      const updated: AnalysisData = { ...data, [tab]: newTabData };
      setData(updated);

      // Update localStorage
      const id = params?.id as string;
      localStorage.setItem(`analysis_${id}`, JSON.stringify(updated));
      localStorage.setItem(id, JSON.stringify(updated));
    } catch (err: any) {
      setRegenError(err.message || "Regeneration failed");
    } finally {
      setRegenerating(null);
    }
  };

  useEffect(() => {
    (async () => {
      const id = params?.id as string;
      if (!id) { setLoading(false); return; }

      // Try multiple key patterns to handle old/new format
      const keysToTry = [
        `analysis_${id}`,
        id,
        `analysis_meta_${id}`,
      ];

      for (const key of keysToTry) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            setData(JSON.parse(stored));
            setLoading(false);
            return;
          } catch {}
        }
      }

      // Fallback: try Supabase (for cross-device / shared links)
      try {
        const sb = createSupabaseClient();
        const { data: { session } } = await sb.auth.getSession();
        if (!session) { setLoading(false); return; }
        const { data: rows } = await sb
          .from("analysis_results")
          .select("id, result_data, profile_url, platform, niche, created_at")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (rows) {
          const match = rows.find((r: any) =>
            r.result_data?.id === id ||
            r.result_data?.id === `analysis_${id}` ||
            r.id === id
          );
          if (match) {
            const record = {
              id,
              profileUrl: match.profile_url,
              platform: match.platform,
              niche: match.niche,
              createdAt: match.created_at,
              ...(match.result_data || {}),
            };
            localStorage.setItem(`analysis_${id}`, JSON.stringify(record));
            setData(record);
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, [params?.id]);



  const copyAll = () => {
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // PDF export — opens print dialog with formatted content
  const exportPDF = () => {
    if (!data) return;
    const printContent = buildPrintableContent(data);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
      <head>
        <title>Content Analysis — ${data?.profileUrl || data?.platform || "Analysis"}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; color: #111; line-height: 1.6; }
          h1 { font-size: 1.5rem; font-weight: 800; margin-bottom: 0.25rem; }
          h2 { font-size: 1rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.75rem; border-bottom: 2px solid #f59e0b; padding-bottom: 0.25rem; color: #b45309; }
          h3 { font-size: 0.875rem; font-weight: 700; color: #555; margin: 1rem 0 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
          p, li { font-size: 0.9rem; }
          ul { padding-left: 1.2rem; }
          .meta { color: #888; font-size: 0.8rem; margin-bottom: 2rem; }
          .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 1rem 0; }
          .stat { background: #fef9c3; padding: 0.75rem; border-radius: 8px; text-align: center; }
          .stat-val { font-size: 1.4rem; font-weight: 800; color: #b45309; }
          .stat-label { font-size: 0.7rem; color: #888; }
          .section { margin: 1.5rem 0; padding: 1rem; background: #f9fafb; border-radius: 8px; border-left: 4px solid #f59e0b; }
          .tag { display: inline-block; background: #fef3c7; color: #92400e; padding: 0.2rem 0.6rem; border-radius: 100px; font-size: 0.75rem; margin: 0.2rem; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>${printContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  // Google Doc export — opens a new Google Doc pre-filled with content
  const exportGoogleDoc = () => {
    if (!data) return;
    const text = buildPlainText(data);
    // Save to clipboard then open Google Docs — user pastes
    navigator.clipboard.writeText(text).then(() => {
      const docUrl = "https://docs.google.com/document/create";
      window.open(docUrl, "_blank");
      alert("Content copied to clipboard! Google Docs tab khul gaya — Ctrl+V se paste karo");
    });
  };

  // Google Sheet export — post to user's saved sheet (from settings)
  const exportToSheet = async () => {
    if (!data) return;
    const sheetUrl = localStorage.getItem("ce_export_sheet_url");
    if (!sheetUrl) {
      alert("Settings mein pehle Google Sheet URL save karo!");
      router.push("/settings");
      return;
    }
    // Try Google Apps Script webhook if set
    const webhookUrl = localStorage.getItem("ce_export_webhook_url");
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, timestamp: new Date().toISOString() }),
        });
        alert("Sheet mein export ho gaya!");
      } catch { alert("Sheet export failed — manually copy karo"); }
    } else {
      window.open(sheetUrl, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading your analysis...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <BarChart3 className="w-12 h-12 text-muted-foreground/40" />
        <h1 className="font-heading text-xl font-bold">Analysis not found</h1>
        <p className="text-muted-foreground text-sm">Yeh analysis expire ho gayi ya exist nahi karti</p>
        <button onClick={() => router.push("/analyze")} className="btn-amber px-6 py-2.5 rounded-xl text-sm font-bold">
          Naya Analysis Karo
        </button>
      </div>
    );
  }

  const audit = data.audit;
  const competitors = data.competitors;
  const trends = data.trends;
  const pipeline = data.pipeline;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-card">
        <div>
          <h1 className="font-heading text-xl font-bold">Analysis Results</h1>
          <p className="text-xs text-muted-foreground capitalize">
            {data.platform} · {data.niche || "General"} · {data.language === "hi" ? "Hinglish" : "English"}
            {data._meta && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[10px]">
                via {data._meta.provider} · {data._meta.dataSource?.replace("_", " ")}
              </span>
            )}
          </p>
        </div>
        <button onClick={() => router.push("/analyze")}
          className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" /> Naya Analysis
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-border bg-card px-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`result-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-amber-400 text-amber-600 dark:text-amber-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.id === "audit" && audit && <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-1" />}
            {tab.id === "competitors" && competitors && <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-1" />}
            {tab.id === "trends" && trends && <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-1" />}
            {tab.id === "pipeline" && pipeline && <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-1" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">

        {/* Regen error banner */}
        {regenError && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-400/30 bg-red-400/10 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-400">{regenError}</span>
            <button onClick={() => setRegenError(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}

        {/* ── Profile Audit Tab ─────────────────────────────────────────── */}
        {activeTab === "audit" && (
          <div className="space-y-5">
            <RegenBar tab="audit" regenerating={regenerating} onRegen={regenerateTab} />
            {!audit ? (
              <EmptyState tab="Profile Audit" />
            ) : (
              <>
                {/* Key metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1 p-5 rounded-2xl border border-amber-400/30 bg-amber-400/5 space-y-2">
                    <p className="text-xs text-muted-foreground">Engagement Rate</p>
                    {(() => {
                      const { display, capped } = formatER(audit.engagementRate);
                      return (
                        <>
                          <p className="text-4xl font-heading font-extrabold text-gradient">{display}</p>
                          {capped && (
                            <p className="text-[10px] text-amber-500">⚠ Raw ER &gt;50% — micro-account, capped for display</p>
                          )}
                        </>
                      );
                    })()}
                    <p className="text-xs text-muted-foreground">{audit.benchmark}</p>
                  </div>
                  <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                    {[
                      { label: "Followers", value: audit.followerCount || "—" },
                      { label: "Avg Likes", value: audit.avgLikes || "—" },
                      { label: "Avg Comments", value: audit.avgComments || "—" },
                      { label: "Posts Analyzed", value: audit.postsAnalyzed ?? "—" },
                    ].map((stat) => (
                      <div key={stat.label} className="p-3 rounded-xl border border-border bg-card text-center">
                        <p className="font-heading font-bold text-xl">{stat.value}</p>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overall Score */}
                {audit.overallScore != null && (
                  <div className="p-5 rounded-2xl border border-border bg-card flex items-center gap-6">
                    <ScoreRing score={audit.overallScore} />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Overall Score</p>
                      <p className="font-medium text-sm">{audit.topRecommendation}</p>
                      {audit.dataSource && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Data: {audit.dataSource.replace("_", " ")} ✓
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl border border-green-400/20 bg-green-400/5">
                    <div className="flex items-center gap-2 text-sm font-bold text-green-600 dark:text-green-400 mb-3">
                      <ThumbsUp className="w-4 h-4" /> Kya sahi chal raha hai
                    </div>
                    <div className="space-y-2">
                      {(audit.strengths || []).map((s: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl border border-red-400/20 bg-red-400/5">
                    <div className="flex items-center gap-2 text-sm font-bold text-red-500 mb-3">
                      <AlertTriangle className="w-4 h-4" /> Kya galat ho raha hai
                    </div>
                    <div className="space-y-2">
                      {(audit.weaknesses || []).map((w: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="w-4 h-4 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center text-xs flex-shrink-0 mt-0.5 font-bold">✗</span>
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Diagnosis */}
                {audit.diagnosis && (
                  <div className="p-5 rounded-2xl border border-border bg-card">
                    <p className="text-sm font-bold mb-4">Seedha Diagnosis</p>
                    <div className="space-y-3">
                      {Object.entries(audit.diagnosis).map(([key, val]) => (
                        <div key={key} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                          <span className="text-xs text-muted-foreground capitalize w-36 flex-shrink-0 mt-0.5">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                          <span className="text-sm">{val as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Competitor Analysis Tab ───────────────────────────────────── */}
        {activeTab === "competitors" && (
          <div className="space-y-5">
            <RegenBar tab="competitors" regenerating={regenerating} onRegen={regenerateTab} />
            {!competitors ? (
              <EmptyState tab="Competitor Analysis" />
            ) : (
              <CompetitorsTab competitors={competitors} />
            )}
          </div>
        )}

        {/* ── Trend Report Tab ─────────────────────────────────────────── */}
        {activeTab === "trends" && (
          <div className="space-y-5">
            <RegenBar tab="trends" regenerating={regenerating} onRegen={regenerateTab} />
            {!trends ? (
              <EmptyState tab="Trend Report" />
            ) : (
              <>
                {/* Trending formats */}
                {trends.trendingFormats?.length > 0 && (
                  <div className="p-5 rounded-2xl border border-border bg-card">
                    <p className="text-sm font-bold mb-4">Trending Formats</p>
                    <div className="space-y-3">
                      {trends.trendingFormats.map((fmt: any, i: number) => (
                        <div key={i} className="flex items-center gap-4 py-2.5 border-b border-border last:border-0">
                          <span className="w-6 h-6 rounded-full bg-muted text-xs font-bold flex items-center justify-center">{i + 1}</span>
                          <div className="flex-1">
                            <span className="text-sm font-medium">{fmt.format}</span>
                            {fmt.whyItWorks && <p className="text-xs text-muted-foreground mt-0.5">{fmt.whyItWorks}</p>}
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{fmt.type}</span>
                          <span className="text-xs font-bold text-green-500">{fmt.growth}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending topics */}
                {trends.trendingTopics?.length > 0 && (
                  <div className="p-5 rounded-2xl border border-border bg-card">
                    <p className="text-sm font-bold mb-4">Trending Topics</p>
                    <div className="space-y-2">
                      {trends.trendingTopics.map((topic: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 py-1.5">
                          <span className="flex-1 text-sm">{topic.topic}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${topic.searchVolume === "High" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>{topic.searchVolume}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${topic.competition === "Low" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>{topic.competition} competition</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hashtags */}
                {trends.trendingHashtags?.length > 0 && (
                  <div className="p-5 rounded-2xl border border-border bg-card">
                    <p className="text-sm font-bold mb-3 flex items-center gap-2"><Hash className="w-4 h-4" /> Trending Hashtags</p>
                    <div className="flex flex-wrap gap-2">
                      {trends.trendingHashtags.map((tag: string) => (
                        <span key={tag} className="px-3 py-1.5 rounded-full bg-muted text-sm font-medium hover:bg-amber-400/10 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audio */}
                {trends.trendingAudio?.length > 0 && trends.trendingAudio[0]?.includes?.("applicable") !== true && (
                  <div className="p-5 rounded-2xl border border-border bg-card">
                    <p className="text-sm font-bold mb-3 flex items-center gap-2"><Music className="w-4 h-4" /> Trending Audio</p>
                    <div className="space-y-1.5">
                      {trends.trendingAudio.map((audio: string, i: number) => (
                        <p key={i} className="text-sm">🎵 {audio}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Seasonal + Hook formulas */}
                {trends.seasonalOpportunity && (
                  <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
                    <p className="text-xs font-bold text-amber-500 mb-1.5">🗓 Seasonal Opportunity</p>
                    <p className="text-sm">{trends.seasonalOpportunity}</p>
                  </div>
                )}

                {trends.viralHookFormulas?.length > 0 && (
                  <div className="p-5 rounded-2xl border border-border bg-card">
                    <p className="text-sm font-bold mb-4 flex items-center gap-2"><Lightbulb className="w-4 h-4" /> Viral Hook Formulas + Reel Scripts</p>
                    <div className="space-y-4">
                      {trends.viralHookFormulas.map((hook: any, i: number) => (
                        <HookScriptCard key={i} hook={hook} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Content Pipeline Tab ──────────────────────────────────────── */}
        {activeTab === "pipeline" && (
          <div className="space-y-5">
            <RegenBar tab="pipeline" regenerating={regenerating} onRegen={regenerateTab} />
            {!pipeline ? (
              <EmptyState tab="Content Pipeline" />
            ) : pipeline.raw ? (
              // LLM returned raw text (JSON parse failed) — show it
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
                  <p className="text-xs font-bold text-amber-500 mb-1">⚠️ AI Response (JSON parse failed)</p>
                  <p className="text-xs text-muted-foreground mb-2">The AI generated content but it couldn't be structured. Re-run the analysis to get formatted output.</p>
                </div>
                <div className="p-5 rounded-2xl border border-border bg-card">
                  <p className="text-xs font-bold text-muted-foreground mb-3">RAW AI OUTPUT (copy & use manually)</p>
                  <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">{pipeline.raw}</pre>
                </div>
              </div>
            ) : (
              <>
                {/* Debug: show what keys exist in pipeline */}
                {process.env.NODE_ENV === "development" && (
                  <div className="p-3 rounded-xl bg-muted/50 text-xs font-mono">
                    Pipeline keys: {Object.keys(pipeline).join(", ")} | Calendar weeks: {pipeline.contentCalendar?.length || 0}
                  </div>
                )}

                {/* KPIs */}
                {pipeline.kpis && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Target ER", value: pipeline.kpis.targetER },
                      { label: "Posting Freq", value: pipeline.kpis.postingFrequency },
                      { label: "Growth Target", value: pipeline.kpis.growthTarget },
                    ].map(kpi => (
                      <div key={kpi.label} className="p-3 rounded-xl border border-border bg-card text-center">
                        <p className="font-bold text-lg">{kpi.value || "—"}</p>
                        <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Content calendar */}
                {pipeline.contentCalendar?.length > 0 ? (
                  <div className="space-y-4">
                    {pipeline.contentCalendar.map((week: any) => (
                      <div key={week.week} className="p-5 rounded-2xl border border-border bg-card">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-7 h-7 rounded-xl bg-amber-400/10 text-amber-500 font-bold text-sm flex items-center justify-center">{week.week}</span>
                          <p className="text-sm font-bold">{week.theme}</p>
                        </div>
                        <div className="space-y-3">
                          {(week.posts || []).map((post: any, pi: number) => (
                            <PostCard key={pi} post={post} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Pipeline data exists but calendar is empty — show Regenerate prompt
                  <div className="p-5 rounded-2xl border border-amber-400/20 bg-amber-400/5 space-y-3">
                    <p className="text-sm font-bold text-amber-500">⚠️ Content Calendar Empty</p>
                    <p className="text-xs text-muted-foreground">
                      AI ne response diya par weeks parse nahi hue. Yeh aksar tab hota hai jab AI response bahut bada ho jaata hai ya JSON malformed ho.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(pipeline).filter(([k, v]) => v && k !== "contentCalendar").map(([k]) => (
                        <span key={k} className="text-xs px-2 py-1 rounded bg-muted">{k}</span>
                      ))}
                    </div>
                    <button
                      onClick={() => regenerateTab("pipeline")}
                      disabled={!!regenerating}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-600 dark:text-amber-400 text-sm font-bold hover:bg-amber-400/20 transition disabled:opacity-50"
                    >
                      {regenerating === "pipeline" ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Regenerating...</>
                      ) : (
                        <><RefreshCw className="w-4 h-4" /> Regenerate Pipeline</>
                      )}
                    </button>
                  </div>
                )}

                {/* Content Pillars */}
                {pipeline.contentPillars?.length > 0 && (
                  <div className="p-5 rounded-2xl border border-border bg-card">
                    <p className="text-sm font-bold mb-3">Content Pillars</p>
                    <div className="space-y-3">
                      {pipeline.contentPillars.map((pillar: any, i: number) => (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{pillar.pillar}</span>
                            <span className="text-sm font-bold text-amber-500">{pillar.percentage}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${pillar.percentage}%` }} />
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(pillar.examples || []).map((ex: string) => (
                              <span key={ex} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{ex}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Batching strategy */}
                {pipeline.batchingStrategy && (
                  <div className="p-4 rounded-xl border border-border bg-card">
                    <p className="text-xs font-bold text-muted-foreground mb-1.5">📦 Batching Strategy</p>
                    <p className="text-sm">{pipeline.batchingStrategy}</p>
                  </div>
                )}

                {/* Posting schedule */}
                {pipeline.postingSchedule && (
                  <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
                    <p className="text-xs font-bold text-amber-500 mb-2">📅 Best Posting Times</p>
                    <p className="text-sm"><strong>Days:</strong> {pipeline.postingSchedule.bestDays?.join(", ")}</p>
                    <p className="text-sm"><strong>Times:</strong> {pipeline.postingSchedule.bestTimes?.join(", ")}</p>
                    {pipeline.postingSchedule.reason && (
                      <p className="text-xs text-muted-foreground mt-1">{pipeline.postingSchedule.reason}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Posting Schedule Tab ──────────────────────────────────────── */}
        {activeTab === "schedule" && (
          <div className="space-y-5">
            <div className="p-5 rounded-2xl border border-border bg-card">
              <p className="text-sm font-bold mb-4">Optimal Posting Schedule — India</p>
              <div className="space-y-3">
                {[
                  { day: "Monday", time: "7:00 PM – 9:00 PM IST", score: "🔥 Prime time" },
                  { day: "Wednesday", time: "7:00 PM – 9:00 PM IST", score: "🔥 Prime time" },
                  { day: "Friday", time: "8:00 PM – 10:00 PM IST", score: "🔥 Best day" },
                  { day: "Saturday", time: "11:00 AM – 1:00 PM IST", score: "✓ Good" },
                  { day: "Sunday", time: "7:00 PM – 9:00 PM IST", score: "✓ Good" },
                ].map((slot) => (
                  <div key={slot.day} className="flex items-center gap-4 py-2.5 border-b border-border last:border-0">
                    <span className="w-24 text-sm font-medium">{slot.day}</span>
                    <span className="flex-1 text-sm text-muted-foreground">{slot.time}</span>
                    <span className="text-sm">{slot.score}</span>
                  </div>
                ))}
              </div>
            </div>
            {pipeline?.postingSchedule?.reason && (
              <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
                <p className="text-xs font-bold text-amber-500 mb-1">💡 AI Recommendation</p>
                <p className="text-sm">{pipeline.postingSchedule.reason}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export bar */}
      <div className="sticky bottom-0 border-t border-border bg-card/95 backdrop-blur-sm px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium mr-1">Export:</span>
          <button onClick={exportGoogleDoc}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition">
            <ExternalLink className="w-3.5 h-3.5" /> Google Doc
          </button>
          <button onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={exportToSheet}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500/30 text-green-600 dark:text-green-400 text-xs font-medium hover:bg-green-500/10 transition">
            <ExternalLink className="w-3.5 h-3.5" /> Google Sheet
          </button>
          <button onClick={copyAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition ml-auto">
            {copied ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Sab copy karo</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: string }) {
  return (
    <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
      <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
      <p className="font-medium text-muted-foreground">{tab} data not available</p>
      <p className="text-sm text-muted-foreground mt-1">Is phase ko run karo analyze page par</p>
    </div>
  );
}

// ── RegenBar: per-tab regenerate button ─────────────────────────────────────────
function RegenBar({ tab, regenerating, onRegen }: {
  tab: string;
  regenerating: string | null;
  onRegen: (tab: string) => void;
}) {
  const isActive = regenerating === tab;
  const LABELS: Record<string, string> = {
    audit: "Re-analyze Profile",
    competitors: "Re-analyze Competitors",
    trends: "Refresh Trends",
    pipeline: "Regenerate Pipeline",
  };
  return (
    <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-muted/30 border border-border">
      <p className="text-xs text-muted-foreground">
        {isActive ? "AI analysis chal rahi hai..." : "Iss tab ka analysis dubara karo"}
      </p>
      <button
        id={`regen-btn-${tab}`}
        disabled={!!regenerating}
        onClick={() => onRegen(tab)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
          isActive
            ? "bg-amber-400/20 text-amber-500 cursor-wait"
            : regenerating
            ? "opacity-40 cursor-not-allowed bg-muted"
            : "bg-amber-400/10 hover:bg-amber-400/20 text-amber-600 dark:text-amber-400 border border-amber-400/30"
        }`}
      >
        {isActive ? (
          <><Loader2 className="w-3 h-3 animate-spin" /> Regenerating...</>
        ) : (
          <><RefreshCw className="w-3 h-3" /> {LABELS[tab] || "Regenerate"}</>
        )}
      </button>
    </div>
  );
}

function PostCard({ post }: { post: any }) {
  const [expanded, setExpanded] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyText = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const isReel = post.format === "Reel";
  const isCarousel = post.format === "Carousel";
  const isPost = post.format === "Post";
  const script = post.script || {};

  const formatColor = isReel
    ? "bg-red-500/10 text-red-500 border-red-500/20"
    : isCarousel
    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
    : "bg-green-500/10 text-green-500 border-green-500/20";

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header — always visible */}
      <div className="p-4 flex items-start gap-3 cursor-pointer hover:bg-muted/20 transition" onClick={() => setExpanded(!expanded)}>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-500 font-medium flex-shrink-0 mt-0.5">{post.day}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${formatColor}`}>{post.format}</span>
          </div>
          <p className="text-sm font-semibold">{post.topic}</p>
          {post.hook && <p className="text-xs text-muted-foreground mt-0.5 italic">"{post.hook}"</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">

          {/* REEL SCRIPT */}
          {isReel && Object.keys(script).length > 0 && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-red-500 uppercase tracking-wider">🎬 Reel Script</p>
                <button onClick={() => copyText(
                  Object.entries(script).filter(([k]) => !k.includes("text_overlays")).map(([k, v]) => `${k.toUpperCase()}:\n${v}`).join("\n\n"),
                  "script"
                )} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {copiedSection === "script" ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copiedSection === "script" ? "Copied!" : "Copy script"}
                </button>
              </div>
              {script.scene1_hook && <ScriptScene label="[0:00-0:03] HOOK" content={script.scene1_hook} color="red" />}
              {script.scene2_problem && <ScriptScene label="[0:03-0:15] PROBLEM" content={script.scene2_problem} color="amber" />}
              {script.scene3_solution && <ScriptScene label="[0:15-0:45] SOLUTION" content={script.scene3_solution} color="blue" />}
              {script.scene4_cta && <ScriptScene label="[0:45-0:60] CTA" content={script.scene4_cta} color="green" />}
              {script.voiceover_notes && (
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-muted-foreground mb-1">DIRECTION NOTES</p>
                  <p className="text-xs">{script.voiceover_notes}</p>
                </div>
              )}
              {Array.isArray(script.text_overlays) && script.text_overlays.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground mb-1.5">TEXT OVERLAYS</p>
                  <div className="flex flex-wrap gap-1.5">
                    {script.text_overlays.map((t: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-1 rounded bg-muted">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CAROUSEL SCRIPT */}
          {isCarousel && Object.keys(script).length > 0 && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">📊 Carousel Slides</p>
                <button onClick={() => copyText(
                  Object.entries(script).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join("\n\n"),
                  "script"
                )} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {copiedSection === "script" ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copiedSection === "script" ? "Copied!" : "Copy slides"}
                </button>
              </div>
              {["slide1","slide2","slide3","slide4","slide5","slide6","slide7"].filter(k => script[k]).map((key, i) => (
                <div key={key} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                  <p className="text-xs leading-relaxed">{script[key]}</p>
                </div>
              ))}
              {script.design_notes && (
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-muted-foreground mb-1">DESIGN GUIDE</p>
                  <p className="text-xs">{script.design_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* POST IMAGE DIRECTION */}
          {isPost && Object.keys(script).length > 0 && (
            <div className="p-4 space-y-3">
              <p className="text-xs font-bold text-green-500 uppercase tracking-wider">📸 Image Direction</p>
              {script.image_description && <InfoRow label="What to shoot" value={script.image_description} />}
              {script.text_on_image && <InfoRow label="Text on image" value={script.text_on_image} />}
              {script.positioning && <InfoRow label="Positioning" value={script.positioning} />}
              {script.expression_direction && <InfoRow label="Expression" value={script.expression_direction} />}
              {script.content_type && <InfoRow label="Content type" value={script.content_type} />}
            </div>
          )}

          {/* CAPTION */}
          {post.caption && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-muted-foreground">CAPTION</p>
                <button onClick={() => copyText(post.caption, "caption")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {copiedSection === "caption" ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copiedSection === "caption" ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3">{post.caption}</p>
            </div>
          )}

          {/* HASHTAGS */}
          {post.hashtags?.length > 0 && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-muted-foreground">HASHTAGS ({post.hashtags.length})</p>
                <button onClick={() => copyText(post.hashtags.join(" "), "hashtags")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {copiedSection === "hashtags" ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copiedSection === "hashtags" ? "Copied!" : "Copy all"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {post.hashtags.map((tag: string) => (
                  <span key={tag} className="text-xs px-2 py-1 rounded-full bg-amber-400/10 text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-amber-400/20 transition"
                    onClick={() => copyText(tag, tag)}>
                    {copiedSection === tag ? "✓" : tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* PIN COMMENT */}
          {post.pin_comment && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-muted-foreground flex items-center gap-1">📌 PIN COMMENT</p>
                <button onClick={() => copyText(post.pin_comment, "pin")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {copiedSection === "pin" ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copiedSection === "pin" ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs bg-amber-400/5 border border-amber-400/20 rounded-lg p-3">{post.pin_comment}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScriptScene({ label, content, color }: { label: string; content: string; color: string }) {
  const colorMap: Record<string, string> = {
    red: "border-l-red-500 bg-red-500/5",
    amber: "border-l-amber-500 bg-amber-500/5",
    blue: "border-l-blue-500 bg-blue-500/5",
    green: "border-l-green-500 bg-green-500/5",
  };
  return (
    <div className={`border-l-2 pl-3 rounded-r-lg p-2 ${colorMap[color] || ""}`}>
      <p className="text-[10px] font-bold text-muted-foreground mb-1">{label}</p>
      <p className="text-xs leading-relaxed">{content}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <span className="text-xs">{value}</span>
    </div>
  );
}

// ── Export helpers ────────────────────────────────────────────────────────────
function buildPrintableContent(data: any): string {
  const audit = data.audit || {};
  const competitors = data.competitors || {};
  const trends = data.trends || {};
  const pipeline = data.pipeline || {};
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  let html = `
    <h1>Content Strategy Analysis</h1>
    <p class="meta">${data.platform || ""} · ${data.niche || "General"} · ${date}</p>
  `;

  // AUDIT
  if (audit.followerCount || audit.engagementRate) {
    html += `<h2>📊 Profile Audit</h2>
    <div class="stat-grid">
      <div class="stat"><div class="stat-val">${audit.engagementRate || "—"}</div><div class="stat-label">Engagement Rate</div></div>
      <div class="stat"><div class="stat-val">${audit.followerCount || "—"}</div><div class="stat-label">Followers</div></div>
      <div class="stat"><div class="stat-val">${audit.avgLikes || "—"}</div><div class="stat-label">Avg Likes</div></div>
    </div>`;
    if (audit.strengths?.length) html += `<h3>Strengths</h3><ul>${audit.strengths.map((s: string) => `<li>${s}</li>`).join("")}</ul>`;
    if (audit.weaknesses?.length) html += `<h3>Weaknesses</h3><ul>${audit.weaknesses.map((s: string) => `<li>${s}</li>`).join("")}</ul>`;
    if (audit.topRecommendation) html += `<div class="section"><strong>Top Recommendation:</strong> ${audit.topRecommendation}</div>`;
  }

  // COMPETITORS
  if (competitors.competitors?.length) {
    html += `<h2>🔍 Competitor Analysis</h2>`;
    for (const comp of competitors.competitors) {
      html += `<div class="section"><strong>${comp.username}</strong> — ${comp.realFollowers || comp.estimatedFollowers} followers · ${comp.engagementRate} ER<br/>`;
      if (comp.viralTopics?.length) html += `<br/>🔥 Viral Topics: ${comp.viralTopics.join(", ")}`;
      if (comp.viralHook) html += `<br/>💡 Viral Hook: <em>${comp.viralHook}</em>`;
      html += `</div>`;
    }
    if (competitors.viralContentBlueprint) {
      const b = competitors.viralContentBlueprint;
      html += `<div class="section"><strong>Viral Blueprint:</strong> ${b.topPerformingFormat} · ${b.topPerformingTopic} · ${b.topPerformingHook}</div>`;
    }
  }

  // PIPELINE
  if (pipeline.contentCalendar?.length) {
    html += `<h2>📅 4-Week Content Pipeline</h2>`;
    for (const week of pipeline.contentCalendar) {
      html += `<h3>${week.week}: ${week.theme}</h3>`;
      for (const post of (week.posts || [])) {
        html += `<div class="section"><strong>[${post.day}] ${post.format}: ${post.topic}</strong><br/><em>Hook: ${post.hook}</em><br/>${post.caption?.substring(0, 200) || ""}</div>`;
      }
    }
  }

  return html;
}

function buildPlainText(data: any): string {
  const audit = data.audit || {};
  const competitors = data.competitors || {};
  const trends = data.trends || {};
  const pipeline = data.pipeline || {};
  let text = `CONTENT STRATEGY ANALYSIS\n${'='.repeat(50)}\nPlatform: ${data.platform || ""}\nNiche: ${data.niche || "General"}\nDate: ${new Date().toLocaleDateString("en-IN")}\n\n`;

  if (audit.followerCount) {
    text += `PROFILE AUDIT\n${'-'.repeat(30)}\nFollowers: ${audit.followerCount}\nEngagement Rate: ${audit.engagementRate}\nAvg Likes: ${audit.avgLikes}\n\n`;
    if (audit.strengths?.length) text += `Strengths:\n${audit.strengths.map((s: string) => `• ${s}`).join("\n")}\n\n`;
    if (audit.weaknesses?.length) text += `Weaknesses:\n${audit.weaknesses.map((s: string) => `• ${s}`).join("\n")}\n\n`;
    if (audit.topRecommendation) text += `Top Recommendation: ${audit.topRecommendation}\n\n`;
  }

  if (competitors.competitors?.length) {
    text += `COMPETITOR ANALYSIS\n${'-'.repeat(30)}\n`;
    for (const c of competitors.competitors) {
      text += `${c.username} — ${c.realFollowers || c.estimatedFollowers} followers · ${c.engagementRate} ER\n`;
      if (c.viralTopics?.length) text += `  Viral Topics: ${c.viralTopics.join(", ")}\n`;
      if (c.viralHook) text += `  Viral Hook: "${c.viralHook}"\n`;
      text += "\n";
    }
  }

  if (pipeline.contentCalendar?.length) {
    text += `4-WEEK CONTENT PIPELINE\n${'-'.repeat(30)}\n`;
    for (const week of pipeline.contentCalendar) {
      text += `\n${week.week}: ${week.theme}\n`;
      for (const post of (week.posts || [])) {
        text += `  [${post.day}] ${post.format}: ${post.topic}\n  Hook: ${post.hook}\n  Caption: ${post.caption?.substring(0, 150) || ""}...\n  Hashtags: ${post.hashtags?.join(" ") || ""}\n\n`;
      }
    }
  }

  return text;
}

function HookScriptCard({ hook }: { hook: any }) {
  const [open, setOpen] = useState(false);
  const rs = hook.reelScript;
  // BUG-FIX: support BOTH key formats (old: scene1, new: scene1_hook)
  const s1 = rs?.scene1_hook || rs?.scene1;
  const s2 = rs?.scene2_problem || rs?.scene2;
  const s3 = rs?.scene3_solution || rs?.scene3;
  const s4 = rs?.scene4_cta || rs?.scene4;
  const editing = rs?.editingNotes || rs?.voiceover_notes || rs?.editing_notes;
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="p-3 bg-muted/40 cursor-pointer hover:bg-muted/60 transition" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between"><span className="text-xs font-bold text-amber-500">{hook.emotion} trigger</span><span className="text-[10px] text-muted-foreground">{open ? "collapse ▲" : "Full script dekho ▼"}</span></div>
        <p className="text-sm font-semibold mt-1">{hook.formula}</p>
        <p className="text-xs text-muted-foreground italic mt-0.5">"{hook.example}"</p>
      </div>
      {open && (
        <div className="p-4 border-t border-border space-y-2 bg-card">
          {(s1 || s2 || s3 || s4) ? (<>
            <p className="text-xs font-bold text-red-400 mb-2">60-Second Reel Script</p>
            {s1 && <div className="p-2 rounded-lg bg-muted/50"><p className="text-[10px] font-bold mb-1 text-red-400">HOOK (0-3s)</p><p className="text-xs">{s1}</p></div>}
            {s2 && <div className="p-2 rounded-lg bg-muted/50"><p className="text-[10px] font-bold mb-1 text-amber-400">PROBLEM (3-15s)</p><p className="text-xs">{s2}</p></div>}
            {s3 && <div className="p-2 rounded-lg bg-muted/50"><p className="text-[10px] font-bold mb-1 text-green-400">SOLUTION (15-45s)</p><p className="text-xs">{s3}</p></div>}
            {s4 && <div className="p-2 rounded-lg bg-muted/50"><p className="text-[10px] font-bold mb-1 text-blue-400">CTA (45-60s)</p><p className="text-xs">{s4}</p></div>}
            {editing && <div className="p-2 rounded-lg bg-purple-500/5 border border-purple-500/20"><p className="text-[10px] font-bold text-purple-400 mb-1">EDITING NOTES</p><p className="text-xs text-muted-foreground">{editing}</p></div>}
          </>) : <p className="text-xs text-muted-foreground">Script data not available — re-run analysis for full scripts.</p>}
        </div>
      )}
    </div>
  );
}

function CompetitorsTab({ competitors: raw }: { competitors: any }) {
  try {
    // Normalize: handle both formats:
    // 1. Old: data.competitors = AI JSON object directly
    // 2. New: data.competitors = { success, competitors: {...AI JSON...}, scrapedStats, dataQuality, ... }
    const isWrapped = raw && typeof raw === "object" && "success" in raw && "competitors" in raw && typeof raw.competitors === "object" && !Array.isArray(raw.competitors);
    const competitors: any = isWrapped ? raw.competitors : raw;
    const dataQuality = isWrapped ? raw.dataQuality : (raw._dataQuality || raw.dataQuality);
    const dataConfidence = isWrapped ? raw.dataConfidence : (raw._dataConfidence || raw.dataConfidence);
    const totalPostsScraped = isWrapped ? raw.totalPostsScraped : raw.totalPostsScraped;

    return (<>
      {/* Data confidence banner */}
      {dataConfidence && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs mb-2 ${
          dataQuality === "high" ? "bg-green-500/10 border border-green-500/20 text-green-400" :
          dataQuality === "medium" ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" :
          "bg-red-500/10 border border-red-500/20 text-red-400"
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            dataQuality === "high" ? "bg-green-400" :
            dataQuality === "medium" ? "bg-amber-400" : "bg-red-400"
          }`} />
          <span className="font-bold">Data Confidence: {dataConfidence}</span>
          {totalPostsScraped != null && (
            <span className="text-muted-foreground ml-1">· {totalPostsScraped} posts scraped</span>
          )}
        </div>
      )}
      {competitors.detectedNiche && <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-400/30 bg-amber-400/5 text-sm"><span className="text-xs font-bold text-amber-500">AI DETECTED NICHE:</span><span className="font-semibold">{competitors.detectedNiche}</span></div>}
      {competitors.audienceIntelligence && <div className="p-5 rounded-2xl border border-blue-400/20 bg-blue-400/5"><p className="text-sm font-bold text-blue-400 mb-3">Audience Intelligence</p><div className="grid sm:grid-cols-2 gap-3">{competitors.audienceIntelligence.primaryAudience && <div className="p-3 rounded-xl bg-card border border-border"><p className="text-xs text-muted-foreground mb-1">Primary Audience</p><p className="text-sm">{competitors.audienceIntelligence.primaryAudience}</p></div>}{competitors.audienceIntelligence.audienceIntent && <div className="p-3 rounded-xl bg-card border border-border"><p className="text-xs text-muted-foreground mb-1">Audience Intent</p><p className="text-sm">{competitors.audienceIntelligence.audienceIntent}</p></div>}</div></div>}
      {(competitors.competitors||[]).map((comp: any, i: number) => <div key={i} className="p-5 rounded-2xl border border-border bg-card space-y-3"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center font-bold text-amber-500">{i+1}</div><div><p className="font-semibold">{comp.username}</p><p className="text-xs text-muted-foreground">{comp.realFollowers || comp.estimatedFollowers} followers</p></div></div>{comp.viralityScore && <div className="text-center"><p className="text-2xl font-heading font-extrabold text-amber-500">{comp.viralityScore}</p><p className="text-[10px] text-muted-foreground">Virality</p></div>}</div>{comp.bio && <div className="p-3 rounded-xl bg-muted/40"><p className="text-[10px] font-bold text-muted-foreground mb-1">THEIR BIO</p><p className="text-xs italic">"{comp.bio}"</p></div>}{(comp.viralTopics||[]).length > 0 && <div><p className="text-xs font-bold text-red-500 mb-1">VIRAL TOPICS</p><div className="flex flex-wrap gap-1.5">{comp.viralTopics.map((t: string, ti: number) => <span key={ti} className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400">{t}</span>)}</div></div>}{comp.viralHook && <div className="p-3 rounded-xl bg-amber-400/5 border border-amber-400/20"><p className="text-xs font-bold text-amber-500 mb-1">VIRAL HOOK</p><p className="text-sm italic">"{comp.viralHook}"</p></div>}{(comp.topHashtags||[]).length > 0 && <div className="flex flex-wrap gap-1">{comp.topHashtags.map((tag: string) => <span key={tag} className="px-2 py-0.5 rounded-full bg-muted text-xs">{tag}</span>)}</div>}</div>)}
      {competitors.bioOptimization && <div className="p-5 rounded-2xl border border-green-400/20 bg-green-400/5"><p className="text-sm font-bold text-green-500 mb-3">Bio Optimization</p>{competitors.bioOptimization.userCurrentBio && <div className="mb-3 p-3 rounded-xl bg-card border border-border"><p className="text-[10px] font-bold text-muted-foreground mb-1">CURRENT BIO</p><p className="text-xs">{competitors.bioOptimization.userCurrentBio}</p></div>}{competitors.bioOptimization.suggestedBio && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30"><p className="text-[10px] font-bold text-green-500 mb-1">SUGGESTED BIO</p><p className="text-sm font-medium">{competitors.bioOptimization.suggestedBio}</p></div>}</div>}
      {(competitors.hookFormulas||[]).length > 0 && <div className="p-5 rounded-2xl border border-border bg-card"><p className="text-sm font-bold mb-4">Hook Formulas</p><div className="space-y-3">{competitors.hookFormulas.map((h: any, i: number) => <div key={i} className="p-3 rounded-xl bg-muted/40"><div className="flex justify-between mb-1"><span className="text-xs font-bold text-amber-500">{h.emotionalTrigger}</span><span className="text-[10px] text-muted-foreground">{h.confidence}</span></div><p className="text-sm font-medium">{h.formula}</p><p className="text-xs italic mt-1">"{h.example}"</p></div>)}</div></div>}
      {(competitors.contentGaps||[]).length > 0 && <div className="p-5 rounded-2xl border border-border bg-card"><p className="text-sm font-bold mb-3">Content Gaps</p><div className="space-y-3">{competitors.contentGaps.map((g: any, i: number) => <div key={i} className="p-3 rounded-xl border border-border"><div className="flex justify-between mb-1"><p className="text-sm font-medium">{g.gap}</p><span className="text-xs text-green-500">{g.viralPotential}</span></div><p className="text-xs text-amber-500 mt-1">{g.suggestedTopic}</p></div>)}</div></div>}
      {(competitors.viralContentIdeas||[]).length > 0 && <div className="p-5 rounded-2xl border border-border bg-card"><p className="text-sm font-bold mb-3">Viral Content Ideas</p><div className="space-y-3">{competitors.viralContentIdeas.map((idea: any, i: number) => <div key={i} className="p-4 rounded-xl border border-border"><p className="text-sm font-bold mb-1">{idea.title}</p><p className="text-xs text-amber-500 italic">"{idea.hook}"</p><p className="text-xs text-green-500 mt-1">{idea.whyItWorks}</p></div>)}</div></div>}
      {competitors.hashtagClusters && <div className="p-5 rounded-2xl border border-border bg-card"><p className="text-sm font-bold mb-4">Hashtag Clusters</p><div className="space-y-3">{Object.entries(competitors.hashtagClusters).map(([cl, tags]: [string, any]) => <div key={cl}><p className="text-xs font-bold text-muted-foreground capitalize mb-1.5">{cl}</p><div className="flex flex-wrap gap-1.5">{(Array.isArray(tags)?tags:[]).map((tag: string) => <span key={tag} className="px-2 py-1 rounded-full bg-muted text-xs hover:bg-amber-400/10 hover:text-amber-500 transition cursor-pointer">{tag}</span>)}</div></div>)}</div></div>}
      {competitors.userVsCompetitor && <div className="space-y-3"><div className="grid sm:grid-cols-2 gap-3"><div className="p-4 rounded-xl border border-green-400/20 bg-green-400/5"><p className="text-xs font-bold text-green-500 mb-2">YOUR STRENGTH</p><p className="text-sm">{competitors.userVsCompetitor.userStrength}</p></div><div className="p-4 rounded-xl border border-red-400/20 bg-red-400/5"><p className="text-xs font-bold text-red-500 mb-2">THEIR ADVANTAGE</p><p className="text-sm">{competitors.userVsCompetitor.userWeakness}</p></div></div>{competitors.userVsCompetitor.quickWin && <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5"><p className="text-xs font-bold text-amber-500 mb-2">QUICK WIN</p><p className="text-sm font-medium">{competitors.userVsCompetitor.quickWin}</p></div>}</div>}
      {(competitors.keyInsights||[]).length > 0 && <div className="p-5 rounded-2xl border border-border bg-card"><p className="text-sm font-bold mb-3">Key Insights</p><div className="space-y-2">{competitors.keyInsights.map((insight: string, i: number) => <div key={i} className="flex items-start gap-2 text-sm"><span className="text-amber-500">★</span><span>{insight}</span></div>)}</div></div>}
    </>);
  } catch {
    return <div className="p-6 rounded-2xl border border-red-400/20 bg-red-400/5 text-center"><p className="text-sm font-bold text-red-500 mb-2">Display Error</p><p className="text-xs text-muted-foreground">Competitor data mismatch. Please re-run the analysis.</p></div>;
  }
}



      {competitors.detectedNiche && <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-400/30 bg-amber-400/5 text-sm"><span className="text-xs font-bold text-amber-500">AI DETECTED NICHE:</span><span className="font-semibold">{competitors.detectedNiche}</span></div>}
      {competitors.audienceIntelligence && <div className="p-5 rounded-2xl border border-blue-400/20 bg-blue-400/5"><p className="text-sm font-bold text-blue-400 mb-3">Audience Intelligence</p><div className="grid sm:grid-cols-2 gap-3">{competitors.audienceIntelligence.primaryAudience && <div className="p-3 rounded-xl bg-card border border-border"><p className="text-xs text-muted-foreground mb-1">Primary Audience</p><p className="text-sm">{competitors.audienceIntelligence.primaryAudience}</p></div>}{competitors.audienceIntelligence.audienceIntent && <div className="p-3 rounded-xl bg-card border border-border"><p className="text-xs text-muted-foreground mb-1">Audience Intent</p><p className="text-sm">{competitors.audienceIntelligence.audienceIntent}</p></div>}</div></div>}
      {(competitors.competitors||[]).map((comp: any, i: number) => <div key={i} className="p-5 rounded-2xl border border-border bg-card space-y-3"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center font-bold text-amber-500">{i+1}</div><div><p className="font-semibold">{comp.username}</p><p className="text-xs text-muted-foreground">{comp.realFollowers || comp.estimatedFollowers} followers</p></div></div>{comp.viralityScore && <div className="text-center"><p className="text-2xl font-heading font-extrabold text-amber-500">{comp.viralityScore}</p><p className="text-[10px] text-muted-foreground">Virality</p></div>}</div>{comp.bio && <div className="p-3 rounded-xl bg-muted/40"><p className="text-[10px] font-bold text-muted-foreground mb-1">THEIR BIO</p><p className="text-xs italic">"{comp.bio}"</p></div>}{(comp.viralTopics||[]).length > 0 && <div><p className="text-xs font-bold text-red-500 mb-1">VIRAL TOPICS</p><div className="flex flex-wrap gap-1.5">{comp.viralTopics.map((t: string, ti: number) => <span key={ti} className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400">{t}</span>)}</div></div>}{comp.viralHook && <div className="p-3 rounded-xl bg-amber-400/5 border border-amber-400/20"><p className="text-xs font-bold text-amber-500 mb-1">VIRAL HOOK</p><p className="text-sm italic">"{comp.viralHook}"</p></div>}{(comp.topHashtags||[]).length > 0 && <div className="flex flex-wrap gap-1">{comp.topHashtags.map((tag: string) => <span key={tag} className="px-2 py-0.5 rounded-full bg-muted text-xs">{tag}</span>)}</div>}</div>)}
      {competitors.bioOptimization && <div className="p-5 rounded-2xl border border-green-400/20 bg-green-400/5"><p className="text-sm font-bold text-green-500 mb-3">Bio Optimization</p>{competitors.bioOptimization.userCurrentBio && <div className="mb-3 p-3 rounded-xl bg-card border border-border"><p className="text-[10px] font-bold text-muted-foreground mb-1">CURRENT BIO</p><p className="text-xs">{competitors.bioOptimization.userCurrentBio}</p></div>}{competitors.bioOptimization.suggestedBio && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30"><p className="text-[10px] font-bold text-green-500 mb-1">SUGGESTED BIO</p><p className="text-sm font-medium">{competitors.bioOptimization.suggestedBio}</p></div>}</div>}
      {(competitors.hookFormulas||[]).length > 0 && <div className="p-5 rounded-2xl border border-border bg-card"><p className="text-sm font-bold mb-4">Hook Formulas</p><div className="space-y-3">{competitors.hookFormulas.map((h: any, i: number) => <div key={i} className="p-3 rounded-xl bg-muted/40"><div className="flex justify-between mb-1"><span className="text-xs font-bold text-amber-500">{h.emotionalTrigger}</span><span className="text-[10px] text-muted-foreground">{h.confidence}</span></div><p className="text-sm font-medium">{h.formula}</p><p className="text-xs italic mt-1">"{h.example}"</p></div>)}</div></div>}
      {(competitors.contentGaps||[]).length > 0 && <div className="p-5 rounded-2xl border border-border bg-card"><p className="text-sm font-bold mb-3">Content Gaps</p><div className="space-y-3">{competitors.contentGaps.map((g: any, i: number) => <div key={i} className="p-3 rounded-xl border border-border"><div className="flex justify-between mb-1"><p className="text-sm font-medium">{g.gap}</p><span className="text-xs text-green-500">{g.viralPotential}</span></div><p className="text-xs text-amber-500 mt-1">{g.suggestedTopic}</p></div>)}</div></div>}
      {(competitors.viralContentIdeas||[]).length > 0 && <div className="p-5 rounded-2xl border border-border bg-card"><p className="text-sm font-bold mb-3">Viral Content Ideas</p><div className="space-y-3">{competitors.viralContentIdeas.map((idea: any, i: number) => <div key={i} className="p-4 rounded-xl border border-border"><p className="text-sm font-bold mb-1">{idea.title}</p><p className="text-xs text-amber-500 italic">"{idea.hook}"</p><p className="text-xs text-green-500 mt-1">{idea.whyItWorks}</p></div>)}</div></div>}
      {competitors.hashtagClusters && <div className="p-5 rounded-2xl border border-border bg-card"><p className="text-sm font-bold mb-4">Hashtag Clusters</p><div className="space-y-3">{Object.entries(competitors.hashtagClusters).map(([cl, tags]: [string, any]) => <div key={cl}><p className="text-xs font-bold text-muted-foreground capitalize mb-1.5">{cl}</p><div className="flex flex-wrap gap-1.5">{(Array.isArray(tags)?tags:[]).map((tag: string) => <span key={tag} className="px-2 py-1 rounded-full bg-muted text-xs hover:bg-amber-400/10 hover:text-amber-500 transition cursor-pointer">{tag}</span>)}</div></div>)}</div></div>}
      {competitors.userVsCompetitor && <div className="space-y-3"><div className="grid sm:grid-cols-2 gap-3"><div className="p-4 rounded-xl border border-green-400/20 bg-green-400/5"><p className="text-xs font-bold text-green-500 mb-2">YOUR STRENGTH</p><p className="text-sm">{competitors.userVsCompetitor.userStrength}</p></div><div className="p-4 rounded-xl border border-red-400/20 bg-red-400/5"><p className="text-xs font-bold text-red-500 mb-2">THEIR ADVANTAGE</p><p className="text-sm">{competitors.userVsCompetitor.userWeakness}</p></div></div>{competitors.userVsCompetitor.quickWin && <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5"><p className="text-xs font-bold text-amber-500 mb-2">QUICK WIN</p><p className="text-sm font-medium">{competitors.userVsCompetitor.quickWin}</p></div>}</div>}
      {(competitors.keyInsights||[]).length > 0 && <div className="p-5 rounded-2xl border border-border bg-card"><p className="text-sm font-bold mb-3">Key Insights</p><div className="space-y-2">{competitors.keyInsights.map((insight: string, i: number) => <div key={i} className="flex items-start gap-2 text-sm"><span className="text-amber-500">★</span><span>{insight}</span></div>)}</div></div>}
    </>);
  } catch {
    return <div className="p-6 rounded-2xl border border-red-400/20 bg-red-400/5 text-center"><p className="text-sm font-bold text-red-500 mb-2">Display Error</p><p className="text-xs text-muted-foreground">Competitor data mismatch. Please re-run the analysis.</p></div>;
  }
}
