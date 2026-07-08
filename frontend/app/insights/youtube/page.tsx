"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Heart, MessageCircle, Eye, Users,
  Clock, Video, PlayCircle, ThumbsUp, ThumbsDown, CheckCircle2,
  Circle, Plus, X, ChevronRight, Trophy, Zap, Globe, ArrowUpRight,
  SkipForward, ClipboardList, Sparkles, Check, ChevronDown, ChevronUp,
  Star, ShieldCheck, Award, Loader2, AlertCircle, RefreshCw, Camera,
  ExternalLink
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
interface YTVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
}

interface YTInsightsData {
  connected: boolean;
  accountId?: string;
  channelId: string;
  channelName: string;
  avatar: string | null;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  recentVideos: YTVideo[];
  connectedAt: string;
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

function fmt(n: number) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
}

// ── Stat Card ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, highlight }: {
  label: string; value: string; sub?: string; icon?: any; highlight?: boolean;
}) {
  return (
    <div className={`p-5 rounded-2xl border bg-card flex flex-col gap-2 transition-all hover:shadow-md ${highlight ? "border-red-500/50 bg-red-500/5" : "border-border/60"}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        {Icon && <Icon className={`w-4 h-4 ${highlight ? "text-red-500" : "text-muted-foreground/30"}`} />}
      </div>
      <div>
        <p className="font-heading text-2xl font-bold tracking-tight text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1 font-medium">{sub}</p>}
      </div>
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
    <div className={`p-4 rounded-2xl border bg-card/60 flex items-center gap-3.5 hover:shadow-sm transition-all ${colors.bg}`}>
      <div className="relative flex-shrink-0 w-14 h-14 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="28" cy="28" r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="transparent" />
          <circle cx="28" cy="28" r={radius} stroke={colors.stroke} strokeWidth="4.5" fill="transparent"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
        </svg>
        <span className="absolute text-sm font-bold tracking-tight text-foreground">{score}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">{label}</p>
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={desc}>{desc}</p>
      </div>
    </div>
  );
}

// ── Task item ──────────────────────────────────────────────────────
function TaskItem({ task, onToggle }: { task: Task; onToggle: (id: string, status: Task["status"]) => void }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl transition-all ${task.status === "done" ? "opacity-60 bg-muted/20" : "bg-card border border-border hover:border-red-400/30"}`}>
      <button onClick={() => onToggle(task.id, task.status === "done" ? "pending" : "done")} className="flex-shrink-0 mt-0.5">
        {task.status === "done" ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-red-500 transition" />}
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
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:border-red-500" />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" rows={2}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:border-red-500 resize-none" />
        <div className="flex gap-2">
          {(["weekly", "monthly"] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${type === t ? "border-red-400 bg-red-400/10 text-red-600 dark:text-red-400" : "border-border text-muted-foreground"}`}>
              {t === "weekly" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        <button onClick={() => { if (title.trim()) { onAdd({ title, description: desc, type, platform: "youtube" }); onClose(); }}}
          className="w-full py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition">
          Add Task
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function YouTubeInsightsPage() {
  const [data, setData] = useState<YTInsightsData | null>(null);
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
      const cacheKey = targetAccountId ? `yt_insights_${targetAccountId}` : "yt_insights_default";
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
      let url = "/api/insights/youtube";
      const params = new URLSearchParams();
      if (isRefresh) params.append("force", "true");
      if (targetAccountId) params.append("accountId", targetAccountId);
      if (params.toString()) url += "?" + params.toString();

      const [insRes, taskRes, histRes] = await Promise.all([
        fetch(url),
        fetch("/api/insights/tasks?platform=youtube"),
        fetch("/api/insights/tasks/history?platform=youtube"),
      ]);
      const insJson = await insRes.json();
      
      if (insRes.status === 404 && insJson.error === "not_connected") { 
        sessionStorage.removeItem("yt_insights_default");
        if (targetAccountId) sessionStorage.removeItem(`yt_insights_${targetAccountId}`);
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
        setSessionCache(`yt_insights_${idToCache}`, insJson);
        setSessionCache("yt_insights_default", insJson);
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
      platform: "youtube"
    });
    setAddedRecIndex(prev => ({ ...prev, [idx]: true }));
  };

  if (loading) return (
    <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <Loader2 className="w-10 h-10 animate-spin mx-auto text-red-500" />
        <p className="text-muted-foreground text-sm font-semibold">Running AI Analytics engine...</p>
        <p className="text-xs text-muted-foreground/60">Fetching channel metrics and generating audits</p>
      </div>
    </div>
  );

  if (notConnected) return (
    <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <PlayCircle className="w-14 h-14 mx-auto text-muted-foreground/30" />
        <h2 className="font-heading text-xl font-bold">YouTube Channel Connect Nahi Hai</h2>
        <p className="text-muted-foreground text-sm">OAuth authenticate karke YouTube account link karo.</p>
        <Link href="/connect" className="btn-amber px-6 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2">
          <PlayCircle className="w-4 h-4" /> Connect YouTube Channel
        </Link>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500/50" />
        <h2 className="font-heading text-lg font-bold">Load Failed</h2>
        <p className="text-muted-foreground text-sm max-w-sm">{error}</p>
        <button onClick={() => fetchAll(true, selectedAccountId)} className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  );

  const allTasks = [...(tasks?.weekly || []), ...(tasks?.monthly || [])];
  const doneTasks = allTasks.filter(t => t.status === "done").length;

  const ai = data.aiData || {
    healthScore: 72,
    growthScore: 65,
    engagementScore: 75,
    contentScore: 72,
    consistencyScore: 60,
    executiveSummary: "AI summary loading. Refresh if metrics do not generate automatically.",
    recommendations: [],
    bestPostingTime: { days: ["Thursday", "Saturday", "Sunday"], hours: ["3:00 PM", "6:00 PM"], confidenceScore: 80 },
    profileHealth: { bioOptimization: "N/A", ctaQuality: "N/A", completeness: "85%", seoOptimization: "N/A" }
  };

  // Dynamic Content Yield Breakdown (Short vs Long Video based on Title keywords/estimated lengths)
  const uploadsByType = data.recentVideos.reduce((acc: any, video: any) => {
    const isShort = video.title.toLowerCase().includes("#shorts") || video.title.toLowerCase().includes("short");
    const t = isShort ? "YouTube Short" : "Long Form Video";
    if (!acc[t]) acc[t] = { count: 0, likes: 0, comments: 0, views: 0 };
    acc[t].count += 1;
    acc[t].likes += video.likes;
    acc[t].comments += video.comments;
    acc[t].views += video.views;
    return acc;
  }, {});

  const contentBreakdown = Object.entries(uploadsByType).map(([type, stats]: any) => ({
    type,
    count: stats.count,
    avgLikes: Math.round(stats.likes / stats.count),
    avgComments: Math.round(stats.comments / stats.count),
    avgViews: Math.round(stats.views / stats.count),
    avgER: data.subscribers > 0 ? (((stats.likes + stats.comments) / stats.count) / data.subscribers * 100).toFixed(2) : "0.00",
    pct: Math.round((stats.count / data.recentVideos.length) * 100)
  })).sort((a, b) => parseFloat(b.avgER) - parseFloat(a.avgER));

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-16 space-y-6 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap bg-card border border-border/50 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3">
          {data.avatar ? (
            <img src={data.avatar} alt="Avatar" className="w-12 h-12 rounded-full object-cover ring-2 ring-red-500/20" />
          ) : (
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
              <PlayCircle className="w-6 h-6 text-red-500" />
            </div>
          )}
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              {data.channelName}
              <span className="bg-red-500/10 text-red-500 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">
                YouTube
              </span>
            </h1>
            <p className="text-muted-foreground text-xs">{fmt(data.videoCount)} uploads · channel analytics logs</p>
          </div>

          {data.availableAccounts && data.availableAccounts.length > 1 && (
            <div className="ml-4 flex items-center">
              <select
                value={selectedAccountId || data.accountId || data.availableAccounts[0].id}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="bg-muted/50 border border-border text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500/50 max-w-[200px] truncate font-medium cursor-pointer hover:bg-muted/80 transition"
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
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white font-bold text-xs rounded-xl transition shadow-sm">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Syncing..." : "Sync Live Data"}
        </button>
      </div>

      {/* Cache Status */}
      {fetchedAt && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground bg-muted/20 px-4 py-2.5 rounded-2xl border border-border/40">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${fromCache ? "bg-green-500" : "bg-red-500"}`}></span>
            <span>{fromCache ? "Serving daily cached audit" : "Live audit compiled from YouTube API"} · {new Date(fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">Cache expires every 24 hours</span>
        </div>
      )}

      {/* Scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <ScoreCard label="Overall Health" score={ai.healthScore} desc="Composite performance rating" icon={Trophy} />
        <ScoreCard label="Growth Speed" score={ai.growthScore} desc="Subscribers & views growth rate" icon={TrendingUp} />
        <ScoreCard label="Engagement" score={ai.engagementScore} desc="Likes & comments ratios" icon={Heart} />
        <ScoreCard label="Content Quality" score={ai.contentScore} desc="Watch yield metrics" icon={Star} />
        <ScoreCard label="Consistency" score={ai.consistencyScore} desc="Video upload frequency logs" icon={Camera} />
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
          <div className="p-6 rounded-3xl border border-red-500/20 bg-gradient-to-r from-red-500/[0.03] to-red-500/[0.01] shadow-sm relative overflow-hidden">
            <div className="absolute right-4 top-4 text-red-500 opacity-20">
              <Sparkles className="w-10 h-10" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-red-500" />
              <h2 className="font-heading font-bold text-sm text-red-600 dark:text-red-400 uppercase tracking-widest">Executive AI Briefing</h2>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 font-medium">
              {ai.executiveSummary}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <StatCard label="Subscribers" value={fmt(data.subscribers)} icon={Users} highlight />
            <StatCard label="Total View Count" value={fmt(data.totalViews)} icon={Eye} />
            <StatCard label="Upload Frequency" value={fmt(data.videoCount)} icon={Video} />
          </div>

          {/* Content Yield Breakdown */}
          <div className="p-6 rounded-3xl border border-border/60 bg-card/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Content Format Performance</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Yield breakdown for Short vs Long form videos.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {contentBreakdown.length > 0 ? (
                contentBreakdown.map((item: any, idx) => (
                  <div key={item.type} className="p-4 bg-muted/20 border border-border/40 rounded-2xl flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">{idx + 1}</span>
                        <span className="text-sm font-bold text-foreground">{item.type}</span>
                      </div>
                      <span className="text-xs font-bold text-red-500">{item.avgER}% ER</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Avg Video Views</span>
                        <span className="font-semibold text-foreground">{fmt(item.avgViews)} views</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-red-500" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/30 pt-2">
                      <span>Avg Likes: <strong>{fmt(item.avgLikes)}</strong></span>
                      <span>Avg Comments: <strong>{fmt(item.avgComments)}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 p-8 text-center text-xs text-muted-foreground">Publish videos to enable formats breakdown.</div>
              )}
            </div>
          </div>

          {/* AI recommendations */}
          {ai.recommendations && ai.recommendations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-red-500 animate-pulse" />
                <h3 className="font-semibold text-base">Personalized AI Action Items</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {ai.recommendations.map((rec: any, idx: number) => {
                  const isExpanded = expandedRecId === idx;
                  const isAdded = addedRecIndex[idx];
                  return (
                    <div key={idx} className="border border-border/60 bg-card rounded-2xl overflow-hidden hover:border-red-500/35 transition-all">
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
                            <p className="bg-red-400/5 border border-red-400/10 p-3 rounded-xl text-red-600 dark:text-red-400 mt-2">
                              <strong>Suggested Action:</strong> {rec.suggestedAction}
                            </p>
                          </div>

                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => handleAddRecToTasks(rec, idx)}
                              disabled={isAdded}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${isAdded ? "bg-green-500/10 text-green-500" : "bg-red-500 text-white hover:bg-red-600"}`}
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

          {/* Videos List */}
          <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Recent Uploads Audits</h3>
              
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
                {data.recentVideos.length > 0 ? (
                  data.recentVideos.slice(0, 5).map((video, i) => {
                    const aiReason = ai.topPostsAnalysis?.find(a => a.postId === video.id)?.reason || 
                      "Strong visual hook and high initial CTR within the first 2 hours of upload.";
                    return (
                      <div key={video.id} className="p-4 flex flex-col gap-3.5 hover:bg-muted/10 transition">
                        <div className="flex items-center gap-3.5">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                          <div className="w-14 h-9 rounded overflow-hidden bg-muted flex-shrink-0 relative aspect-video">
                            {video.thumbnail && <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{video.title}</p>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{new Date(video.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{fmt(video.views)}</span>
                            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{fmt(video.likes)}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{fmt(video.comments)}</span>
                            {video.id && <a href={`https://youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="hover:text-foreground"><ExternalLink className="w-3.5 h-3.5" /></a>}
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
                  <div className="p-8 text-center text-xs text-muted-foreground">No recent uploads found.</div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {ai.underperformingPostsAnalysis && ai.underperformingPostsAnalysis.length > 0 ? (
                  ai.underperformingPostsAnalysis.map((under, idx) => {
                    const matchingVideo = data.recentVideos.find(v => v.id === under.postId);
                    return (
                      <div key={idx} className="p-4 flex flex-col gap-3.5 hover:bg-muted/10 transition">
                        <div className="flex items-center gap-3.5">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black bg-muted text-muted-foreground">{idx + 1}</span>
                          <div className="w-14 h-9 rounded overflow-hidden bg-muted flex-shrink-0 relative aspect-video">
                            {matchingVideo?.thumbnail && <img src={matchingVideo.thumbnail} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{matchingVideo?.title || "Underperforming Video Audit"}</p>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">YouTube Upload</p>
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
                  <div className="p-8 text-center text-xs text-muted-foreground">All recent uploads show stable CTR statistics.</div>
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
                <ClipboardList className="w-4 h-4 text-red-500" /> Period Planner checklist
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{doneTasks} of {allTasks.length} tasks completed</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${allTasks.length > 0 ? (doneTasks / allTasks.length) * 100 : 0}%` }} />
              </div>
              <button onClick={() => setAddingTask(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition shadow-sm">
                <Plus className="w-3.5 h-3.5" /> Add Task
              </button>
            </div>
          </div>

          {tasks?.weekly && tasks.weekly.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-red-500" />
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
                <Trophy className="w-4 h-4 text-red-500" />
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
                        <div className="h-full rounded-full bg-red-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-red-600 dark:text-red-400">{h.tasks_done}/{h.tasks_total}</span>
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
              <h3 className="font-semibold text-sm">Audience Demographics</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                YouTube Analytics demographic logs require direct OAuth Channel authorization. Demographics age/gender graphs will populate here automatically once data processing is verified on the Google Cloud console.
              </p>
              <div className="p-4 bg-muted/30 border border-border/40 rounded-2xl flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Audience data lock</span>
                <span className="text-xs font-bold text-red-500">Locked</span>
              </div>
            </div>

            <div className="p-6 rounded-3xl border border-border bg-card space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-red-500" />
                <p className="font-semibold text-sm">Best Times to Publish</p>
                <span className="text-[10px] bg-red-500/10 text-red-500 font-bold uppercase tracking-wider px-2 py-0.5 rounded ml-auto">
                  {ai.bestPostingTime?.confidenceScore || 80}% Confidence
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Derived from historical peak activity times (IST)</p>
              
              <div className="space-y-2">
                {ai.bestPostingTime?.days ? (
                  ai.bestPostingTime.days.map((day, i) => {
                    const time = ai.bestPostingTime?.hours[i] || "6:00 PM";
                    return (
                      <div key={day} className={`flex items-center gap-3 p-3.5 rounded-xl text-sm ${i === 0 ? "border border-red-400/30 bg-red-400/5" : "bg-muted/30"}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-red-500 text-white shadow-sm" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-foreground">{day} {time} IST</p>
                          <p className="text-xs text-muted-foreground">{i === 0 ? "Highest traffic yield potential" : `Weekend upload slot`}</p>
                        </div>
                        {i === 0 && <span className="text-xs text-red-500 font-bold flex items-center gap-0.5"><Star className="w-3.5 h-3.5 fill-current" /> Best</span>}
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
              <ShieldCheck className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-sm">Channel Optimization & SEO Health</h3>
              <span className="text-xs font-bold text-red-500 ml-auto">Score: {ai.profileHealth?.completeness || "85%"}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">About Keywords</span>
                <p className="text-xs leading-relaxed text-foreground/90 font-medium">{ai.profileHealth?.bioOptimization || "Clear niche keywords in About tab"}</p>
              </div>

              <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">CTA Placements</span>
                <p className="text-xs leading-relaxed text-foreground/90 font-medium">{ai.profileHealth?.ctaQuality || "Channel header links callout"}</p>
              </div>

              <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Video Tags & SEO</span>
                <p className="text-xs leading-relaxed text-foreground/90 font-medium">{ai.profileHealth?.seoOptimization || "Keyword rich channel tags"}</p>
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
