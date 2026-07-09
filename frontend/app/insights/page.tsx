"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Heart, MessageCircle, Bookmark,
  Share2, Eye, Users, Clock, Camera, BarChart3, RefreshCw,
  Loader2, AlertCircle, ExternalLink, ThumbsUp, ThumbsDown,
  CheckCircle2, Circle, Plus, X, ChevronRight, Trophy,
  Zap, Globe, ArrowUpRight, SkipForward, Info, ClipboardList,
  Sparkles, Check, ChevronDown, ChevronUp, Star, ShieldCheck,
  Award, HelpCircle
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
interface ComparisonMetric { current: number; previous: number; pct: number | null; }
interface InsightsData {
  connected: boolean;
  accountId?: string;
  handle: string; name: string; avatar: string | null;
  followers: number; following: number; mediaCount: number;
  avgReach: number; avgImpressions: number; engagementRate: number;
  profileVisits: number; websiteClicks: number;
  avgLikes: number; avgComments: number; avgSaves: number;
  postsAnalyzed: number; posts30dCount: number; posts7dCount: number;
  comparison7d: {
    reach: ComparisonMetric; impressions: ComparisonMetric;
    likes: ComparisonMetric; comments: ComparisonMetric;
    posts: ComparisonMetric; er: ComparisonMetric;
  };
  followerGrowthChart: { date: string; followers: number }[] | null;
  audienceDemographics: {
    ageRanges: { range: string; pct: number }[];
    topLocations: string[];
    genderSplit: { male: number; female: number };
  };
  topPosts: {
    id: number; postId: string; type: string; caption: string;
    thumbnail: string; permalink: string; timestamp: string;
    likes: number; comments: number; saves: number; shares: number;
    reach: number; er: string;
  }[];
  accountType: string; connectedAt: string;
  availableAccounts?: { id: string; name: string; handle: string }[];
  aiData?: {
    healthScore: number;
    growthScore: number;
    engagementScore: number;
    contentScore: number;
    consistencyScore: number;
    executiveSummary: string;
    topPostsAnalysis?: { postId: string; reason: string }[];
    underperformingPostsAnalysis?: { postId: string; reason: string; suggestion: string }[];
    bestPostingTime?: { days: string[]; hours: string[]; confidenceScore: number };
    profileHealth?: { bioOptimization: string; ctaQuality: string; completeness: string; seoOptimization: string };
    recommendations?: { title: string; expectedImpact: string; priority: string; reasoning: string; suggestedAction: string }[];
  };
}

interface Task {
  id: string; title: string; description: string;
  type: "weekly" | "monthly"; status: "pending" | "done" | "skipped";
  auto_generated: boolean; period_key: string; completed_at: string | null;
}
interface TasksData { monthKey: string; weekKey: string; monthly: Task[]; weekly: Task[]; }
interface HistoryRecord { period_key: string; tasks_total: number; tasks_done: number; tasks_skipped: number; }

