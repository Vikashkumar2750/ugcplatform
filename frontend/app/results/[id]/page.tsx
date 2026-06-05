"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Download, Copy, ExternalLink, FileText, BarChart3,
  TrendingUp, Calendar, Zap, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, ThumbsUp, Loader2,
  Target, Hash, Music, Lightbulb, ArrowRight, Star
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

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("audit");
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = params?.id as string;
    if (!id) { setLoading(false); return; }

    // Load from localStorage (set by analyze page after each phase)
    const stored = localStorage.getItem(`analysis_${id}`);
    const meta = localStorage.getItem(`analysis_meta_${id}`);

    if (stored) {
      try {
        setData(JSON.parse(stored));
        setLoading(false);
        return;
      } catch {}
    }

    if (meta) {
      try {
        const metaData = JSON.parse(meta);
        setData(metaData);
        setLoading(false);
        return;
      } catch {}
    }

    setLoading(false);
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

        {/* ── Profile Audit Tab ─────────────────────────────────────────── */}
        {activeTab === "audit" && (
          <div className="space-y-5">
            {!audit ? (
              <EmptyState tab="Profile Audit" />
            ) : (
              <>
                {/* Key metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1 p-5 rounded-2xl border border-amber-400/30 bg-amber-400/5 space-y-2">
                    <p className="text-xs text-muted-foreground">Engagement Rate</p>
                    <p className="text-4xl font-heading font-extrabold text-gradient">
                      {audit.engagementRate || "—"}
                    </p>
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
            {!competitors ? (
              <EmptyState tab="Competitor Analysis" />
            ) : (
              <>
                {/* Detected niche banner */}
                {competitors.detectedNiche && (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-400/30 bg-amber-400/5 text-sm">
                    <span className="text-xs font-bold text-amber-500">AI DETECTED NICHE:</span>
                    <span className="font-semibold">{competitors.detectedNiche}</span>
                  </div>
                )}

                {/* Competitor cards */}
                {(competitors.competitors || []).map((comp: any, i: number) => (
                  <div key={i} className="p-5 rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center font-bold text-amber-500">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{comp.username || `Competitor ${i + 1}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {comp.realFollowers || comp.estimatedFollowers} followers · {comp.engagementRate} ER · Avg {comp.avgViralViews} views
                        </p>
                      </div>
                    </div>

                    {/* Viral topics */}
                    {comp.viralTopics?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-bold text-red-500 mb-1.5">🔥 VIRAL TOPICS (from real posts)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {comp.viralTopics.map((topic: string, ti: number) => (
                            <span key={ti} className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 font-medium">{topic}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Viral hook */}
                    {comp.viralHook && (
                      <div className="mb-3 p-3 rounded-xl bg-amber-400/5 border border-amber-400/20">
                        <p className="text-xs font-bold text-amber-500 mb-1">VIRAL HOOK FORMULA</p>
                        <p className="text-sm italic">"{comp.viralHook}"</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {comp.hookStyle && <div><p className="text-muted-foreground">Hook Style</p><p className="font-medium">{comp.hookStyle}</p></div>}
                      {comp.postingFrequency && <div><p className="text-muted-foreground">Posting Freq</p><p className="font-medium">{comp.postingFrequency}</p></div>}
                      {comp.captionStyle && <div><p className="text-muted-foreground">Caption</p><p className="font-medium">{comp.captionStyle}</p></div>}
                      {comp.contentStyle && <div><p className="text-muted-foreground">Content Style</p><p className="font-medium">{comp.contentStyle}</p></div>}
                    </div>
                    {comp.topHashtags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {comp.topHashtags.map((tag: string) => (
                          <span key={tag} className="px-2 py-0.5 rounded-full bg-muted text-xs">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Viral Content Blueprint */}
                {competitors.viralContentBlueprint && (
                  <div className="p-5 rounded-2xl border border-red-500/20 bg-red-500/5">
                    <p className="text-sm font-bold text-red-500 mb-4">🎯 Viral Content Blueprint (Competitor ke winning formula se)</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Top Format", value: competitors.viralContentBlueprint.topPerformingFormat },
                        { label: "Top Topic", value: competitors.viralContentBlueprint.topPerformingTopic },
                        { label: "Top Hook", value: competitors.viralContentBlueprint.topPerformingHook },
                        { label: "Optimal Length", value: competitors.viralContentBlueprint.optimalLength },
                      ].filter(i => i.value).map(item => (
                        <div key={item.label} className="p-3 rounded-xl bg-card border border-border">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="text-sm font-semibold mt-0.5">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* User vs Competitor */}
                {competitors.userVsCompetitor && (
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-green-400/20 bg-green-400/5">
                      <p className="text-xs font-bold text-green-500 mb-2">TUMHARI STRENGTH</p>
                      <p className="text-sm">{competitors.userVsCompetitor.userStrength}</p>
                    </div>
                    <div className="p-4 rounded-xl border border-red-400/20 bg-red-400/5">
                      <p className="text-xs font-bold text-red-500 mb-2">UNKA ADVANTAGE</p>
                      <p className="text-sm">{competitors.userVsCompetitor.userWeakness}</p>
                    </div>
                    <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
                      <p className="text-xs font-bold text-amber-500 mb-2">QUICK WIN</p>
                      <p className="text-sm">{competitors.userVsCompetitor.quickWin}</p>
                    </div>
                  </div>
                )}

                {/* Insights */}
                {competitors.keyInsights?.length > 0 && (
                  <div className="p-5 rounded-2xl border border-border bg-card">
                    <p className="text-sm font-bold mb-3">Key Insights</p>
                    <div className="space-y-2">
                      {competitors.keyInsights.map((insight: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gaps */}
                {competitors.gapsToExploit?.length > 0 && (
                  <div className="p-5 rounded-2xl border border-border bg-card">
                    <p className="text-sm font-bold mb-3">Opportunities to Exploit</p>
                    <div className="space-y-2">
                      {competitors.gapsToExploit.map((gap: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <ArrowRight className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{gap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Trend Report Tab ─────────────────────────────────────────── */}
        {activeTab === "trends" && (
          <div className="space-y-5">
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
                    <p className="text-sm font-bold mb-4 flex items-center gap-2"><Lightbulb className="w-4 h-4" /> Viral Hook Formulas</p>
                    <div className="space-y-4">
                      {trends.viralHookFormulas.map((hook: any, i: number) => (
                        <div key={i} className="p-3 rounded-xl bg-muted/40">
                          <p className="text-xs font-bold text-amber-500 mb-1">{hook.emotion} trigger</p>
                          <p className="text-sm font-medium">{hook.formula}</p>
                          <p className="text-xs text-muted-foreground italic mt-1">"{hook.example}"</p>
                        </div>
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
            {!pipeline ? (
              <EmptyState tab="Content Pipeline" />
            ) : (
              <>
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
                {pipeline.contentCalendar?.length > 0 && (
                  <div className="space-y-4">
                    {pipeline.contentCalendar.map((week: any) => (
                      <div key={week.week} className="p-5 rounded-2xl border border-border bg-card">
                        <p className="text-sm font-bold mb-3">Week {week.week}: {week.theme}</p>
                        <div className="space-y-3">
                          {(week.posts || []).map((post: any, pi: number) => (
                            <PostCard key={pi} post={post} />
                          ))}
                        </div>
                      </div>
                    ))}
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
