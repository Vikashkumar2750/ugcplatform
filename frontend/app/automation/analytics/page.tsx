"use client";

import { useState, useEffect } from "react";
import {
  BarChart3, TrendingUp, MessageSquare, Send, ShieldCheck,
  Clock, Users, Zap, RefreshCw, Loader2, ArrowUpRight,
  ArrowDownRight, CheckCircle2, XCircle, Bot, Target
} from "lucide-react";

interface AutomationStats {
  totalRules: number;
  activeRules: number;
  totalTriggers: number;
  totalSent: number;
  totalBlocked: number;
  avgConfidence: number;
  topRules: Array<{ name: string; triggers: number; type: string }>;
  hourlyActivity: number[];
  recentActivity: Array<{ type: string; detail: string; time: string }>;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "7d" | "30d">("7d");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/automation/analytics?period=${period}`)
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading analytics...
      </div>
    );
  }

  const s = stats || {
    totalRules: 0, activeRules: 0, totalTriggers: 0, totalSent: 0,
    totalBlocked: 0, avgConfidence: 0, topRules: [], hourlyActivity: Array(24).fill(0),
    recentActivity: [],
  };

  const deliveryRate = (s.totalTriggers > 0)
    ? Math.round(((s.totalSent) / s.totalTriggers) * 100)
    : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-cyan-500" />
            Automation Analytics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Performance metrics for your DM automation, comment rules, and AI replies
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50">
          {(["today", "7d", "30d"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                period === p ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {p === "today" ? "Today" : p === "7d" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Triggers", value: s.totalTriggers, icon: Zap, color: "text-amber-400", bg: "bg-amber-400/10", trend: "+12%" },
          { label: "Messages Sent", value: s.totalSent, icon: Send, color: "text-emerald-400", bg: "bg-emerald-400/10", trend: "+8%" },
          { label: "Delivery Rate", value: `${deliveryRate}%`, icon: Target, color: "text-cyan-400", bg: "bg-cyan-400/10", trend: deliveryRate > 90 ? "+2%" : "-3%" },
          { label: "AI Confidence", value: `${s.avgConfidence}%`, icon: Bot, color: "text-violet-400", bg: "bg-violet-400/10", trend: "+5%" },
        ].map(metric => (
          <div key={metric.label} className="p-5 rounded-2xl border border-border bg-card group hover:border-foreground/10 transition">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${metric.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <metric.icon className={`w-5 h-5 ${metric.color}`} />
              </div>
              {metric.trend && (
                <span className={`text-xs font-bold flex items-center gap-0.5 ${
                  metric.trend.startsWith("+") ? "text-emerald-400" : "text-red-400"
                }`}>
                  {metric.trend.startsWith("+") ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {metric.trend}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold font-heading">{metric.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{metric.label}</p>
          </div>
        ))}
      </div>

      {/* Activity Heatmap + Top Rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hourly Activity */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Hourly Activity (Last 24h)
          </h3>
          <div className="flex items-end gap-[3px] h-24">
            {s.hourlyActivity.map((count, i) => {
              const maxVal = Math.max(...s.hourlyActivity, 1);
              const height = Math.max(4, (count / maxVal) * 100);
              return (
                <div key={i} className="flex-1 group relative">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-cyan-500/40 to-cyan-400/80 transition-all group-hover:from-cyan-500/60 group-hover:to-cyan-400"
                    style={{ height: `${height}%` }}
                  />
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-card border border-border rounded-md px-1.5 py-0.5 text-[9px] shadow-lg whitespace-nowrap z-10">
                    {i}:00 — {count} msgs
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
          </div>
        </div>

        {/* Top Rules */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            Top Performing Rules
          </h3>
          {s.topRules.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No automation rules yet</p>
          ) : (
            <div className="space-y-2">
              {s.topRules.slice(0, 5).map((rule, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition">
                  <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{rule.name}</p>
                    <p className="text-[10px] text-muted-foreground">{rule.type}</p>
                  </div>
                  <span className="text-sm font-bold text-amber-400">{rule.triggers}</span>
                  <span className="text-[10px] text-muted-foreground">triggers</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline Summary */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Message Pipeline Summary
        </h3>
        <div className="flex items-center gap-2">
          {[
            { label: "Triggered", value: s.totalTriggers, color: "bg-blue-400" },
            { label: "→", value: "", color: "" },
            { label: "Compliance OK", value: s.totalTriggers - s.totalBlocked, color: "bg-emerald-400" },
            { label: "→", value: "", color: "" },
            { label: "Sent", value: s.totalSent, color: "bg-cyan-400" },
            { label: "→", value: "", color: "" },
            { label: "Blocked", value: s.totalBlocked, color: "bg-red-400" },
          ].map((step, i) => (
            step.label === "→" ? (
              <span key={i} className="text-muted-foreground text-lg">→</span>
            ) : (
              <div key={i} className="flex-1 text-center p-3 rounded-xl bg-muted/30 border border-border">
                <div className={`w-2.5 h-2.5 rounded-full ${step.color} mx-auto mb-1.5`} />
                <p className="text-lg font-bold">{step.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{step.label}</p>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Rules Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Rules", value: s.totalRules, icon: MessageSquare, color: "text-blue-400" },
          { label: "Active Rules", value: s.activeRules, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Messages Blocked", value: s.totalBlocked, icon: XCircle, color: "text-red-400" },
          { label: "Unique Recipients", value: "—", icon: Users, color: "text-purple-400" },
        ].map(stat => (
          <div key={stat.label} className="p-4 rounded-xl border border-border bg-card text-center">
            <stat.icon className={`w-5 h-5 mx-auto mb-1.5 ${stat.color}`} />
            <p className="font-heading font-bold text-xl">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
