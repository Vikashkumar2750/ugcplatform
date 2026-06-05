"use client";

import { useEffect, useState } from "react";
import { Users, BarChart3, FileText, IndianRupee, TrendingUp, Activity, Clock, CheckCircle2, AlertCircle, LifeBuoy, ArrowUpRight, ArrowDownRight, RefreshCw, Database, Zap, Globe, Bot } from "lucide-react";

interface Stats {
  demo: boolean;
  totalUsers: number;
  activeSubscriptions: number;
  freeUsers: number;
  bannedUsers: number;
  mrr: number;
  totalRevenue: number;
  totalAnalyses: number;
  openTickets: number;
  platformBreakdown: { instagram: number; youtube: number; facebook: number };
  connectedAccounts: { instagram: number; youtube: number; facebook: number };
  planBreakdown: { lifetime: number; monthly: number; yearly: number; free: number };
  recentActivity: any[];
}

interface ApiUsage {
  providers: Array<{
    id: string; label: string; color: string;
    dailyRequests: number; dailyLimit: number; dailyPct: number;
    monthlyTokens: number; monthlyTokenLimit: number; monthlyPct: number;
    totalMonth: number; errors: number;
  }>;
  meta: { label: string; webhooksToday: number; webhooksMonth: number; hourlyLimit: number };
  totalMonth: number;
}

const EMPTY: Stats = {
  demo: true, totalUsers: 0, activeSubscriptions: 0, freeUsers: 0, bannedUsers: 0,
  mrr: 0, totalRevenue: 0, totalAnalyses: 0, openTickets: 0,
  platformBreakdown: { instagram: 0, youtube: 0, facebook: 0 },
  connectedAccounts: { instagram: 0, youtube: 0, facebook: 0 },
  planBreakdown: { lifetime: 0, monthly: 0, yearly: 0, free: 0 },
  recentActivity: [],
};

function DemoBanner() {
  return (
    <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm">
      <Database className="w-4 h-4 flex-shrink-0" />
      <div>
        <span className="font-bold">Demo Mode</span>
        <span className="text-amber-400/70 ml-2">— Supabase not connected. All values show 0. Configure Supabase to see real data.</span>
      </div>
      <a href="/admin/setup" className="ml-auto text-xs px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition font-medium whitespace-nowrap">
        Setup Guide →
      </a>
    </div>
  );
}

