"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, Users, TrendingUp, Activity, RefreshCw, Loader2, Camera, PlayCircle, Share2 } from "lucide-react";

interface PlatformStat {
  platform: string;
  connected: number;
  analyses: number;
  color: string;
  border: string;
}

interface NicheStat {
  niche: string;
  users: number;
  analyses: number;
}

interface TopUser {
  name: string;
  email: string;
  analyses: number;
  platforms: string[];
  niche: string;
  tier: string;
  accountsCount: number;
}

interface AnalyticsData {
  platformStats: PlatformStat[];
  nicheStats: NicheStat[];
  topUsers: TopUser[];
  totals: { users: number; analyses: number; connectedAccounts: number; automationRules: number; activeRules: number };
}

const PLATFORM_ICONS: Record<string, any> = { instagram: Camera, youtube: PlayCircle, facebook: Share2 };
const PLATFORM_LABELS: Record<string, string> = { instagram: "IG", youtube: "YT", facebook: "FB", linkedin: "LI" };
const PLATFORM_COLORS: Record<string, string> = { instagram: "text-pink-400", youtube: "text-red-400", facebook: "text-blue-400", linkedin: "text-sky-400" };
const TIER_BADGE: Record<string, string> = {
  free: "bg-zinc-700/50 text-zinc-400",
  pro: "bg-violet-500/15 text-violet-400",
  admin_granted: "bg-amber-500/15 text-amber-400",
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-100">Platform Analytics</h1>
          <p className="text-zinc-500 text-sm">Real-time data from your database</p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading analytics...
        </div>
      ) : !data ? (
        <div className="text-center py-24 text-zinc-600 text-sm">
          Could not load analytics. Check Supabase connection.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Total Users", value: data.totals.users, color: "text-blue-400" },
              { label: "Total Analyses", value: data.totals.analyses, color: "text-purple-400" },
              { label: "Connected Accounts", value: data.totals.connectedAccounts, color: "text-green-400" },
              { label: "Automation Rules", value: data.totals.automationRules, color: "text-amber-400" },
              { label: "Active Rules", value: data.totals.activeRules, color: "text-emerald-400" },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950">
                <p className={`font-heading text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-zinc-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Platform cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {data.platformStats.map(p => {
              const Icon = PLATFORM_ICONS[p.platform] || Activity;
              return (
                <div key={p.platform} className={`rounded-xl border ${p.border} bg-zinc-950 overflow-hidden`}>
                  <div className={`h-1.5 bg-gradient-to-r ${p.color}`} />
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-zinc-100 capitalize">{p.platform}</h3>
                      <Icon className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="font-heading text-xl font-bold text-zinc-100">{p.connected}</p>
                        <p className="text-xs text-zinc-500">Connected</p>
                      </div>
                      <div>
                        <p className="font-heading text-xl font-bold text-zinc-100">{p.analyses}</p>
                        <p className="text-xs text-zinc-500">Analyses</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Niche breakdown + Top users */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Niche */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800">
                <h2 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" /> Niche Distribution
                </h2>
              </div>
              {data.nicheStats.length === 0 ? (
                <div className="px-5 py-8 text-center text-zinc-600 text-sm">No niche data yet</div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {data.nicheStats.slice(0, 10).map(n => {
                    const maxUsers = Math.max(...data.nicheStats.map(x => x.users), 1);
                    return (
                      <div key={n.niche} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-900/50 transition">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-200 truncate">{n.niche || "Not specified"}</p>
                          <p className="text-xs text-zinc-500">{n.analyses} analyses</p>
                        </div>
                        <div className="w-24 h-2 rounded-full bg-zinc-800 overflow-hidden">
                          <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${(n.users / maxUsers) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-zinc-300 w-8 text-right">{n.users}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top users */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800">
                <h2 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" /> Top Users by Analyses
                </h2>
              </div>
              {data.topUsers.length === 0 ? (
                <div className="px-5 py-8 text-center text-zinc-600 text-sm">No users yet</div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {data.topUsers.map((u, i) => (
                    <div key={u.email} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-900/50 transition">
                      <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{u.name || u.email}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {u.platforms.map(p => (
                            <span key={p} className={`text-[10px] font-bold ${PLATFORM_COLORS[p] || "text-zinc-500"}`}>
                              {PLATFORM_LABELS[p] || p}
                            </span>
                          ))}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${TIER_BADGE[u.tier] || TIER_BADGE.free}`}>
                            {u.tier}
                          </span>
                          {u.accountsCount > 1 && (
                            <span className="text-[10px] text-violet-400">{u.accountsCount} accounts</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-amber-400 text-sm">{u.analyses}</p>
                        <p className="text-[10px] text-zinc-500">analyses</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
