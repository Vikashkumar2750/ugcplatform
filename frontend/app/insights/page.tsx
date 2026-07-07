"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Heart, MessageCircle, Bookmark,
  Share2, Eye, Users, Clock, Camera, BarChart3, RefreshCw,
  Loader2, AlertCircle, ExternalLink, ThumbsUp, ThumbsDown,
  CheckCircle2, Circle, Plus, X, ChevronRight, Trophy,
  Zap, Globe, ArrowUpRight, SkipForward
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
interface ComparisonMetric { current: number; previous: number; pct: number | null; }
interface InsightsData {
  connected: boolean; handle: string; name: string; avatar: string | null;
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
    <div className={`p-4 rounded-2xl border bg-card flex flex-col gap-2 transition-all hover:shadow-md ${highlight ? "border-amber-400/50 bg-amber-400/5" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        {Icon && <Icon className={`w-3.5 h-3.5 ${highlight ? "text-amber-500" : "text-muted-foreground/40"}`} />}
      </div>
      <p className="font-heading text-xl font-bold tracking-tight">{value}</p>
      {sub && (
        <p className={`text-[11px] flex items-center gap-1 ${up === true ? "text-green-500" : up === false ? "text-red-400" : "text-muted-foreground"}`}>
          {up === true && <TrendingUp className="w-3 h-3" />}
          {up === false && <TrendingDown className="w-3 h-3" />}
          {sub}
        </p>
      )}
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
    y: H - ((d.followers - min) / range) * H * 0.85 - H * 0.075,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${pathD} L ${W} ${H} L 0 ${H} Z`} fill="url(#cg)" />
      <path d={pathD} stroke="#f59e0b" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill="#f59e0b" />)}
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

