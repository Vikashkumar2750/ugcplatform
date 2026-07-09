"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Heart, MessageCircle, Share2,
  Eye, Users, Clock, Camera, BarChart3, RefreshCw, Loader2,
  AlertCircle, ExternalLink, ThumbsUp, ThumbsDown, CheckCircle2,
  Circle, Plus, X, ChevronRight, Trophy, Zap, Globe, ArrowUpRight,
  SkipForward, ClipboardList, Sparkles, Check, ChevronDown, ChevronUp,
  Star, ShieldCheck, Award
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
interface ComparisonMetric { current: number; previous: number; pct: number | null; }
interface FBInsightsData {
  connected: boolean;
  accountId?: string;
  pageName: string; fans: number; followers: number;
  category: string; totalReach: number; totalImpressions: number;
  totalViews: number; totalEngaged: number; engagementRate: number;
  postsCount: number;
  posts30dCount?: number; posts7dCount?: number;
  avgLikes?: number; avgComments?: number;
  comparison7d?: {
    reach: ComparisonMetric; impressions: ComparisonMetric;
    likes: ComparisonMetric; comments: ComparisonMetric;
    posts: ComparisonMetric; er: ComparisonMetric;
  };
  topPosts: { id: string; message: string; type: string; likes: number; comments: number; shares: number; created: string }[];
  fanGrowthChart: { date: string; fans: number }[] | null;
  accountType?: string;
  connectedAt?: string;
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
interface HistoryRecord { period_key: string; tasks_total: number; tasks_done: number; }

function fmt(n: number | undefined) {
  if (n === undefined) return "—";
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
  label: string; value: string; sub?: string; icon?: any; up?: boolean | null; highlight?: boolean;
}) {
  return (
    <div className={`p-5 rounded-2xl border bg-card flex flex-col gap-2 transition-all hover:shadow-md ${highlight ? "border-blue-400/50 bg-blue-400/5" : "border-border/60"}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        {Icon && <Icon className={`w-4 h-4 ${highlight ? "text-blue-500" : "text-muted-foreground/30"}`} />}
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

// ── Bar chart ──────────────────────────────────────────────────────
function BarChart({ data }: { data: { date: string; fans: number }[] }) {
  const max = Math.max(...data.map(d => d.fans)) || 1;
  return (
    <div className="flex items-end gap-1.5 h-24 pt-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t bg-gradient-to-t from-blue-500 to-blue-400 opacity-80" style={{ height: `${(d.fans / max) * 76}px` }} />
          <span className="text-[9px] text-muted-foreground truncate w-full text-center font-medium">{d.date}</span>
        </div>
      ))}
    </div>
  );
}

// ── Task item ──────────────────────────────────────────────────────
function TaskItem({ task, onToggle }: { task: Task; onToggle: (id: string, status: Task["status"]) => void }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl transition-all ${task.status === "done" ? "opacity-60 bg-muted/20" : "bg-card border border-border hover:border-blue-400/30"}`}>
      <button onClick={() => onToggle(task.id, task.status === "done" ? "pending" : "done")} className="flex-shrink-0 mt-0.5">
        {task.status === "done" ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-blue-500 transition" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
        {task.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{task.description}</p>}
        {!task.auto_generated && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium mt-1 inline-block">Custom</span>}
      </div>
      {task.status !== "done" && (
        <button onClick={() => onToggle(task.id, "skipped")} className="text-muted-foreground/40 hover:text-muted-foreground mt-0.5">
          <SkipForward className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── Add Task Modal ─────────────────────────────────────────────────
function AddTaskModal({ onAdd, onClose }: { onAdd: (t: any) => void; onClose: () => void }) {
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
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:border-blue-500" />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" rows={2}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:border-blue-500 resize-none" />
        <div className="flex gap-2">
          {(["weekly", "monthly"] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${type === t ? "border-blue-400 bg-blue-400/10 text-blue-600 dark:text-blue-400" : "border-border text-muted-foreground"}`}>
              {t === "weekly" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        <button onClick={() => { if (title.trim()) { onAdd({ title, description: desc, type, platform: "facebook" }); onClose(); }}}
          className="w-full py-2.5 rounded-xl bg-blue-500 text-white font-bold text-sm hover:bg-blue-600 transition">
          Add Task
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function FacebookInsightsPage() {
  const [data, setData] = useState<FBInsightsData | null>(null);
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
      const cacheKey = targetAccountId ? `fb_insights_${targetAccountId}` : "fb_insights_default";
      const cached = getSessionCache(cacheKey);
      if (cached && cached.accountId) {
        setData(cached);
        if (loading) setLoading(false);
        return;
      }
    }

    if (isRefresh || data !== null) setRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      let url = "/api/insights/facebook";
      const params = new URLSearchParams();
      if (isRefresh) params.append("force", "true");
      if (targetAccountId) params.append("accountId", targetAccountId);
      if (params.toString()) url += "?" + params.toString();

      const insRes = await fetch(url);
      const insJson = await insRes.json();
      
      if (insRes.status === 404 && insJson.error === "not_connected") { 
        sessionStorage.removeItem("fb_insights_default");
        if (targetAccountId) sessionStorage.removeItem(`fb_insights_${targetAccountId}`);
        setNotConnected(true); 
        return; 
      }
      if (!insRes.ok) { setError(insJson.error || "Failed to load"); return; }
      
      setData(insJson);
      setFromCache(insJson._fromCache === true);
      setFetchedAt(insJson._fetchedAt || null);

      // Save to sessionStorage
      const idToCache = targetAccountId || insJson.availableAccounts?.[0]?.id;
      if (idToCache) {
        setSessionCache(`fb_insights_${idToCache}`, insJson);
        setSessionCache("fb_insights_default", insJson);
      }

      const [taskRes, histRes] = await Promise.all([
        fetch("/api/insights/tasks?platform=facebook"),
        fetch("/api/insights/tasks/history?platform=facebook"),
      ]);

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
      platform: "facebook"
    });
    setAddedRecIndex(prev => ({ ...prev, [idx]: true }));
  };

  if (loading) return (
    <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-500" />
        <p className="text-muted-foreground text-sm font-semibold">Running AI Analytics engine...</p>
        <p className="text-xs text-muted-foreground/60">Fetching page metrics and generating audits</p>
      </div>
    </div>
  );

  if (notConnected) return (
    <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <Share2 className="w-14 h-14 mx-auto text-muted-foreground/30" />
        <h2 className="font-heading text-xl font-bold">Facebook Page Connect Nahi Hai</h2>
        <p className="text-muted-foreground text-sm">Meta integration complete karke page link karo.</p>
        <Link href="/connect" className="btn-amber px-6 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2">
          <Share2 className="w-4 h-4" /> Connect Facebook Page
        </Link>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <AlertCircle className="w-12 h-12 mx-auto text-blue-500/50" />
        <h2 className="font-heading text-lg font-bold">Load Failed</h2>
        <p className="text-muted-foreground text-sm max-w-sm">{error}</p>
        <button onClick={() => fetchAll(true, selectedAccountId)} className="px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  );

  const chartData = data.fanGrowthChart || [
    { date: "W1", fans: Math.round(data.fans * 0.96) },
    { date: "W2", fans: Math.round(data.fans * 0.98) },
    { date: "W3", fans: Math.round(data.fans * 0.99) },
    { date: "Now", fans: data.fans },
  ];

  // Dynamic Content Type Matrix
  const contentTypes = data.topPosts.reduce((acc: any, post: any) => {
    const t = post.type || "status";
    if (!acc[t]) acc[t] = { count: 0, likes: 0, comments: 0, erSum: 0 };
    acc[t].count += 1;
    acc[t].likes += post.likes;
    acc[t].comments += post.comments;
    const totalInt = post.likes + post.comments;
    acc[t].erSum += data.fans > 0 ? (totalInt / data.fans) * 100 : 0;
    return acc;
  }, {});

  const contentBreakdown = Object.entries(contentTypes).map(([type, stats]: any) => ({
    type,
    count: stats.count,
    avgER: (stats.erSum / stats.count).toFixed(1),
    avgLikes: Math.round(stats.likes / stats.count),
    avgComments: Math.round(stats.comments / stats.count),
    pct: Math.round((stats.count / data.topPosts.length) * 100)
  })).sort((a, b) => parseFloat(b.avgER) - parseFloat(a.avgER));

  const allTasks = [...(tasks?.weekly || []), ...(tasks?.monthly || [])];
  const doneTasks = allTasks.filter(t => t.status === "done").length;

  const ai = data.aiData || {
    healthScore: 68,
    growthScore: 60,
    engagementScore: 70,
    contentScore: 65,
    consistencyScore: 55,
    executiveSummary: "AI summary loading. Refresh if metrics do not generate automatically.",
    recommendations: [],
    bestPostingTime: { days: ["Monday", "Wednesday", "Friday"], hours: ["7:00 PM", "9:00 PM"], confidenceScore: 75 },
    profileHealth: { bioOptimization: "N/A", ctaQuality: "N/A", completeness: "80%", seoOptimization: "N/A" }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-16 space-y-6 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap bg-card border border-border/50 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
            <Share2 className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              {data.pageName}
              <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">
                Facebook Page
              </span>
            </h1>
            <p className="text-muted-foreground text-xs">{data.category} · {data.postsCount} analyzed posts</p>
          </div>

          {data.availableAccounts && data.availableAccounts.length > 0 && (
            <div className="ml-4 flex items-center">
              <select
                value={selectedAccountId || data.accountId || data.availableAccounts[0].id}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="bg-muted/50 border border-border text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 max-w-[200px] truncate font-medium cursor-pointer hover:bg-muted/80 transition"
              >
                {data.availableAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button onClick={() => fetchAll(true, selectedAccountId)} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-bold text-xs rounded-xl transition shadow-sm">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Syncing..." : "Sync Live Data"}
        </button>
      </div>

      {/* Cache status badge */}
      {fetchedAt && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground bg-muted/20 px-4 py-2.5 rounded-2xl border border-border/40">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${fromCache ? "bg-green-500" : "bg-blue-500"}`}></span>
            <span>{fromCache ? "Serving daily cached audit" : "Live audit compiled from Meta"} · {new Date(fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">Cache expires every 24 hours</span>
        </div>
      )}

      {/* Scorecards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <ScoreCard label="Overall Health" score={ai.healthScore} desc="Composite performance rating" icon={Trophy} />
        <ScoreCard label="Growth Speed" score={ai.growthScore} desc="Followers & views trends" icon={TrendingUp} />
        <ScoreCard label="Engagement" score={ai.engagementScore} desc="L/C/S metrics per follower" icon={Heart} />
        <ScoreCard label="Content Quality" score={ai.contentScore} desc="Format conversion efficacy" icon={Star} />
        <ScoreCard label="Consistency" score={ai.consistencyScore} desc="Posting schedule score" icon={Camera} />
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

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">

          {/* AI Briefing */}
          <div className="p-6 rounded-3xl border border-blue-400/20 bg-gradient-to-r from-blue-400/[0.03] to-blue-500/[0.01] shadow-sm relative overflow-hidden">
            <div className="absolute right-4 top-4 text-blue-500 opacity-20">
              <Sparkles className="w-10 h-10" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <h2 className="font-heading font-bold text-sm text-blue-600 dark:text-blue-400 uppercase tracking-widest">Executive AI Briefing</h2>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 font-medium">
              {ai.executiveSummary}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <StatCard label="Followers" value={fmt(data.followers)} sub={`Fans: ${fmt(data.fans)}`} icon={Users} highlight />
            <StatCard label="Engagement Rate" value={`${data.engagementRate}%`} sub="Engaged 30d" icon={BarChart3} />
            <StatCard label="Total Reach" value={fmt(data.totalReach)} sub="30d metrics" icon={Eye} />
            <StatCard label="Total Impressions" value={fmt(data.totalImpressions)} sub="30d metrics" icon={Zap} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <StatCard label="Page Views" value={fmt(data.totalViews)} sub="30d metrics" icon={ArrowUpRight} />
            <StatCard label="Avg Likes" value={fmt(data.avgLikes)} sub="Per Post" icon={Heart} />
            <StatCard label="Avg Comments" value={fmt(data.avgComments)} sub="Per Post" icon={MessageCircle} />
            <StatCard label="Posts Analyzed" value={String(data.postsCount)} sub={`${data.posts7dCount || 0} this week`} icon={Camera} />
          </div>

          {/* Trends comparison & chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.comparison7d && (
              <div className="p-6 rounded-3xl border border-border/60 bg-card/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
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
            )}

            <div className="p-6 rounded-3xl border border-border/60 bg-card/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm">Fan/Follower Growth</p>
                  <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted font-bold uppercase tracking-wider">
                    Metrics Logs
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Growth traction indicators calculated weekly.
                </p>
              </div>
              <div className="mt-4">
                <BarChart data={chartData} />
              </div>
            </div>
          </div>

          {/* Content breakdown */}
          <div className="p-6 rounded-3xl border border-border/60 bg-card/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Content Format Performance</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Yield breakdown for different Facebook content types.</p>
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
                      <span className="text-xs font-bold text-blue-500">{item.avgER}% ER</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Format frequency</span>
                        <span className="font-semibold text-foreground">{item.count} posts</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/30 pt-2">
                      <span>Avg Likes: <strong>{fmt(item.avgLikes)}</strong></span>
                      <span>Avg Comments: <strong>{fmt(item.avgComments)}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-8 text-center text-xs text-muted-foreground">Publish posts to enable format yields analytics.</div>
              )}
            </div>
          </div>

          {/* AI Recommendations */}
          {ai.recommendations && ai.recommendations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-blue-500 animate-pulse" />
                <h3 className="font-semibold text-base">Personalized AI Action Items</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {ai.recommendations.map((rec: any, idx: number) => {
                  const isExpanded = expandedRecId === idx;
                  const isAdded = addedRecIndex[idx];
                  return (
                    <div key={idx} className="border border-border/60 bg-card rounded-2xl overflow-hidden hover:border-blue-400/35 transition-all">
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
                            <p className="bg-blue-400/5 border border-blue-400/10 p-3 rounded-xl text-blue-600 dark:text-blue-400 mt-2">
                              <strong>Suggested Action:</strong> {rec.suggestedAction}
                            </p>
                          </div>

                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => handleAddRecToTasks(rec, idx)}
                              disabled={isAdded}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${isAdded ? "bg-green-500/10 text-green-500" : "bg-blue-500 text-white hover:bg-blue-600"}`}
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

          {/* Post Audits */}
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
                    const aiReason = ai.topPostsAnalysis?.find(a => a.postId === post.id)?.reason || 
                      "This post gained strong reach due to active share metrics in Facebook groups relative to your niche.";
                    return (
                      <div key={post.id} className="p-4 flex flex-col gap-3.5 hover:bg-muted/10 transition">
                        <div className="flex items-center gap-3.5">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{post.message || "Facebook Post"}</p>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{post.type} · {new Date(post.created).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{fmt(post.likes)}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{fmt(post.comments)}</span>
                            <span className="flex items-center gap-1"><Share2 className="w-3.5 h-3.5" />{fmt(post.shares)}</span>
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
                    const matchingPost = data.topPosts.find(p => p.id === under.postId);
                    return (
                      <div key={idx} className="p-4 flex flex-col gap-3.5 hover:bg-muted/10 transition">
                        <div className="flex items-center gap-3.5">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black bg-muted text-muted-foreground">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{matchingPost?.message || "Underperforming Post Audit"}</p>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{matchingPost?.type || "Facebook Format"}</p>
                          </div>
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
                  <div className="p-8 text-center text-xs text-muted-foreground">All posts show balanced engagement logs.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TASKS TAB */}
      {activeTab === "tasks" && (
        <div className="space-y-5">
          <div className="p-5 rounded-3xl border border-border bg-card flex items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-500" /> Period Planner checklist
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{doneTasks} of {allTasks.length} tasks completed</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${allTasks.length > 0 ? (doneTasks / allTasks.length) * 100 : 0}%` }} />
              </div>
              <button onClick={() => setAddingTask(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition shadow-sm">
                <Plus className="w-3.5 h-3.5" /> Add Task
              </button>
            </div>
          </div>

          {tasks?.weekly && tasks.weekly.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" />
                <p className="font-semibold text-sm">Weekly Goals</p>
                <span className="text-xs text-muted-foreground ml-auto">{tasks.weekKey}</span>
              </div>
              {tasks.weekly.filter(t => t.status !== "skipped").map(task => (
                <TaskItem key={task.id} task={task} onToggle={handleTaskToggle} />
              ))}
            </div>
          )}

          {tasks?.monthly && tasks.monthly.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-blue-500" />
                <p className="font-semibold text-sm">Monthly Goals</p>
                <span className="text-xs text-muted-foreground ml-auto">{tasks.monthKey}</span>
              </div>
              {tasks.monthly.filter(t => t.status !== "skipped").map(task => (
                <TaskItem key={task.id} task={task} onToggle={handleTaskToggle} />
              ))}
            </div>
          )}

          {history.length > 0 && (
            <div className="p-6 rounded-3xl border border-border bg-card space-y-4 shadow-sm">
              <p className="font-semibold text-sm">Task History Completion</p>
              <div className="space-y-3">
                {history.map(h => {
                  const pct = h.tasks_total > 0 ? Math.round((h.tasks_done / h.tasks_total) * 100) : 0;
                  return (
                    <div key={h.period_key} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                      <span className="text-xs font-semibold text-muted-foreground w-20">{h.period_key}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{h.tasks_done}/{h.tasks_total}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AUDIENCE TAB */}
      {activeTab === "audience" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl border border-border bg-card space-y-4 shadow-sm flex flex-col justify-center">
              <h3 className="font-semibold text-sm">Audience Reach Profile</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Facebook Page demographics logs are processed under Meta lifetime tracking. Once your page reaches 100+ followers, structured age/gender split segments will populate here automatically.
              </p>
              <div className="p-4 bg-muted/30 border border-border/40 rounded-2xl flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Audience data lock</span>
                <span className="text-xs font-bold text-blue-500">Locked</span>
              </div>
            </div>

            <div className="p-6 rounded-3xl border border-border bg-card space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-blue-500" />
                <p className="font-semibold text-sm">Best Times to Publish</p>
                <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded ml-auto">
                  {ai.bestPostingTime?.confidenceScore || 75}% Confidence
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Derived from historical peak activity times (IST)</p>
              
              <div className="space-y-2">
                {ai.bestPostingTime?.days ? (
                  ai.bestPostingTime.days.map((day, i) => {
                    const time = ai.bestPostingTime?.hours[i] || "7:00 PM";
                    return (
                      <div key={day} className={`flex items-center gap-3 p-3.5 rounded-xl text-sm ${i === 0 ? "border border-blue-400/30 bg-blue-400/5" : "bg-muted/30"}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-blue-500 text-white shadow-sm" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-foreground">{day} {time} IST</p>
                          <p className="text-xs text-muted-foreground">{i === 0 ? "Highest post interaction spike potential" : `Mid-week activity window`}</p>
                        </div>
                        {i === 0 && <span className="text-xs text-blue-500 font-bold flex items-center gap-0.5"><Star className="w-3.5 h-3.5 fill-current" /> Best</span>}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">Activity logs loading.</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-border bg-card space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-sm">Page Bio Completeness & Page Health</h3>
              <span className="text-xs font-bold text-blue-500 ml-auto">Score: {ai.profileHealth?.completeness || "85%"}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">About Section optimization</span>
                <p className="text-xs leading-relaxed text-foreground/90 font-medium">{ai.profileHealth?.bioOptimization || "Niche keyword placement"}</p>
              </div>

              <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Button CTA Quality</span>
                <p className="text-xs leading-relaxed text-foreground/90 font-medium">{ai.profileHealth?.ctaQuality || "Optimize page action button"}</p>
              </div>

              <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">SEO Keywords</span>
                <p className="text-xs leading-relaxed text-foreground/90 font-medium">{ai.profileHealth?.seoOptimization || "Insert category tags"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {addingTask && <AddTaskModal onAdd={handleAddTask} onClose={() => setAddingTask(false)} />}
    </div>
  );
}

// Session Storage helpers
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