function UsageBar({ label, used, limit, pct, color, sub }: {
  label: string; used: number | string; limit: number | string; pct: number; color: string; sub?: string;
}) {
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : color;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-300 font-medium">{label}</span>
        <span className={`font-bold ${pct >= 90 ? "text-red-400" : pct >= 70 ? "text-amber-400" : "text-zinc-200"}`}>
          {used} / {limit}
          {pct >= 90 && <span className="ml-1 text-red-400">⚠</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct || 0}%` }} />
      </div>
      {sub && <p className="text-[10px] text-zinc-600">{sub}</p>}
    </div>
  );
}

function ApiUsageSection() {
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/api-usage");
      if (res.ok) setUsage(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchUsage(); }, []);

  const colorMap: Record<string, string> = {
    blue: "bg-blue-500", orange: "bg-orange-500", purple: "bg-purple-500", green: "bg-green-500",
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold text-sm text-zinc-100">AI & API Usage — Real Time</h2>
        </div>
        <button onClick={fetchUsage} disabled={loading}
          className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition disabled:opacity-40">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="p-5 space-y-6">
        {loading ? (
          <div className="text-center py-8 text-zinc-600 text-sm">Loading usage data...</div>
        ) : !usage ? (
          <div className="text-center py-8 text-zinc-600 text-sm">
            Could not load usage. Make sure api_usage_logs table exists.
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <p className="text-lg font-bold text-zinc-100">{usage.totalMonth}</p>
                <p className="text-[10px] text-zinc-500">API calls this month</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <p className="text-lg font-bold text-zinc-100">{usage.meta.webhooksToday}</p>
                <p className="text-[10px] text-zinc-500">Meta webhooks today</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <p className="text-lg font-bold text-zinc-100">{usage.providers.reduce((s, p) => s + p.errors, 0)}</p>
                <p className="text-[10px] text-zinc-500">Errors this month</p>
              </div>
            </div>

            {/* LLM Providers */}
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">AI Model Usage (Daily Requests)</p>
              <div className="space-y-4">
                {usage.providers.map(p => (
                  <div key={p.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${colorMap[p.color] || "bg-zinc-500"}`} />
                      <span className="text-xs font-medium text-zinc-200">{p.label}</span>
                      {p.errors > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">{p.errors} errors</span>
                      )}
                    </div>
                    <UsageBar
                      label="Daily Requests"
                      used={p.dailyRequests}
                      limit={p.dailyLimit}
                      pct={p.dailyPct}
                      color={colorMap[p.color] || "bg-zinc-500"}
                      sub={`${p.totalMonth} calls this month · ${(p.monthlyTokens / 1000).toFixed(0)}K tokens`}
                    />
                    <UsageBar
                      label="Monthly Tokens"
                      used={`${(p.monthlyTokens / 1000).toFixed(0)}K`}
                      limit={`${(p.monthlyTokenLimit / 1000).toFixed(0)}K`}
                      pct={p.monthlyPct}
                      color={colorMap[p.color] || "bg-zinc-500"}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Meta Graph API */}
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Meta Graph API (Webhooks)</p>
              <UsageBar
                label="Webhooks Today"
                used={usage.meta.webhooksToday}
                limit="∞"
                pct={Math.min(100, Math.round((usage.meta.webhooksToday / 1000) * 100))}
                color="bg-blue-500"
                sub={`${usage.meta.webhooksMonth} webhooks this month`}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      setStats(data);
      setLastUpdated(new Date().toLocaleTimeString("en-IN"));
    } catch { setStats(EMPTY); }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const STAT_CARDS = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-400" },
    { label: "Active Paid", value: stats.activeSubscriptions, icon: CheckCircle2, color: "text-green-400" },
    { label: "Free Users", value: stats.freeUsers, icon: Users, color: "text-zinc-400" },
    { label: "Banned", value: stats.bannedUsers, icon: AlertCircle, color: "text-red-400" },
    { label: "MRR (approx)", value: `₹${stats.mrr.toFixed(0)}`, icon: IndianRupee, color: "text-amber-400" },
    { label: "Total Revenue", value: `₹${stats.totalRevenue}`, icon: TrendingUp, color: "text-emerald-400" },
    { label: "Total Analyses", value: stats.totalAnalyses, icon: BarChart3, color: "text-purple-400" },
    { label: "Open Tickets", value: stats.openTickets, icon: LifeBuoy, color: "text-red-400" },
  ];

  const PLAN_CARDS = [
    { label: "Lifetime", value: stats.planBreakdown.lifetime, color: "text-amber-400" },
    { label: "Monthly", value: stats.planBreakdown.monthly, color: "text-blue-400" },
    { label: "Yearly", value: stats.planBreakdown.yearly, color: "text-purple-400" },
    { label: "Free", value: stats.planBreakdown.free, color: "text-zinc-400" },
  ];

  const platformTotal = stats.platformBreakdown.instagram + stats.platformBreakdown.youtube + stats.platformBreakdown.facebook || 1;
  const PLATFORM_BARS = [
    { platform: "Instagram", users: stats.platformBreakdown.instagram, connected: stats.connectedAccounts.instagram, pct: Math.round((stats.platformBreakdown.instagram / platformTotal) * 100), color: "bg-pink-500" },
    { platform: "YouTube", users: stats.platformBreakdown.youtube, connected: stats.connectedAccounts.youtube, pct: Math.round((stats.platformBreakdown.youtube / platformTotal) * 100), color: "bg-red-500" },
    { platform: "Facebook", users: stats.platformBreakdown.facebook, connected: stats.connectedAccounts.facebook, pct: Math.round((stats.platformBreakdown.facebook / platformTotal) * 100), color: "bg-blue-500" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-100">Platform Overview</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {loading ? "Loading..." : lastUpdated ? `Last updated: ${lastUpdated}` : "Real-time metrics"}
          </p>
        </div>
        <button onClick={fetchStats} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {stats.demo && <DemoBanner />}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STAT_CARDS.map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition">
            <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
            <p className="font-heading text-xl font-bold text-zinc-100">{loading ? "—" : s.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Plan breakdown + Platform breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent activity */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-zinc-100">Recent Activity</h2>
            <span className="text-xs text-zinc-600">{stats.recentActivity.length} events</span>
          </div>
          {stats.recentActivity.length === 0 ? (
            <div className="px-5 py-8 text-center text-zinc-600 text-sm">
              {stats.demo ? "No data — connect Supabase to see live activity" : "No recent activity"}
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {stats.recentActivity.slice(0, 8).map((a, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3.5 hover:bg-zinc-900/50 transition">
                  <LifeBuoy className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{a.user}</p>
                    <p className="text-xs text-zinc-500 truncate">{a.detail}</p>
                  </div>
                  <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                    {new Date(a.time).toLocaleDateString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform + Plan */}
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="font-semibold text-sm text-zinc-100 mb-4">Platform Split</h2>
            {PLATFORM_BARS.map(p => (
              <div key={p.platform} className="space-y-1.5 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-300">{p.platform}</span>
                  <span className="font-bold text-zinc-100">{p.users} <span className="text-zinc-500 text-xs">({p.pct}%)</span></span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div className={`h-full rounded-full ${p.color} transition-all duration-700`} style={{ width: `${p.pct || 0}%` }} />
                </div>
                <p className="text-[10px] text-zinc-600">{p.connected} accounts connected</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="font-semibold text-sm text-zinc-100 mb-3">Plan Breakdown</h2>
            <div className="grid grid-cols-2 gap-2">
              {PLAN_CARDS.map(p => (
                <div key={p.label} className="text-center p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  <p className={`font-bold text-lg ${p.color}`}>{loading ? "—" : p.value}</p>
                  <p className="text-[10px] text-zinc-500">{p.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── AI & API Usage ────────────────────────────────────────────── */}
      <ApiUsageSection />

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Manage Users", href: "/admin/users", color: "border-blue-500/20 hover:border-blue-500/40" },
          { label: "Subscriptions", href: "/admin/subscriptions", color: "border-amber-500/20 hover:border-amber-500/40" },
          { label: "View Tickets", href: "/admin/tickets", color: "border-red-500/20 hover:border-red-500/40" },
          { label: "Transactions", href: "/admin/transactions", color: "border-green-500/20 hover:border-green-500/40" },
        ].map(a => (
          <a key={a.label} href={a.href}
            className={`p-4 rounded-xl border ${a.color} bg-zinc-900/50 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition text-center`}>
            {a.label} →
          </a>
        ))}
      </div>
    </div>
  );
}