// ── Analysis tags ──────────────────────────────────────────────────
function Insight({ type, text }: { type: "up" | "down" | "tip"; text: string }) {
  const configs = {
    up:  { bg: "bg-green-500/8 border-green-500/20",  icon: ThumbsUp,  ic: "text-green-500",  tc: "text-green-600 dark:text-green-400" },
    down:{ bg: "bg-red-500/8 border-red-500/20",      icon: ThumbsDown,ic: "text-red-400",    tc: "text-red-500 dark:text-red-400" },
    tip: { bg: "bg-amber-500/8 border-amber-500/20",  icon: Zap,       ic: "text-amber-500",  tc: "text-amber-600 dark:text-amber-400" },
  }[type];
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${configs.bg}`}>
      <configs.icon className={`w-3.5 h-3.5 ${configs.ic} flex-shrink-0 mt-0.5`} />
      <p className={`text-xs leading-relaxed ${configs.tc}`}>{text}</p>
    </div>
  );
}

function buildInsights(data: InsightsData) {
  const positives: string[] = [], negatives: string[] = [], tips: string[] = [];
  const c = data.comparison7d;
  const er = data.engagementRate;

  if (er >= 6) positives.push(`Engagement rate ${er}% is exceptional! Industry avg is 3-6% — keep it up 🔥`);
  else if (er >= 3) positives.push(`Engagement rate ${er}% is healthy (3-6% is good) ✓`);
  else negatives.push(`Engagement rate ${er}% is below average. Target 3%+ — add strong CTAs to captions.`);

  if (c.likes.pct !== null) {
    if (c.likes.pct >= 0) positives.push(`Likes up ${c.likes.pct}% this week vs last week ↑`);
    else negatives.push(`Likes down ${Math.abs(c.likes.pct)}% this week. Post at peak times (7-9 PM IST).`);
  }
  if (c.reach.pct !== null && c.reach.current > 0) {
    if (c.reach.pct >= 10) positives.push(`Reach grew ${c.reach.pct}% this week — content is spreading ✓`);
    else if (c.reach.pct < -10) negatives.push(`Reach dropped ${Math.abs(c.reach.pct)}% this week. Try more hashtags or Reels format.`);
  }
  if (c.posts.pct !== null && c.posts.current < 2) negatives.push(`Only ${c.posts.current} post(s) this week — post more consistently.`);
  else if (c.posts.current >= 3) positives.push(`${c.posts.current} posts this week — great consistency! ✓`);

  if (data.avgSaves > data.avgLikes * 0.1) positives.push("Good save ratio — people bookmark your content (saves boost algorithm rank).");
  else if (data.avgSaves === 0) tips.push("Add 'Save for later 🔖' in posts — saves count more than likes for reach.");

  if (data.websiteClicks > 0) positives.push(`${fmt(data.websiteClicks)} website clicks this month from Instagram.`);
  if (data.profileVisits > 100) positives.push(`${fmt(data.profileVisits)} profile visits — people are checking your bio.`);
  if (data.avgComments < 2) tips.push("End every caption with a question to boost comment engagement.");
  if (data.posts30dCount < 8) tips.push(`${data.posts30dCount} posts in last 30 days — aim for 12+ (3/week).`);

  return { positives, negatives, tips };
}

// ── Score badge ────────────────────────────────────────────────────
function ScoreBadge({ data }: { data: InsightsData }) {
  let score = 50;
  if (data.engagementRate >= 6) score += 25;
  else if (data.engagementRate >= 3) score += 15;
  if (data.posts30dCount >= 12) score += 10;
  else if (data.posts30dCount >= 6) score += 5;
  if (data.avgSaves > 5) score += 10;
  if (data.comparison7d.likes.pct !== null && data.comparison7d.likes.pct > 0) score += 5;
  score = Math.min(100, score);
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Average" : "Needs Work";
  const color = score >= 80 ? "text-green-500" : score >= 60 ? "text-amber-500" : score >= 40 ? "text-orange-400" : "text-red-400";
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 border border-border">
      <Trophy className={`w-3.5 h-3.5 ${color}`} />
      <span className={`text-sm font-bold ${color}`}>{score}/100</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ── Helper to access sessionStorage safely ──
const getSessionCache = (key: string) => {
  if (typeof window === "undefined") return null;
  try {
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    // Valid for 24 hours
    if (Date.now() - parsed.fetchedAt > 24 * 60 * 60 * 1000) return null;
    return parsed.data;
  } catch { return null; }
};
const setSessionCache = (key: string, data: any) => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify({ data, fetchedAt: Date.now() }));
};

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

  const fetchAll = useCallback(async (isRefresh = false, accId?: string | null) => {
    const targetAccountId = accId || selectedAccountId;
    
    // Check client-side sessionStorage cache first if not refreshing
    if (!isRefresh) {
      const cacheKey = targetAccountId ? `ig_insights_${targetAccountId}` : "ig_insights_default";
      const cached = getSessionCache(cacheKey);
      if (cached) {
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

      const [insRes, taskRes, histRes] = await Promise.all([
        fetch(url),
        fetch("/api/insights/tasks?platform=instagram"),
        fetch("/api/insights/tasks/history?platform=instagram"),
      ]);
      const insJson = await insRes.json();
      if (insRes.status === 404 && insJson.error === "not_connected") { setNotConnected(true); return; }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  useEffect(() => { fetchAll(false, selectedAccountId); }, [fetchAll, selectedAccountId]);

  const handleTaskToggle = async (id: string, newStatus: Task["status"]) => {
    await fetch("/api/insights/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: newStatus }) });
    fetchAll(true, selectedAccountId);
  };

  const handleAddTask = async (taskData: any) => {
    await fetch("/api/insights/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(taskData) });
    fetchAll(true, selectedAccountId);
  };

  if (loading) return (
    <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <Loader2 className="w-10 h-10 animate-spin mx-auto text-amber-500" />
        <p className="text-muted-foreground text-sm">Fetching real-time data from Instagram...</p>
        <p className="text-xs text-muted-foreground">First load may take 15-20 seconds</p>
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

  const { positives, negatives, tips } = buildInsights(data);
  const allTasks = [...(tasks?.weekly || []), ...(tasks?.monthly || [])];
  const doneTasks = allTasks.filter(t => t.status === "done").length;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-16 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {data.avatar && (
            <img src={data.avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-400/30" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div>
            <h1 className="font-heading text-xl font-bold">{data.handle}</h1>
            <p className="text-muted-foreground text-xs">{data.accountType} · {data.postsAnalyzed} posts analyzed</p>
          </div>
          <ScoreBadge data={data} />
          
          {data.availableAccounts && data.availableAccounts.length > 1 && (
            <div className="ml-4 flex items-center">
              <select
                value={selectedAccountId || data.availableAccounts[0].id}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="bg-muted/40 border border-border text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 max-w-[200px] truncate"
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
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted/60 transition">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Fetching..." : "Refresh"}
        </button>
      </div>
      {/* Cache status badge */}
      {fetchedAt && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {fromCache ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              Cached today · {new Date(fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Live from Meta · {new Date(fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border w-fit">
        {(["overview", "tasks", "audience"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition capitalize ${activeTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {tab === "tasks" ? `Tasks (${doneTasks}/${allTasks.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div className="space-y-5">

          {/* Main stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Followers" value={fmt(data.followers)} sub={data.following > 0 ? `Following ${fmt(data.following)}` : undefined} icon={Users} />
            <StatCard label="Engagement Rate" value={`${data.engagementRate}%`}
              sub={data.engagementRate >= 3 ? "Good (3%+ target) ✓" : "Below avg — needs work"}
              up={data.engagementRate >= 3} highlight={data.engagementRate >= 3} icon={BarChart3} />
            <StatCard label="Avg Likes" value={fmt(data.avgLikes)} sub="per post" icon={Heart}
              up={data.comparison7d.likes.pct !== null ? data.comparison7d.likes.pct >= 0 : null} />
            <StatCard label="Avg Saves" value={data.avgSaves > 0 ? fmt(data.avgSaves) : "—"} sub="per post" icon={Bookmark} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Avg Reach" value={data.avgReach > 0 ? fmt(data.avgReach) : "—"} sub="per post" icon={Eye} />
            <StatCard label="Profile Visits" value={data.profileVisits > 0 ? fmt(data.profileVisits) : "—"} sub="30 days" icon={ArrowUpRight} />
            <StatCard label="Website Clicks" value={data.websiteClicks > 0 ? fmt(data.websiteClicks) : "—"} sub="30 days" icon={Globe} />
            <StatCard label="Posts This Month" value={String(data.posts30dCount)} sub={`${data.posts7dCount} this week`} icon={Camera}
              up={data.posts30dCount >= 12} />
          </div>

          {/* 7-day vs prev 7-day */}
          <div className="p-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              <p className="font-semibold text-sm">Week-over-Week Comparison</p>
              <span className="text-xs text-muted-foreground ml-auto">This week vs last week</span>
            </div>
            <ComparisonRow label="Reach" icon={Eye} metric={data.comparison7d.reach} />
            <ComparisonRow label="Impressions" icon={BarChart3} metric={data.comparison7d.impressions} />
            <ComparisonRow label="Avg Likes" icon={Heart} metric={data.comparison7d.likes} />
            <ComparisonRow label="Avg Comments" icon={MessageCircle} metric={data.comparison7d.comments} />
            <ComparisonRow label="Posts Published" icon={Camera} metric={data.comparison7d.posts} />
            <ComparisonRow label="Engagement Rate %" icon={Zap} metric={data.comparison7d.er} />
          </div>

          {/* Analysis */}
          <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
            <p className="font-semibold text-sm">Account Analysis</p>
            {positives.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-green-500 uppercase tracking-wider">✅ Strengths</p>
                {positives.map((t, i) => <Insight key={i} type="up" text={t} />)}
              </div>
            )}
            {negatives.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider">⚠️ Needs Improvement</p>
                {negatives.map((t, i) => <Insight key={i} type="down" text={t} />)}
              </div>
            )}
            {tips.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">💡 Pro Tips</p>
                {tips.map((t, i) => <Insight key={i} type="tip" text={t} />)}
              </div>
            )}
          </div>

          {/* Growth chart */}
          <div className="p-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-sm">Follower Growth</p>
              <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                {data.followerGrowthChart ? "Live API" : "Estimated"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {data.followerGrowthChart ? "Real data from Instagram" : "Estimated based on current count"}
            </p>
            <LineChart data={chartData} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
              {chartData.slice(0, 6).map(d => <span key={d.date}>{d.date}</span>)}
            </div>
          </div>

          {/* Top posts */}
          {data.topPosts.length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <p className="font-semibold text-sm">Top Posts</p>
                <p className="text-xs text-muted-foreground mt-0.5">By likes + comments + saves</p>
              </div>
              <div className="divide-y divide-border">
                {data.topPosts.map((post, i) => (
                  <div key={post.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {post.thumbnail
                        ? <img src={post.thumbnail} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        : <Camera className="w-4 h-4 m-auto mt-2.5 text-muted-foreground/40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{post.caption || `${post.type} post`}</p>
                      <p className="text-xs text-muted-foreground">{post.type}</p>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground flex-shrink-0">
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{fmt(post.likes)}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{fmt(post.comments)}</span>
                      {post.saves > 0 && <span className="flex items-center gap-1"><Bookmark className="w-3 h-3" />{fmt(post.saves)}</span>}
                      <span className="font-bold text-amber-600 dark:text-amber-400">{post.er}%</span>
                      {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" className="hover:text-foreground"><ExternalLink className="w-3 h-3" /></a>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TASKS TAB ── */}
      {activeTab === "tasks" && (
        <div className="space-y-5">
          {/* Task summary */}
          <div className="p-4 rounded-2xl border border-border bg-card flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Progress this period</p>
              <p className="text-xs text-muted-foreground mt-0.5">{doneTasks} of {allTasks.length} tasks completed</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${allTasks.length > 0 ? (doneTasks / allTasks.length) * 100 : 0}%` }} />
              </div>
              <button onClick={() => setAddingTask(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 text-black text-xs font-bold hover:bg-amber-500 transition">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </div>

          {/* Weekly tasks */}
          {tasks?.weekly && tasks.weekly.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <p className="font-semibold text-sm">Weekly Tasks</p>
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
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
              <p className="font-semibold text-sm">Past 3 Months History</p>
              {history.map(h => {
                const pct = h.tasks_total > 0 ? Math.round((h.tasks_done / h.tasks_total) * 100) : 0;
                return (
                  <div key={h.period_key} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    <span className="text-xs font-medium text-muted-foreground w-20">{h.period_key}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{h.tasks_done}/{h.tasks_total}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── AUDIENCE TAB ── */}
      {activeTab === "audience" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Demographics */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
              <p className="font-semibold text-sm">Audience Demographics</p>
              {data.audienceDemographics.ageRanges.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-3">Age Distribution</p>
                  {data.audienceDemographics.ageRanges.map(a => (
                    <div key={a.range} className="flex items-center gap-3 mb-2 text-xs">
                      <span className="w-12 text-muted-foreground">{a.range}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full amber-gradient" style={{ width: `${a.pct}%` }} />
                      </div>
                      <span className="font-medium w-8 text-right">{a.pct}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg">
                  Demographics available once account has enough data (100+ followers + activity).
                </p>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-2">Gender Split</p>
                <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                  <div className="h-full bg-blue-400" style={{ width: `${data.audienceDemographics.genderSplit.male}%` }} />
                  <div className="h-full bg-pink-400" style={{ width: `${data.audienceDemographics.genderSplit.female}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                  <span>♂ Male {data.audienceDemographics.genderSplit.male}%</span>
                  <span>♀ Female {data.audienceDemographics.genderSplit.female}%</span>
                </div>
              </div>

              {data.audienceDemographics.topLocations.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Top Locations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.audienceDemographics.topLocations.map((loc, i) => (
                      <span key={loc} className={`px-2.5 py-1 rounded-full text-xs font-medium ${i === 0 ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}>{loc}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Best times */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <p className="font-semibold text-sm">Best Times to Post</p>
              </div>
              <p className="text-xs text-muted-foreground">Indian creators ke liye (IST)</p>
              {[
                { day: "Mon", time: "7–9 PM", label: "Highest engagement", rank: 1 },
                { day: "Wed", time: "7–9 PM", label: "Mid-week peak",      rank: 2 },
                { day: "Fri", time: "8–10 PM", label: "Weekend prep",      rank: 3 },
                { day: "Sun", time: "6–8 PM", label: "Leisure time",       rank: 4 },
              ].map((item, i) => (
                <div key={item.day} className={`flex items-center gap-3 p-3 rounded-xl text-sm ${i === 0 ? "border border-amber-400/30 bg-amber-400/5" : "bg-muted/30"}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}>{item.rank}</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.day} {item.time} IST</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                  {i === 0 && <span className="text-xs text-amber-500 font-bold">Best ⭐</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {addingTask && <AddTaskModal onAdd={handleAddTask} onClose={() => setAddingTask(false)} platform="instagram" />}
    </div>
  );
}
