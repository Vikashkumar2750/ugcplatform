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
                {/* Competitor cards */}
                {(competitors.competitors || []).map((comp: any, i: number) => (
                  <div key={i} className="p-5 rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center font-bold text-amber-500">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{comp.username || `Competitor ${i + 1}`}</p>
                        <p className="text-xs text-muted-foreground">{comp.estimatedFollowers} followers · {comp.engagementRate} ER</p>
                      </div>
                    </div>
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
          {[
            { label: "Google Doc", icon: ExternalLink },
            { label: "PDF", icon: Download },
          ].map((exp) => (
            <button key={exp.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition">
              <exp.icon className="w-3.5 h-3.5" /> {exp.label}
            </button>
          ))}
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
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(`${post.hook}\n\n${post.topic}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="p-3 flex items-start gap-3 cursor-pointer hover:bg-muted/20 transition" onClick={() => setExpanded(!expanded)}>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-500 font-medium flex-shrink-0">{post.day}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{post.format}</p>
          <p className="text-sm font-medium truncate">{post.topic}</p>
          {post.hook && <p className="text-xs text-muted-foreground mt-0.5 italic truncate">"{post.hook}"</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); copy(); }} className="text-muted-foreground hover:text-foreground">
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>
      {expanded && post.cta && (
        <div className="border-t border-border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground">CTA: <span className="text-foreground">{post.cta}</span></p>
        </div>
      )}
    </div>
  );
}
