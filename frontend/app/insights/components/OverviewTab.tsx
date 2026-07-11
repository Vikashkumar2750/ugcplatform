import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Info, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ClipboardList, CheckCircle2, Circle, SkipForward, Zap, Trophy, Plus, X } from "lucide-react";
import { fetchWithCache } from "../lib/fetchWithCache";

export default function OverviewTab({ timeRange, accountId, platform = "instagram" }: { timeRange: string, accountId?: string, platform?: string }) {
  const [data, setData] = useState<any>(null);
  const [tasks, setTasks] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingTask, setAddingTask] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const daysInt = parseInt(timeRange.replace("d", ""), 10) || 28;
        const json = await fetchWithCache(`/api/insights/proxy/${platform}/${accountId}/overview?days=${daysInt}`);
        const metrics = json.data || [];
        
        try {
          const taskRes = await fetch(`/api/insights/tasks?platform=${platform}`);
          if (taskRes.ok) setTasks(await taskRes.json());
        } catch (e) {
          console.error("Failed to load tasks", e);
        }
        
        // Find metrics
        const findMetric = (name: string) => {
          const m = metrics.find((m: any) => m.name === name);
          return m?.total_value?.value ?? m?.values?.[0]?.value ?? 0;
        };
        
        const reach = findMetric("reach") || findMetric("page_impressions_unique") || 0;
        const impressions = findMetric("impressions") || findMetric("views") || findMetric("page_impressions") || 0;
        const profileViews = findMetric("profile_views") || findMetric("page_views_total") || 0;
        
        // Chart data - we take the timeline values
        const reachData = metrics.find((m: any) => m.name === "reach" || m.name === "page_impressions_unique")?.values || [];
        const impData = metrics.find((m: any) => m.name === "impressions" || m.name === "views" || m.name === "page_impressions")?.values || [];
        
        const chartData = reachData.map((r: any, i: number) => {
          const date = new Date(r.end_time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return {
            date,
            reach: r.value,
            impressions: impData[i]?.value || 0
          };
        });

        setData({
          reach,
          impressions,
          profileViews,
          netFollowers: 0, // Since we don't have historical followers API in basic tier
          chartData: chartData.length > 0 ? chartData : [
            { date: "N/A", reach: reach, impressions: impressions }
          ]
        });
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [timeRange, accountId, platform]);

  const handleTaskToggle = async (id: string, newStatus: string) => {
    try {
      await fetch("/api/insights/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: newStatus }) });
      const taskRes = await fetch(`/api/insights/tasks?platform=${platform}`);
      if (taskRes.ok) setTasks(await taskRes.json());
    } catch (e) { console.error(e); }
  };

  const handleAddTask = async (taskData: any) => {
    try {
      await fetch("/api/insights/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(taskData) });
      const taskRes = await fetch(`/api/insights/tasks?platform=${platform}`);
      if (taskRes.ok) setTasks(await taskRes.json());
    } catch (e) { console.error(e); }
  };

  if (!accountId) {
    return (
      <div className="p-12 text-center border border-border rounded-2xl bg-card">
        <p className="text-muted-foreground">Please select an account to view insights.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center border border-red-500/30 rounded-2xl bg-red-500/5">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  const allTasks = [...(tasks?.weekly || []), ...(tasks?.monthly || [])];
  const doneTasks = allTasks.filter(t => t.status === "done").length;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Account Reach" value={data.reach.toLocaleString()} trend="+12.5%" isUp={true} />
        <StatCard title="Impressions" value={data.impressions.toLocaleString()} trend="+5.2%" isUp={true} />
        <StatCard title="Profile Views" value={data.profileViews.toLocaleString()} trend="-2.1%" isUp={false} />
        <StatCard title="Net Followers" value={data.netFollowers.toLocaleString()} trend="+40" isUp={true} />
      </div>
      
      {/* Reach Chart */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            Reach Over Time <Info className="w-4 h-4 text-muted-foreground" />
          </h3>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#e4e4e7' }}
              />
              <Line type="monotone" dataKey="reach" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="Reach" />
              <Line type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={2} dot={false} name="Impressions" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TASKS SECTION */}
      <div className="space-y-5">
        <div className="p-5 rounded-3xl border border-border bg-card flex items-center justify-between gap-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-purple-500" /> Growth Planner checklist
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{doneTasks} of {allTasks.length} tasks completed</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${allTasks.length > 0 ? (doneTasks / allTasks.length) * 100 : 0}%` }} />
            </div>
            <button onClick={() => setAddingTask(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 transition shadow-sm">
              <Plus className="w-3.5 h-3.5" /> Add Task
            </button>
          </div>
        </div>

        {tasks?.weekly && tasks.weekly.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              <p className="font-semibold text-sm">Weekly Goals</p>
            </div>
            {tasks.weekly.filter((t: any) => t.status !== "skipped").map((task: any) => (
              <TaskItem key={task.id} task={task} onToggle={handleTaskToggle} />
            ))}
          </div>
        )}
      </div>

      {addingTask && <AddTaskModal onAdd={handleAddTask} onClose={() => setAddingTask(false)} platform={platform} />}
    </div>
  );
}

function StatCard({ title, value, trend, isUp }: { title: string, value: string, trend: string, isUp: boolean }) {
  return (
    <div className="p-5 rounded-2xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        <Info className="w-4 h-4 text-muted-foreground/60" />
      </div>
      <p className="text-2xl font-bold text-foreground mt-2">{value}</p>
      <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${isUp ? 'text-green-600 dark:text-green-500' : 'text-red-500 dark:text-red-400'}`}>
        {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        <span>{trend} vs prev period</span>
      </div>
    </div>
  );
}

function TaskItem({ task, onToggle }: { task: any; onToggle: (id: string, status: string) => void }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl transition-all ${task.status === "done" ? "opacity-60 bg-muted/20" : "bg-card border border-border hover:border-purple-400/30"}`}>
      <button onClick={() => onToggle(task.id, task.status === "done" ? "pending" : "done")} className="flex-shrink-0 mt-0.5">
        {task.status === "done" ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-purple-500 transition" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
        {task.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{task.description}</p>}
        {!task.auto_generated && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium mt-1 inline-block">Custom</span>}
      </div>
      {task.status !== "done" && (
        <button onClick={() => onToggle(task.id, "skipped")} className="text-muted-foreground/40 hover:text-muted-foreground mt-0.5">
          <SkipForward className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

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
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:border-purple-500" />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" rows={2}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:border-purple-500 resize-none" />
        <div className="flex gap-2">
          {(["weekly", "monthly"] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${type === t ? "border-purple-400 bg-purple-400/10 text-purple-600 dark:text-purple-400" : "border-border text-muted-foreground"}`}>
              {t === "weekly" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        <button onClick={() => { if (title.trim()) { onAdd({ title, description: desc, type, platform }); onClose(); }}}
          className="w-full py-2.5 rounded-xl bg-purple-500 text-white font-bold text-sm hover:bg-purple-600 transition">
          Add Task
        </button>
      </div>
    </div>
  );
}
