"use client";

import { useState } from "react";
import { BarChart3, Users, Link2, TrendingUp, Activity } from "lucide-react";

const PLATFORM_STATS = [
  { platform: "Instagram", connected: 89, analyses: 342, avgER: "3.4%", topNiche: "Fitness", color: "from-pink-500 to-purple-500", border: "border-pink-500/20" },
  { platform: "Facebook", connected: 21, analyses: 87, avgER: "2.1%", topNiche: "Food", color: "from-blue-600 to-blue-400", border: "border-blue-500/20" },
  { platform: "YouTube", connected: 43, analyses: 160, avgER: "4.8%", topNiche: "Finance", color: "from-red-600 to-red-400", border: "border-red-500/20" },
];

const NICHE_STATS = [
  { niche: "Fitness", users: 58, analyses: 142, avgScripts: 5.2 },
  { niche: "Finance", users: 45, analyses: 187, avgScripts: 6.1 },
  { niche: "Tech", users: 36, analyses: 98, avgScripts: 4.8 },
  { niche: "Food", users: 29, analyses: 67, avgScripts: 3.9 },
  { niche: "Beauty", users: 22, analyses: 54, avgScripts: 4.3 },
  { niche: "Travel", users: 18, analyses: 41, avgScripts: 3.7 },
];

const TOP_USERS = [
  { name: "Aryan Mehta", email: "aryan@gmail.com", analyses: 12, scripts: 84, platforms: ["instagram", "facebook"], niche: "Tech" },
  { name: "Amit Kumar", email: "amit@gmail.com", analyses: 9, scripts: 63, platforms: ["instagram"], niche: "Comedy" },
  { name: "Rahul Kumar", email: "rahul@gmail.com", analyses: 7, scripts: 49, platforms: ["youtube", "instagram"], niche: "Finance" },
];

const PLATFORM_LABELS: Record<string, string> = { instagram: "IG", youtube: "YT", facebook: "FB" };
const PLATFORM_COLORS: Record<string, string> = { instagram: "text-pink-400", youtube: "text-red-400", facebook: "text-blue-400" };

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="font-heading text-2xl font-bold text-zinc-100">Platform Analytics</h1>
        <p className="text-zinc-500 text-sm">User-wise connections, analysis patterns, and engagement data</p>
      </div>

      {/* Platform cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLATFORM_STATS.map(p => (
          <div key={p.platform} className={`rounded-xl border ${p.border} bg-zinc-950 overflow-hidden`}>
            <div className={`h-1.5 bg-gradient-to-r ${p.color}`} />
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-zinc-100">{p.platform}</h3>
                <Link2 className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="font-heading text-xl font-bold text-zinc-100">{p.connected}</p><p className="text-xs text-zinc-500">Connected</p></div>
                <div><p className="font-heading text-xl font-bold text-zinc-100">{p.analyses}</p><p className="text-xs text-zinc-500">Analyses</p></div>
                <div><p className="font-heading text-lg font-bold text-amber-400">{p.avgER}</p><p className="text-xs text-zinc-500">Avg ER</p></div>
                <div><p className="font-heading text-sm font-bold text-zinc-300">{p.topNiche}</p><p className="text-xs text-zinc-500">Top Niche</p></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Niche breakdown */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="font-semibold text-zinc-100 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-amber-400" /> Niche Breakdown</h2>
          <div className="space-y-3">
            {NICHE_STATS.map((n, i) => {
              const maxAnalyses = Math.max(...NICHE_STATS.map(x => x.analyses));
              return (
                <div key={n.niche}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-300">{n.niche}</span>
                    <div className="flex gap-4 text-xs text-zinc-500">
                      <span>{n.users} users</span>
                      <span>{n.analyses} analyses</span>
                      <span className="text-amber-400">{n.avgScripts} avg scripts</span>
                    </div>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: `${(n.analyses / maxAnalyses) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top users */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="font-semibold text-zinc-100 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-400" /> Power Users</h2>
          <div className="space-y-3">
            {TOP_USERS.map((u, i) => (
              <div key={u.email} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{u.name}</p>
                  <p className="text-xs text-zinc-500">{u.niche} · {u.analyses} analyses · {u.scripts} scripts</p>
                </div>
                <div className="flex gap-1">
                  {u.platforms.map(p => (
                    <span key={p} className={`text-[10px] font-bold ${PLATFORM_COLORS[p]}`}>{PLATFORM_LABELS[p]}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Total Connected", value: "153", sub: "accounts" },
              { label: "Avg/User", value: "0.62", sub: "connections" },
              { label: "With All 3", value: "12", sub: "users" },
            ].map(s => (
              <div key={s.label}>
                <p className="font-bold text-zinc-100">{s.value}</p>
                <p className="text-[10px] text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
