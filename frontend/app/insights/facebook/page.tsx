"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Share2, RefreshCw, Loader2, AlertCircle,
  Heart, MessageCircle, Users, Eye, BarChart3, Camera, ThumbsUp,
  ThumbsDown, Zap, Trophy, Plus, Circle, CheckCircle2, SkipForward, X,
  Clock, ArrowUpRight
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
interface FBInsightsData {
  connected: boolean;
  accountId?: string;
  pageName: string; fans: number; followers: number;
  category: string; totalReach: number; totalImpressions: number;
  totalViews: number; totalEngaged: number; engagementRate: number;
  postsCount: number;
  topPosts: { id: string; message: string; type: string; likes: number; comments: number; shares: number; created: string }[];
  fanGrowthChart: { date: string; fans: number }[] | null;
  accountType?: string;
  connectedAt?: string;
  availableAccounts?: { id: string; name: string; handle: string }[];
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
function StatCard({ label, value, sub, icon: Icon, up, highlight }: {
  label: string; value: string; sub?: string; icon?: any; up?: boolean | null; highlight?: boolean;
}) {
  return (
    <div className={`p-4 rounded-2xl border bg-card flex flex-col gap-2 ${highlight ? "border-blue-400/50 bg-blue-400/5" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        {Icon && <Icon className={`w-3.5 h-3.5 ${highlight ? "text-blue-500" : "text-muted-foreground/40"}`} />}
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

// ── Bar chart ─────────────────────────────────────────────────────
function BarChart({ data }: { data: { date: string; fans: number }[] }) {
  const max = Math.max(...data.map(d => d.fans)) || 1;
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t amber-gradient opacity-80" style={{ height: `${(d.fans / max) * 88}px` }} />
          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.date}</span>
        </div>
      ))}
    </div>
  );
}

// ── Insight ───────────────────────────────────────────────────────
function Insight({ type, text }: { type: "up" | "down" | "tip"; text: string }) {
  const cfg = {
    up:  { bg: "bg-green-500/8 border-green-500/20",  I: ThumbsUp,  ic: "text-green-500",  tc: "text-green-600 dark:text-green-400" },
    down:{ bg: "bg-red-500/8 border-red-500/20",      I: ThumbsDown,ic: "text-red-400",    tc: "text-red-500 dark:text-red-400" },
    tip: { bg: "bg-amber-500/8 border-amber-500/20",  I: Zap,       ic: "text-amber-500",  tc: "text-amber-600 dark:text-amber-400" },
  }[type];
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${cfg.bg}`}>
      <cfg.I className={`w-3.5 h-3.5 ${cfg.ic} flex-shrink-0 mt-0.5`} />
      <p className={`text-xs leading-relaxed ${cfg.tc}`}>{text}</p>
    </div>
  );
}

// ── Task item ─────────────────────────────────────────────────────
function TaskItem({ task, onToggle }: { task: Task; onToggle: (id: string, status: Task["status"]) => void }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl transition-all ${task.status === "done" ? "opacity-60 bg-muted/20" : "bg-card border border-border hover:border-blue-400/30"}`}>
      <button onClick={() => onToggle(task.id, task.status === "done" ? "pending" : "done")} className="flex-shrink-0 mt-0.5">
        {task.status === "done" ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-blue-500 transition" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
        {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
        {!task.auto_generated && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium mt-1 inline-block">Custom</span>}
      </div>
      {task.status !== "done" && (
        <button onClick={() => onToggle(task.id, "skipped")} className="text-muted-foreground/40 hover:text-muted-foreground">
          <SkipForward className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── Add Task Modal ────────────────────────────────────────────────
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
export default function FacebookInsightsPage() {
  const [data, setData] = useState<FBInsightsData | null>(null);
  const [tasks, setTasks] = useState<TasksData | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "tasks">("overview");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

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
      if (targetAccountId) params.append("accountId", targetAccountId);
      if (params.toString()) url += "?" + params.toString();

      const [insRes, taskRes, histRes] = await Promise.all([
        fetch(url),
        fetch("/api/insights/tasks?platform=facebook"),
        fetch("/api/insights/tasks/history?platform=facebook"),
      ]);
      const insJson = await insRes.json();
      if (insRes.status === 404 && insJson.error === "not_connected") { 
        sessionStorage.removeItem("fb_insights_default");
        if (targetAccountId) sessionStorage.removeItem(`fb_insights_${targetAccountId}`);
        setNotConnected(true); 
        return; 
      }
      if (insRes.status === 429) { setError(`Rate limited: ${insJson.error}`); return; }
      if (!insRes.ok) { setError(insJson.error || "Failed to load"); return; }
      setData(insJson);

      // Save to sessionStorage
      const idToCache = targetAccountId || insJson.availableAccounts?.[0]?.id;
      if (idToCache) {
        setSessionCache(`fb_insights_${idToCache}`, insJson);
        setSessionCache("fb_insights_default", insJson);
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
        <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-500" />
        <p className="text-muted-foreground text-sm">Fetching Facebook Page data...</p>
      </div>
    </div>
  );

  if (notConnected) return (
    <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <Share2 className="w-14 h-14 mx-auto text-muted-foreground/30" />
        <h2 className="font-heading text-xl font-bold">Facebook Connect Nahi Hai</h2>
        <Link href="/connect" className="px-6 py-3 rounded-xl bg-blue-500 text-white text-sm font-bold inline-flex items-center gap-2">
          <Share2 className="w-4 h-4" /> Connect Facebook
        </Link>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <h2 className="font-heading text-lg font-bold">Load Failed</h2>
        <p className="text-muted-foreground text-sm max-w-sm">{error}</p>
        <button onClick={() => fetchAll(true, selectedAccountId)} className="btn-amber px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  );

  const er = data.engagementRate;
  const positives: string[] = [], negatives: string[] = [], tips: string[] = [];
  if (er >= 5) positives.push(`Page engagement rate ${er}% excellent hai! Facebook average 0.5-1% hai.`);
  else if (er >= 1) positives.push(`Engagement rate ${er}% above Facebook average (0.5-1%) ✓`);
  else negatives.push(`Engagement rate ${er}% bahut low hai. Video + polls + questions try karo.`);
  if (data.totalReach > data.fans * 0.5) positives.push(`Reach ${fmt(data.totalReach)} — posts followers se bahar bhi ja rahe hain ✓`);
  if (data.postsCount < 8) negatives.push(`Sirf ${data.postsCount} posts in 30 days — 10-15 posts/month target karo.`);
  else positives.push(`${data.postsCount} posts this month — good consistency ✓`);
  tips.push("Facebook Reels post karo — organic reach best milti hai currently.");
  tips.push("Polls aur questions se engagement boost hoti hai.");

  const chartData = data.fanGrowthChart || [
    { date: "W1", fans: Math.round(data.fans * 0.95) },
    { date: "W2", fans: Math.round(data.fans * 0.97) },
    { date: "W3", fans: Math.round(data.fans * 0.99) },
    { date: "Now", fans: data.fans },
  ];

  const allTasks = [...(tasks?.weekly || []), ...(tasks?.monthly || [])];
  const doneTasks = allTasks.filter(t => t.status === "done").length;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-16 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-xl font-bold">{data.pageName}</h1>
          <p className="text-muted-foreground text-xs">{data.category || "Page"} · {data.postsCount} posts</p>
        </div>

        {data.availableAccounts && data.availableAccounts.length > 1 && (
          <div className="ml-4 flex items-center">
            <select
              value={selectedAccountId || data.accountId || data.availableAccounts[0].id}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-muted/40 border border-border text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[200px] truncate"
            >
              {data.availableAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button onClick={() => fetchAll(true, selectedAccountId)} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted/60 transition">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Fetching..." : "Refresh"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border w-fit">
        {(["overview", "tasks"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition capitalize ${activeTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {tab === "tasks" ? `Tasks (${doneTasks}/${allTasks.length})` : "Overview"}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Page Fans" value={fmt(data.fans)} sub="total followers" icon={Users} />
            <StatCard label="Engagement Rate" value={`${er}%`}
              sub={er >= 1 ? "Above FB avg (1%) ✓" : "Below avg — boost posts"}
              up={er >= 1} highlight={er >= 1} icon={BarChart3} />
            <StatCard label="30d Reach" value={data.totalReach > 0 ? fmt(data.totalReach) : "—"} sub="unique accounts" icon={Eye} />
            <StatCard label="30d Impressions" value={data.totalImpressions > 0 ? fmt(data.totalImpressions) : "—"} sub="total views" icon={ArrowUpRight} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Page Views" value={data.totalViews > 0 ? fmt(data.totalViews) : "—"} sub="30 days" icon={Eye} />
            <StatCard label="Engaged Users" value={data.totalEngaged > 0 ? fmt(data.totalEngaged) : "—"} sub="30 days" icon={Users} />
            <StatCard label="Posts This Month" value={String(data.postsCount)} sub="published" icon={Camera} up={data.postsCount >= 10} />
          </div>

          {/* Analysis */}
          <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
            <p className="font-semibold text-sm">Page Analysis</p>
            {positives.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-green-500 uppercase tracking-wider">✅ Strengths</p>
                {positives.map((t, i) => <Insight key={i} type="up" text={t} />)}
              </div>
            )}
            {negatives.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider">⚠️ Improvements</p>
                {negatives.map((t, i) => <Insight key={i} type="down" text={t} />)}
              </div>
            )}
            {tips.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">💡 Tips</p>
                {tips.map((t, i) => <Insight key={i} type="tip" text={t} />)}
              </div>
            )}
          </div>

          {/* Fan growth chart */}
          <div className="p-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-sm">Fan Growth</p>
              <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                {data.fanGrowthChart ? "Live API" : "Estimated"}
              </span>
            </div>
            <BarChart data={chartData} />
          </div>

          {/* Top posts */}
          {data.topPosts.length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <p className="font-semibold text-sm">Top Posts</p>
              </div>
              <div className="divide-y divide-border">
                {data.topPosts.map((post, i) => (
                  <div key={post.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${i === 0 ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{post.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(post.created).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{fmt(post.likes)}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{fmt(post.comments)}</span>
                      <span className="flex items-center gap-1"><Share2 className="w-3 h-3" />{fmt(post.shares)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl border border-border bg-card flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Progress this period</p>
              <p className="text-xs text-muted-foreground mt-0.5">{doneTasks} of {allTasks.length} tasks completed</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${allTasks.length > 0 ? (doneTasks / allTasks.length) * 100 : 0}%` }} />
              </div>
              <button onClick={() => setAddingTask(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </div>

          {tasks?.weekly && tasks.weekly.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" />
                <p className="font-semibold text-sm">Weekly Tasks</p>
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
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
              <p className="font-semibold text-sm">Past 3 Months</p>
              {history.map(h => {
                const pct = h.tasks_total > 0 ? Math.round((h.tasks_done / h.tasks_total) * 100) : 0;
                return (
                  <div key={h.period_key} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    <span className="text-xs font-medium text-muted-foreground w-20">{h.period_key}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-blue-500">{h.tasks_done}/{h.tasks_total}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {addingTask && <AddTaskModal onAdd={handleAddTask} onClose={() => setAddingTask(false)} />}
    </div>
  );
}