// ── Helpers ────────────────────────────────────────────────────────
function fmt(n: number) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
}
function sign(pct: number | null) {
  if (pct === null) return "";
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

// ── Stat Card ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, up, highlight }: {
  label: string; value: string; sub?: string; icon?: any;
  up?: boolean | null; highlight?: boolean;
}) {
  return (
    <div className={`p-5 rounded-2xl border bg-card flex flex-col gap-2 transition-all hover:shadow-md ${highlight ? "border-amber-400/50 bg-amber-400/5" : "border-border/60"}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        {Icon && <Icon className={`w-4 h-4 ${highlight ? "text-amber-500" : "text-muted-foreground/30"}`} />}
      </div>
      <p className="font-heading text-2xl font-bold tracking-tight">{value}</p>
      {sub && (
        <p className={`text-xs flex items-center gap-1 ${up === true ? "text-green-500 font-medium" : up === false ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
          {up === true && <TrendingUp className="w-3.5 h-3.5" />}
          {up === false && <TrendingDown className="w-3.5 h-3.5" />}
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Score Card Component ───────────────────────────────────────────
function ScoreCard({ label, score, desc, icon: Icon }: { label: string; score: number; desc: string; icon: any }) {
  const getColors = (s: number) => {
    if (s >= 80) return { text: "text-green-500", stroke: "#22c55e", bg: "bg-green-500/10 border-green-500/20" };
    if (s >= 60) return { text: "text-amber-500", stroke: "#f59e0b", bg: "bg-amber-500/10 border-amber-500/20" };
    if (s >= 40) return { text: "text-orange-400", stroke: "#fb923c", bg: "bg-orange-500/10 border-orange-500/20" };
    return { text: "text-red-400", stroke: "#f87171", bg: "bg-red-500/10 border-red-500/20" };
  };

  const colors = getColors(score);
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={`p-4 rounded-2xl border bg-card flex flex-col items-center justify-center text-center gap-3 hover:shadow-sm transition-all border-border/60`}>
      <div className="relative flex-shrink-0 w-14 h-14 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="28" cy="28" r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="transparent" />
          <circle cx="28" cy="28" r={radius} stroke={colors.stroke} strokeWidth="4.5" fill="transparent"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
        </svg>
        <span className="absolute text-sm font-bold tracking-tight text-foreground">{score}</span>
      </div>
      <div className="w-full min-w-0">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />
          <p className="text-[11px] font-bold text-foreground uppercase tracking-wider truncate">{label}</p>
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2" title={desc}>{desc}</p>
      </div>
    </div>
  );
}

// ── Comparison Row ─────────────────────────────────────────────────
function ComparisonRow({ label, icon: Icon, metric }: { label: string; icon: any; metric: ComparisonMetric }) {
  const isUp = metric.pct !== null && metric.pct >= 0;
  const isDown = metric.pct !== null && metric.pct < 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <Icon className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
      <span className="text-sm flex-1">{label}</span>
      <span className="text-sm font-medium">{fmt(metric.current)}</span>
      {metric.pct !== null ? (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isUp ? "bg-green-500/10 text-green-500" : isDown ? "bg-red-500/10 text-red-400" : "bg-muted text-muted-foreground"}`}>
          {sign(metric.pct)}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );
}

// ── Line Chart ─────────────────────────────────────────────────────
function LineChart({ data }: { data: { date: string; followers: number }[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data.map(d => d.followers));
  const max = Math.max(...data.map(d => d.followers));
  const range = max - min || 1;
  const W = 100; const H = 50;
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((d.followers - min) / range) * H * 0.8 - H * 0.1,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
      <defs>
        <linearGradient id="followerGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={`${pathD} L ${W} ${H} L 0 ${H} Z`} fill="url(#followerGrad)" />
      <path d={pathD} stroke="#f59e0b" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#f59e0b" />)}
    </svg>
  );
}

// ── Task Item ──────────────────────────────────────────────────────
function TaskItem({ task, onToggle }: { task: Task; onToggle: (id: string, status: Task["status"]) => void }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl transition-all ${task.status === "done" ? "opacity-60 bg-muted/20" : "bg-card border border-border hover:border-amber-400/30"}`}>
      <button
        onClick={() => onToggle(task.id, task.status === "done" ? "pending" : "done")}
        className="flex-shrink-0 mt-0.5"
      >
        {task.status === "done"
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-amber-500 transition" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
        {task.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{task.description}</p>}
        <div className="flex items-center gap-2 mt-1">
          {!task.auto_generated && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">Custom</span>}
          {task.status === "done" && task.completed_at && (
            <span className="text-[10px] text-muted-foreground">
              Done {new Date(task.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>
      {task.status !== "done" && (
        <button onClick={() => onToggle(task.id, "skipped")} className="flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition">
          <SkipForward className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── Add Task Modal ─────────────────────────────────────────────────
function AddTaskModal({ onAdd, onClose, platform }: { onAdd: (t: any) => void; onClose: () => void; platform: string }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<"weekly" | "monthly">("weekly");
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Add Custom Task</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title *"
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:border-amber-500" />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" rows={2}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:border-amber-500 resize-none" />
        <div className="flex gap-2">
          {(["weekly", "monthly"] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${type === t ? "border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400" : "border-border text-muted-foreground"}`}>
              {t === "weekly" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        <button onClick={() => { if (title.trim()) { onAdd({ title, description: desc, type, platform }); onClose(); }}}
          className="w-full py-2.5 rounded-xl bg-amber-400 text-black font-bold text-sm hover:bg-amber-500 transition">
          Add Task
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function InstagramInsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [tasks, setTasks] = useState<TasksData | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "audience">("overview");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [activeAuditTab, setActiveAuditTab] = useState<"top" | "improvement">("top");
  const [expandedRecId, setExpandedRecId] = useState<number | null>(null);
  const [addedRecIndex, setAddedRecIndex] = useState<Record<number, boolean>>({});

  const fetchAll = useCallback(async (isRefresh = false, accId?: string | null) => {
    const targetAccountId = accId || selectedAccountId;
    
    // Check client-side sessionStorage cache first if not refreshing
    if (!isRefresh) {
      const cacheKey = targetAccountId ? `ig_insights_${targetAccountId}` : "ig_insights_default";
      const cached = getSessionCache(cacheKey);
      if (cached && cached.accountId) {
        setData(cached);
        if (loading) setLoading(false);
        return; // Skip network request entirely if we have a valid 24h cache!
      }
    }

    if (isRefresh || data !== null) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    try {
      let url = "/api/insights/instagram";
      const params = new URLSearchParams();
      if (isRefresh) params.append("force", "true");
      if (targetAccountId) params.append("accountId", targetAccountId);
      if (params.toString()) url += "?" + params.toString();

      const insRes = await fetch(url);
      const insJson = await insRes.json();
      if (insRes.status === 404 && insJson.error === "not_connected") { 
        sessionStorage.removeItem("ig_insights_default");
        if (targetAccountId) sessionStorage.removeItem(`ig_insights_${targetAccountId}`);
        setNotConnected(true); 
        return; 
      }
      if (insRes.status === 429) { setError(`Rate limited: ${insJson.error}. Wait ~1 hour.`); return; }
      if (!insRes.ok) { setError(insJson.error || "Failed to load"); return; }
      setData(insJson);
      setFromCache(insJson._fromCache === true);
      setFetchedAt(insJson._fetchedAt || null);
      
      // Save to sessionStorage
      const idToCache = targetAccountId || insJson.availableAccounts?.[0]?.id;
      if (idToCache) {
        setSessionCache(`ig_insights_${idToCache}`, insJson);
        setSessionCache("ig_insights_default", insJson);
      }

      if (taskRes.ok) setTasks(await taskRes.json());
      if (histRes.ok) { const h = await histRes.json(); setHistory(h.history || []); }
    } catch { setError("Network error — please retry"); }
    finally { setLoading(false); setRefreshing(false); }
  }, [selectedAccountId, loading, data]);

  useEffect(() => { fetchAll(false, selectedAccountId); }, [fetchAll, selectedAccountId]);

  const handleTaskToggle = async (id: string, newStatus: Task["status"]) => {
    await fetch("/api/insights/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: newStatus }) });
    fetchAll(true, selectedAccountId);
  };

  const handleAddTask = async (taskData: any) => {
    await fetch("/api/insights/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(taskData) });
    fetchAll(true, selectedAccountId);
  };

  const handleAddRecToTasks = async (rec: any, idx: number) => {
    if (addedRecIndex[idx]) return;
    await handleAddTask({
      title: rec.title,
      description: `${rec.suggestedAction} (Impact: ${rec.expectedImpact} | reasoning: ${rec.reasoning})`,
      type: "weekly",
      platform: "instagram"
    });
    setAddedRecIndex(prev => ({ ...prev, [idx]: true }));
  };

  if (loading) return (
    <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <Loader2 className="w-10 h-10 animate-spin mx-auto text-amber-500" />
        <p className="text-muted-foreground text-sm font-semibold">Running AI Analytics engine...</p>
        <p className="text-xs text-muted-foreground/60">Fetching metrics and generating audits (takes ~10s)</p>
      </div>
    </div>
  );

  if (notConnected) return (
    <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <Camera className="w-14 h-14 mx-auto text-muted-foreground/30" />
        <h2 className="font-heading text-xl font-bold">Instagram Connect Nahi Hai</h2>
        <p className="text-muted-foreground text-sm">Business ya Creator account connect karo.</p>
        <Link href="/connect" className="btn-amber px-6 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2">
          <Camera className="w-4 h-4" /> Connect Instagram
        </Link>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <AlertCircle className="w-12 h-12 mx-auto text-amber-500/50" />
        <h2 className="font-heading text-lg font-bold">Load Failed</h2>
        <p className="text-muted-foreground text-sm max-w-sm">{error}</p>
        <button onClick={() => fetchAll(true, selectedAccountId)} className="btn-amber px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  );

  const chartData = data.followerGrowthChart || [
    { date: "Week 1", followers: Math.round(data.followers * 0.94) },
    { date: "Week 2", followers: Math.round(data.followers * 0.97) },
    { date: "Week 3", followers: Math.round(data.followers * 0.99) },
    { date: "Now",    followers: data.followers },
  ];

  // Dynamic calculations for Content breakdown
  const contentTypes = data.topPosts.reduce((acc: any, post: any) => {
    const t = post.type;
    if (!acc[t]) acc[t] = { count: 0, likes: 0, comments: 0, saves: 0, reach: 0, erSum: 0 };
    acc[t].count += 1;
    acc[t].likes += post.likes;
    acc[t].comments += post.comments;
    acc[t].saves += post.saves || 0;
    acc[t].reach += post.reach || 0;
    acc[t].erSum += parseFloat(post.er) || 0;
    return acc;
  }, {});

  const contentBreakdown = Object.entries(contentTypes).map(([type, stats]: any) => ({
    type,
    count: stats.count,
    avgER: (stats.erSum / stats.count).toFixed(1),
    avgLikes: Math.round(stats.likes / stats.count),
    avgComments: Math.round(stats.comments / stats.count),
    avgReach: Math.round(stats.reach / stats.count),
    pct: Math.round((stats.count / data.topPosts.length) * 100)
  })).sort((a, b) => parseFloat(b.avgER) - parseFloat(a.avgER));

  const allTasks = [...(tasks?.weekly || []), ...(tasks?.monthly || [])];
  const doneTasks = allTasks.filter(t => t.status === "done").length;

  // Extract AI metrics
  const ai = data.aiData || {
    healthScore: 70,
    growthScore: 65,
    engagementScore: 72,
    contentScore: 70,
    consistencyScore: 60,
    executiveSummary: "AI summary loading. Refresh if metrics do not generate automatically.",
    recommendations: [],
    bestPostingTime: { days: ["Monday", "Wednesday", "Friday"], hours: ["7:00 PM", "9:00 PM"], confidenceScore: 80 },
    profileHealth: { bioOptimization: "N/A", ctaQuality: "N/A", completeness: "80%", seoOptimization: "N/A" }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-16 space-y-6 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap bg-card border border-border/50 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3">
          {data.avatar && (
            <img src={data.avatar} alt="Avatar" className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-400/30" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              {data.handle}
              <span className="bg-amber-400/10 text-amber-600 dark:text-amber-400 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">
                Instagram
              </span>
            </h1>
            <p className="text-muted-foreground text-xs">{data.accountType} · {fmt(data.mediaCount)} total posts ({data.postsAnalyzed} analyzed)</p>
          </div>
          
          {data.availableAccounts && data.availableAccounts.length > 0 && (
            <div className="ml-4 flex items-center">
              <select
                value={selectedAccountId || data.accountId || data.availableAccounts[0].id}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="bg-muted/50 border border-border text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50 max-w-[200px] truncate font-medium cursor-pointer hover:bg-muted/80 transition"
              >
                {data.availableAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.handle})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button onClick={() => fetchAll(true, selectedAccountId)} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-500 disabled:bg-amber-400/50 text-black font-bold text-xs rounded-xl transition shadow-sm">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Syncing..." : "Sync Live Data"}
        </button>
      </div>

      {/* Cache status badge */}
      {fetchedAt && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground bg-muted/20 px-4 py-2.5 rounded-2xl border border-border/40">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${fromCache ? "bg-green-500" : "bg-amber-500"}`}></span>
            <span>{fromCache ? "Serving daily cached audit" : "Live audit compiled from Meta"} · {new Date(fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">Cache expires every 24 hours</span>
        </div>
      )}

      {/* ── 1. EXECUTIVE SCORECARD DIALS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <ScoreCard label="Overall Health" score={ai.healthScore} desc="Composite performance rating" icon={Trophy} />
        <ScoreCard label="Growth Speed" score={ai.growthScore} desc="Followers & profile visits trends" icon={TrendingUp} />
        <ScoreCard label="Engagement" score={ai.engagementScore} desc="L/C/S ratios per follower" icon={Heart} />
        <ScoreCard label="Content Quality" score={ai.contentScore} desc="Reach efficacy score" icon={Star} />
        <ScoreCard label="Consistency" score={ai.consistencyScore} desc="Publishing frequency score" icon={Camera} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border w-fit">
        {(["overview", "tasks", "audience"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${activeTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {tab === "tasks" ? `Planner Checklist (${doneTasks}/${allTasks.length})` : tab === "overview" ? "Analytics Summary" : tab}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div className="space-y-6">

          {/* ── 2. AI EXECUTIVE SUMMARY ── */}
          <div className="p-6 rounded-3xl border border-amber-400/20 bg-gradient-to-r from-amber-400/[0.03] to-amber-500/[0.01] shadow-sm relative overflow-hidden">
            <div className="absolute right-4 top-4 text-amber-500 opacity-20">
              <Sparkles className="w-10 h-10" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="font-heading font-bold text-sm text-amber-600 dark:text-amber-400 uppercase tracking-widest">Executive AI Briefing</h2>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 font-medium">
              {ai.executiveSummary}
            </p>
          </div>

          {/* Primary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <StatCard label="Followers" value={fmt(data.followers)} sub={data.following > 0 ? `Following ${fmt(data.following)}` : undefined} icon={Users} />
            <StatCard label="Engagement Rate" value={`${data.engagementRate}%`}
              sub={data.engagementRate >= 3 ? "Good (3%+ target) ✓" : "Below avg — needs work"}
              up={data.engagementRate >= 3} highlight={data.engagementRate >= 3} icon={BarChart3} />
            <StatCard label="Avg Likes" value={fmt(data.avgLikes)} sub="per post" icon={Heart}
              up={data.comparison7d.likes.pct !== null ? data.comparison7d.likes.pct >= 0 : null} />
            <StatCard label="Avg Saves" value={data.avgSaves > 0 ? fmt(data.avgSaves) : "—"} sub="per post" icon={Bookmark} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <StatCard label="Avg Reach" value={data.avgReach > 0 ? fmt(data.avgReach) : "—"} sub="per post" icon={Eye} />
            <StatCard label="Profile Visits" value={data.profileVisits > 0 ? fmt(data.profileVisits) : "—"} sub="30 days" icon={ArrowUpRight} />
            <StatCard label="Website Clicks" value={data.websiteClicks > 0 ? fmt(data.websiteClicks) : "—"} sub="30 days" icon={Globe} />
            <StatCard label="Posts This Month" value={String(data.posts30dCount)} sub={`${data.posts7dCount} this week`} icon={Camera}
              up={data.posts30dCount >= 12} />
          </div>

          {/* 7-day vs prev 7-day */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Week-over-Week Comparison */}
            <div className="p-6 rounded-3xl border border-border/60 bg-card/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-amber-500" />
                  <p className="font-semibold text-sm">Week-over-Week Comparison</p>
                  <span className="text-[10px] text-muted-foreground ml-auto uppercase tracking-wider font-bold">7d vs Prev 7d</span>
                </div>
                <div className="space-y-1">
                  <ComparisonRow label="Reach Growth" icon={Eye} metric={data.comparison7d.reach} />
                  <ComparisonRow label="Impressions Growth" icon={BarChart3} metric={data.comparison7d.impressions} />
                  <ComparisonRow label="Avg Likes" icon={Heart} metric={data.comparison7d.likes} />
                  <ComparisonRow label="Avg Comments" icon={MessageCircle} metric={data.comparison7d.comments} />
                  <ComparisonRow label="Posts Published" icon={Camera} metric={data.comparison7d.posts} />
                  <ComparisonRow label="Engagement Rate %" icon={Zap} metric={data.comparison7d.er} />
                </div>
              </div>
            </div>

            {/* Follower Growth chart */}
            <div className="p-6 rounded-3xl border border-border/60 bg-card/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm">Follower growth metric</p>
                  <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted font-bold uppercase tracking-wider">
                    {data.followerGrowthChart ? "Live API" : "Estimated"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  {data.followerGrowthChart ? "Real follower traction from Instagram logs" : "Estimated trajectory based on recent trends"}
                </p>
              </div>
              <div className="mt-4">
                <LineChart data={chartData} />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-2 font-medium px-1">
                  {chartData.map(d => <span key={d.date}>{d.date}</span>)}
                </div>
              </div>
            </div>
          </div>

          {/* ── 3. CONTENT PERFORMANCE MATRIX ── */}
          <div className="p-6 rounded-3xl border border-border/60 bg-card/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Content Performance Matrix</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Which formats yield the highest engagement on your profile?</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] bg-amber-400/10 text-amber-500 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                  Format Yield
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {contentBreakdown.length > 0 ? (
                contentBreakdown.map((item: any, idx) => (
                  <div key={item.type} className="p-4 bg-muted/20 border border-border/40 rounded-2xl flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">{idx + 1}</span>
                        <span className="text-sm font-bold capitalize text-foreground">{item.type}s</span>
                      </div>
                      <span className="text-xs font-bold text-amber-500">{item.avgER}% ER</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Avg Reach</span>
                        <span className="font-semibold text-foreground">{fmt(item.avgReach)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/30 pt-2">
                      <span>Likes: <strong>{fmt(item.avgLikes)}</strong></span>
                      <span>Comments: <strong>{fmt(item.avgComments)}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-8 text-center text-xs text-muted-foreground">
                  Publish more content formats (Reels, Carousels, Images) to enable format audits.
                </div>
              )}
            </div>
          </div>

          {/* ── 4. AI PERSONALIZED RECOMMENDATIONS ── */}
          {ai.recommendations && ai.recommendations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
                <h3 className="font-semibold text-base">Personalized AI Action Items</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {ai.recommendations.map((rec: any, idx: number) => {
                  const isExpanded = expandedRecId === idx;
                  const isAdded = addedRecIndex[idx];
                  return (
                    <div key={idx} className="border border-border/60 bg-card rounded-2xl overflow-hidden hover:border-amber-400/35 transition-all">
                      <div className="p-4 flex items-center justify-between gap-4 cursor-pointer" onClick={() => setExpandedRecId(isExpanded ? null : idx)}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`p-1.5 rounded-lg ${rec.expectedImpact === "High" ? "bg-green-500/10 text-green-500" : rec.expectedImpact === "Medium" ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"}`}>
                            <Zap className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold truncate text-foreground">{rec.title}</h4>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{rec.reasoning}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3.5 flex-shrink-0">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${rec.expectedImpact === "High" ? "bg-green-500/10 text-green-500" : rec.expectedImpact === "Medium" ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"}`}>
                            {rec.expectedImpact} Impact
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground/60" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/60" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-border/20 bg-muted/10 space-y-3">
                          <div className="text-xs text-foreground/80 space-y-1.5 leading-relaxed">
                            <p><strong>Rationale:</strong> {rec.reasoning}</p>
                            <p className="bg-amber-400/5 border border-amber-400/10 p-3 rounded-xl text-amber-600 dark:text-amber-400 mt-2">
                              <strong>Suggested Action:</strong> {rec.suggestedAction}
                            </p>
                          </div>

                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => handleAddRecToTasks(rec, idx)}
                              disabled={isAdded}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${isAdded ? "bg-green-500/10 text-green-500" : "bg-amber-400 text-black hover:bg-amber-500"}`}
                            >
                              {isAdded ? (
                                <>
                                  <Check className="w-3.5 h-3.5" /> Added to Planner
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" /> Add to Task Planner
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 5. TOP PERFORMING VS UNDERPERFORMING TABS ── */}
          <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Post Audits & Diagnostic Analysis</h3>
              
              <div className="flex gap-1 p-0.5 rounded-lg bg-muted/60 border border-border/40">
                <button onClick={() => setActiveAuditTab("top")}
                  className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${activeAuditTab === "top" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  Top Performers
                </button>
                <button onClick={() => setActiveAuditTab("improvement")}
                  className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${activeAuditTab === "improvement" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  Improvement Needed
                </button>
              </div>
            </div>

            {activeAuditTab === "top" ? (
              <div className="divide-y divide-border/50">
                {data.topPosts.length > 0 ? (
                  data.topPosts.map((post, i) => {
                    const aiReason = ai.topPostsAnalysis?.find(a => a.postId === post.postId)?.reason || 
                      "This content scored high due to strong hook placement and active interactions in the comments section.";
                    return (
                      <div key={post.id} className="p-4 flex flex-col gap-3.5 hover:bg-muted/10 transition">
                        <div className="flex items-center gap-3.5">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            {post.thumbnail ? (
                              <img src={post.thumbnail} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <Camera className="w-5 h-5 m-auto text-muted-foreground/30 mt-2.5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{post.caption || `${post.type} post`}</p>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{post.type} · {new Date(post.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{fmt(post.likes)}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{fmt(post.comments)}</span>
                            {post.saves > 0 && <span className="flex items-center gap-1"><Bookmark className="w-3.5 h-3.5" />{fmt(post.saves)}</span>}
                            <span className="font-bold text-green-500">{post.er}% ER</span>
                            {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" className="hover:text-foreground"><ExternalLink className="w-3.5 h-3.5" /></a>}
                          </div>
                        </div>

                        <div className="bg-green-500/[0.02] border border-green-500/10 p-3 rounded-xl flex items-start gap-2.5 ml-9">
                          <ThumbsUp className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed font-medium">
                            <strong>AI Success Factor:</strong> {aiReason}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">No posts analyzed. Try publishing posts.</div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {ai.underperformingPostsAnalysis && ai.underperformingPostsAnalysis.length > 0 ? (
                  ai.underperformingPostsAnalysis.map((under, idx) => {
                    // Look up post thumbnail if matches
                    const matchingPost = data.topPosts.find(p => p.postId === under.postId);
                    return (
                      <div key={idx} className="p-4 flex flex-col gap-3.5 hover:bg-muted/10 transition">
                        <div className="flex items-center gap-3.5">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black bg-muted text-muted-foreground">{idx + 1}</span>
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            {matchingPost?.thumbnail ? (
                              <img src={matchingPost.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Camera className="w-5 h-5 m-auto text-muted-foreground/30 mt-2.5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{matchingPost?.caption || "Underperforming Post Audit"}</p>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{matchingPost?.type || "Instagram Format"}</p>
                          </div>

                          {matchingPost && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                              <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{fmt(matchingPost.likes)}</span>
                              <span className="font-bold text-red-400">{matchingPost.er}% ER</span>
                            </div>
                          )}
                        </div>

                        <div className="ml-9 space-y-2">
                          <div className="bg-red-500/[0.02] border border-red-500/10 p-3 rounded-xl flex items-start gap-2.5">
                            <ThumbsDown className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed font-medium">
                              <strong>AI Diagnostics:</strong> {under.reason}
                            </p>
                          </div>

                          <div className="bg-amber-500/[0.02] border border-amber-500/10 p-3 rounded-xl flex items-start gap-2.5">
                            <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
                              <strong>AI Recommended Fix:</strong> {under.suggestion}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">All posts show balanced reach profiles! Keep up the good quality.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TASKS TAB ── */}
      {activeTab === "tasks" && (
        <div className="space-y-5">
          {/* Task summary */}
          <div className="p-5 rounded-3xl border border-border bg-card flex items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-500" /> Period Planner checklist
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{doneTasks} of {allTasks.length} tasks completed</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${allTasks.length > 0 ? (doneTasks / allTasks.length) * 100 : 0}%` }} />
              </div>
              <button onClick={() => setAddingTask(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 text-black text-xs font-bold hover:bg-amber-500 transition shadow-sm">
                <Plus className="w-3.5 h-3.5" /> Add Task
              </button>
            </div>
          </div>

          {/* Weekly tasks */}
          {tasks?.weekly && tasks.weekly.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <p className="font-semibold text-sm">Weekly Goals</p>
                <span className="text-xs text-muted-foreground ml-auto">{tasks.weekKey}</span>
              </div>
              {tasks.weekly.filter(t => t.status !== "skipped").map(task => (
                <TaskItem key={task.id} task={task} onToggle={handleTaskToggle} />
              ))}
            </div>
          )}

          {/* Monthly tasks */}
          {tasks?.monthly && tasks.monthly.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <p className="font-semibold text-sm">Monthly Goals</p>
                <span className="text-xs text-muted-foreground ml-auto">{tasks.monthKey}</span>
              </div>
              {tasks.monthly.filter(t => t.status !== "skipped").map(task => (
                <TaskItem key={task.id} task={task} onToggle={handleTaskToggle} />
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="p-6 rounded-3xl border border-border bg-card space-y-4">
              <p className="font-semibold text-sm">Task History Completion</p>
              <div className="space-y-3">
                {history.map(h => {
                  const pct = h.tasks_total > 0 ? Math.round((h.tasks_done / h.tasks_total) * 100) : 0;
                  return (
                    <div key={h.period_key} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                      <span className="text-xs font-semibold text-muted-foreground w-20">{h.period_key}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{h.tasks_done}/{h.tasks_total}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AUDIENCE TAB ── */}
      {activeTab === "audience" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Demographics */}
            <div className="p-6 rounded-3xl border border-border bg-card space-y-5 shadow-sm">
              <h3 className="font-semibold text-sm">Audience Demographics</h3>
              
              {data.audienceDemographics.ageRanges.length > 0 ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Age Distribution</p>
                    {data.audienceDemographics.ageRanges.map(a => (
                      <div key={a.range} className="flex items-center gap-3 mb-2 text-xs">
                        <span className="w-12 text-muted-foreground font-semibold">{a.range}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400" style={{ width: `${a.pct}%` }} />
                        </div>
                        <span className="font-semibold w-8 text-right text-foreground">{a.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg leading-relaxed">
                  Demographics logs are locked. Automatically unlocks once the account crosses 100+ followers.
                </p>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-2">Gender Split</p>
                <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                  <div className="h-full bg-blue-400" style={{ width: `${data.audienceDemographics.genderSplit.male}%` }} />
                  <div className="h-full bg-pink-400" style={{ width: `${data.audienceDemographics.genderSplit.female}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1.5 font-medium">
                  <span className="text-blue-500">♂ Male {data.audienceDemographics.genderSplit.male}%</span>
                  <span className="text-pink-500">♀ Female {data.audienceDemographics.genderSplit.female}%</span>
                </div>
              </div>

              {data.audienceDemographics.topLocations.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Top Locations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.audienceDemographics.topLocations.map((loc, i) => (
                      <span key={loc} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${i === 0 ? "bg-amber-400 text-black shadow-sm" : "bg-muted text-muted-foreground"}`}>{loc}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Best times */}
            <div className="p-6 rounded-3xl border border-border bg-card space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-amber-500" />
                <p className="font-semibold text-sm">Best Times to Publish</p>
                <span className="text-[10px] bg-amber-400/10 text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded ml-auto">
                  {ai.bestPostingTime?.confidenceScore || 80}% Confidence
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Derived from historical peak activity times (converted to Indian Standard Time)</p>
              
              <div className="space-y-2">
                {ai.bestPostingTime?.days ? (
                  ai.bestPostingTime.days.map((day, i) => {
                    const time = ai.bestPostingTime?.hours[i] || "7:00 PM";
                    return (
                      <div key={day} className={`flex items-center gap-3 p-3.5 rounded-xl text-sm ${i === 0 ? "border border-amber-400/30 bg-amber-400/5" : "bg-muted/30"}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-amber-400 text-black shadow-sm" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-foreground">{day} {time} IST</p>
                          <p className="text-xs text-muted-foreground">{i === 0 ? "Highest initial reach spike potential" : `Mid-week activity window`}</p>
                        </div>
                        {i === 0 && <span className="text-xs text-amber-500 font-bold flex items-center gap-0.5"><Star className="w-3.5 h-3.5 fill-current" /> Best</span>}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">Activity logs loading.</p>
                )}
              </div>
            </div>
          </div>

          {/* Profile health audit */}
          <div className="p-6 rounded-3xl border border-border bg-card space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-sm">Account Bio Completeness & Profile Health</h3>
              <span className="text-xs font-bold text-amber-500 ml-auto">Score: {ai.profileHealth?.completeness || "85%"}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Bio optimization</span>
                <p className="text-xs leading-relaxed text-foreground/90 font-medium">{ai.profileHealth?.bioOptimization || "Clear bio structure"}</p>
              </div>

              <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">CTA Efficacy</span>
                <p className="text-xs leading-relaxed text-foreground/90 font-medium">{ai.profileHealth?.ctaQuality || "Direct link-in-bio callouts"}</p>
              </div>

              <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">SEO keywords</span>
                <p className="text-xs leading-relaxed text-foreground/90 font-medium">{ai.profileHealth?.seoOptimization || "Insert niche tags in display name"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {addingTask && <AddTaskModal onAdd={handleAddTask} onClose={() => setAddingTask(false)} platform="instagram" />}
    </div>
  );
}

// ── Session Storage helpers ──
const getSessionCache = (key: string) => {
  if (typeof window === "undefined") return null;
  try {
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (Date.now() - parsed.fetchedAt > 24 * 60 * 60 * 1000) return null;
    return parsed.data;
  } catch { return null; }
};
const setSessionCache = (key: string, data: any) => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify({ data, fetchedAt: Date.now() }));
};
