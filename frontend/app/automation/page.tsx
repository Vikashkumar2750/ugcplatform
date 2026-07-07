"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Zap, AlertCircle, Shield, BarChart3, Inbox,
  Bot, Send, CheckCircle2, Clock, MessageCircle,
  Plus, ToggleRight, ToggleLeft, Radio, Calendar,
  ArrowUpRight, Loader2, TrendingUp, Activity,
  RefreshCw, MessageSquare, Target, ShieldCheck,
  ArrowDownRight, XCircle
} from "lucide-react";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

interface OverviewStats {
  totalRules: number;
  activeRules: number;
  totalTriggers: number;
  totalSent: number;
  totalBlocked: number;
  avgConfidence: number;
  topRules: Array<{ name: string; triggers: number; type: string }>;
  hourlyActivity: number[];
}

interface ActiveRule {
  id: string;
  name: string;
  type: string;
  platform: string;
  is_active: boolean;
  trigger_count: number;
  last_triggered?: string;
}

export default function AutomationPage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") || "instagram";
  const [period, setPeriod] = useState<"today" | "7d" | "30d">("7d");

  const { data: accountsData } = useSWR("/api/connect/accounts", fetcher);
  const { data: analyticsData } = useSWR(`/api/automation/analytics?period=${period}&platform=${platform}`, fetcher);
  const { data: rulesData, mutate: mutateRules } = useSWR(`/api/automation/rules?platform=${platform}`, fetcher);

  const loading = !accountsData || !analyticsData || !rulesData;
  const accounts = accountsData?.accounts || [];
  const hasConnected = accounts.some((a: any) => a.platform === platform);

  const stats: OverviewStats = analyticsData ? {
    totalRules: analyticsData.totalRules || 0,
    activeRules: analyticsData.activeRules || 0,
    totalTriggers: analyticsData.totalTriggers || 0,
    totalSent: analyticsData.totalSent || 0,
    totalBlocked: analyticsData.totalBlocked || 0,
    avgConfidence: analyticsData.avgConfidence || 0,
    topRules: analyticsData.topRules || [],
    hourlyActivity: analyticsData.hourlyActivity || Array(24).fill(0),
  } : {
    totalRules: 0, activeRules: 0, totalTriggers: 0, totalSent: 0, totalBlocked: 0, avgConfidence: 0, topRules: [], hourlyActivity: Array(24).fill(0)
  };

  const allRules = rulesData?.rules || [];
  const rules = allRules.filter((r: ActiveRule) => !r.platform || r.platform === platform).slice(0, 10);

  const toggleRule = async (rule: ActiveRule) => {
    // Optimistic update
    mutateRules({
      ...rulesData,
      rules: allRules.map((r: ActiveRule) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r)
    }, false);
    
    await fetch("/api/automation/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
    });
    mutateRules(); // Revalidate
  };

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      dm_keyword: "DM Keyword", dm_new_follower: "New Follower", story_reply: "Story Reply",
      comment_to_dm: "Comment → DM", comment_reply: "Comment Reply", comment_automation: "Comment Rule",
      hide_comment: "Hide Spam", ai_auto_reply: "AI Reply", broadcast: "Broadcast",
    };
    return map[type] || type;
  };

  const getTypeIcon = (type: string) => {
    if (type.includes("comment")) return MessageCircle;
    if (type.includes("dm") || type.includes("follower") || type.includes("story")) return MessageSquare;
    if (type.includes("ai")) return Bot;
    return Zap;
  };

  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
  const s = stats || { totalRules: 0, activeRules: 0, totalTriggers: 0, totalSent: 0, totalBlocked: 0, avgConfidence: 0, topRules: [], hourlyActivity: Array(24).fill(0) };
  const deliveryRate = s.totalTriggers > 0 ? Math.round((s.totalSent / s.totalTriggers) * 100) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            {platformLabel} Automation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Overview & analytics for your {platformLabel} automations
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <button onClick={() => mutateRules()} className="p-2 rounded-xl border border-border hover:bg-muted/60 transition">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Connect warning */}
      {hasConnected === false && (
        <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Connect {platformLabel} to activate automation</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              DM and comment automation requires a connected {platformLabel} account.
            </p>
            <Link href="/connect" className="text-amber-600 dark:text-amber-400 text-xs font-bold hover:underline mt-1 inline-block">
              Connect accounts →
            </Link>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500/50" />
        </div>
      ) : (
        <>
          {/* Key Metrics — merged from Analytics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Triggers", value: s.totalTriggers, icon: Zap, color: "text-amber-400", bg: "bg-amber-400/10" },
              { label: "Messages Sent", value: s.totalSent, icon: Send, color: "text-emerald-400", bg: "bg-emerald-400/10" },
              { label: "Delivery Rate", value: `${deliveryRate}%`, icon: Target, color: "text-cyan-400", bg: "bg-cyan-400/10" },
              { label: "AI Confidence", value: `${s.avgConfidence}%`, icon: Bot, color: "text-violet-400", bg: "bg-violet-400/10" },
            ].map(metric => (
              <div key={metric.label} className="p-5 rounded-2xl border border-border bg-card group hover:border-foreground/10 transition">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${metric.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <metric.icon className={`w-5 h-5 ${metric.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold font-heading">{metric.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{metric.label}</p>
              </div>
            ))}
          </div>

          {/* Hourly Activity + Top Rules */}
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

          {/* Quick Actions + Active Rules */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" /> Quick Actions
              </h3>
              {[
                { href: `/automation/dm?platform=${platform}`, icon: MessageSquare, label: "New DM Rule", desc: `${platformLabel} DM keywords`, color: "from-pink-500/10 to-rose-500/10" },
                { href: `/automation/comments?platform=${platform}`, icon: MessageCircle, label: "New Comment Rule", desc: "Reply + DM + Hide", color: "from-blue-500/10 to-violet-500/10" },
                { href: `/automation/flows?platform=${platform}`, icon: Radio, label: "New Flow Automation", desc: "Visual workflow builder", color: "from-amber-500/10 to-orange-500/10" },
                { href: `/automation/schedule?platform=${platform}`, icon: Calendar, label: "Schedule Post", desc: `${platformLabel} content`, color: "from-emerald-500/10 to-teal-500/10" },
                { href: `/automation/inbox?platform=${platform}`, icon: Inbox, label: "AI Review Inbox", desc: "Review pending replies", color: "from-violet-500/10 to-purple-500/10" },
                { href: `/automation/compliance?platform=${platform}`, icon: Shield, label: "Compliance Logs", desc: "Audit trail & blocks", color: "from-emerald-500/10 to-green-500/10" },
              ].map(action => (
                <Link key={action.href} href={action.href}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-foreground/15 transition group">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                    <action.icon className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-[10px] text-muted-foreground">{action.desc}</p>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-amber-500 transition" />
                </Link>
              ))}
            </div>

            {/* Active Rules */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500" /> {platformLabel} Rules
                </h3>
              </div>

              {rules.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl">
                  <Zap className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No {platformLabel} automation rules yet</p>
                  <div className="flex items-center justify-center gap-3 mt-3">
                    <Link href={`/automation/dm?platform=${platform}`} className="text-xs text-amber-500 hover:underline">
                      Create DM rule →
                    </Link>
                    <Link href={`/automation/comments?platform=${platform}`} className="text-xs text-amber-500 hover:underline">
                      Create Comment rule →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule: ActiveRule) => {
                    const RuleIcon = getTypeIcon(rule.type);
                    return (
                      <div key={rule.id} className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                        rule.is_active ? "border-border bg-card" : "border-border bg-muted/20 opacity-60"
                      }`}>
                        <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                          <RuleIcon className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{rule.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span className="px-1.5 py-0.5 rounded bg-muted">{getTypeLabel(rule.type)}</span>
                            <span className="flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" /> {rule.trigger_count || 0}</span>
                            {rule.last_triggered && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(rule.last_triggered).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => toggleRule(rule)} className="flex-shrink-0">
                          {rule.is_active
                            ? <ToggleRight className="w-6 h-6 text-amber-500" />
                            : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Rules Summary Footer */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Rules", value: s.totalRules, icon: MessageSquare, color: "text-blue-400" },
              { label: "Active Rules", value: s.activeRules, icon: CheckCircle2, color: "text-emerald-400" },
              { label: "Messages Blocked", value: s.totalBlocked, icon: XCircle, color: "text-red-400" },
              { label: "Compliance Rate", value: s.totalTriggers > 0 ? `${Math.round(((s.totalTriggers - s.totalBlocked) / s.totalTriggers) * 100)}%` : "100%", icon: ShieldCheck, color: "text-emerald-400" },
            ].map(stat => (
              <div key={stat.label} className="p-4 rounded-xl border border-border bg-card text-center">
                <stat.icon className={`w-5 h-5 mx-auto mb-1.5 ${stat.color}`} />
                <p className="font-heading font-bold text-xl">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
