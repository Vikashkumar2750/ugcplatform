"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Zap, AlertCircle, Shield, BarChart3, Inbox,
  Bot, Send, CheckCircle2, Clock, MessageCircle,
  Plus, ToggleRight, ToggleLeft, Radio, Calendar,
  ArrowUpRight, Loader2, TrendingUp, Activity,
  RefreshCw, Eye, MessageSquare
} from "lucide-react";

interface OverviewStats {
  totalRules: number;
  activeRules: number;
  totalTriggers: number;
  totalSent: number;
  totalBlocked: number;
  pendingReviews: number;
}

interface ActiveRule {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  trigger_count: number;
  last_triggered?: string;
}

export default function AutomationPage() {
  const [hasConnected, setHasConnected] = useState<boolean | null>(null);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [rules, setRules] = useState<ActiveRule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/connect/accounts").then(r => r.json()).catch(() => ({ accounts: [] })),
      fetch("/api/automation/analytics?period=7d").then(r => r.json()).catch(() => ({})),
      fetch("/api/automation/rules").then(r => r.json()).catch(() => ({ rules: [] })),
    ]).then(([accountsData, analyticsData, rulesData]) => {
      setHasConnected((accountsData.accounts || []).length > 0);
      setStats({
        totalRules: analyticsData.totalRules || 0,
        activeRules: analyticsData.activeRules || 0,
        totalTriggers: analyticsData.totalTriggers || 0,
        totalSent: analyticsData.totalSent || 0,
        totalBlocked: analyticsData.totalBlocked || 0,
        pendingReviews: 0,
      });
      setRules((rulesData.rules || []).slice(0, 10));
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const toggleRule = async (rule: ActiveRule) => {
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    await fetch("/api/automation/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
    });
  };

  const getTypeIcon = (type: string) => {
    if (type.includes("comment")) return MessageCircle;
    if (type.includes("dm") || type.includes("follower") || type.includes("story")) return MessageSquare;
    if (type.includes("ai")) return Bot;
    if (type.includes("drip") || type.includes("sequence")) return Clock;
    if (type.includes("broadcast")) return Radio;
    return Zap;
  };

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      dm_keyword: "DM Keyword",
      dm_new_follower: "New Follower",
      story_reply: "Story Reply",
      story_mention: "Story Mention",
      comment_to_dm: "Comment → DM",
      comment_reply: "Comment Reply",
      comment_automation: "Comment Rule",
      comment_auto_reply: "Auto Reply",
      hide_comment: "Hide Spam",
      ai_auto_reply: "AI Reply",
      drip_sequence: "Drip Sequence",
      conditional_flow: "Conditional",
      lead_capture: "Lead Capture",
      broadcast: "Broadcast",
    };
    return map[type] || type;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            Automation Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time overview of all your automations
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-xl border border-border hover:bg-muted/60 transition">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Connect warning */}
      {hasConnected === false && (
        <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Connect accounts to activate automation</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              DM and comment automation requires a connected Instagram Business or Facebook Page.
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
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Active Rules", value: stats?.activeRules || 0, icon: CheckCircle2, color: "text-emerald-400", bg: "from-emerald-500/5 to-emerald-500/0" },
              { label: "Total Triggers", value: stats?.totalTriggers || 0, icon: Zap, color: "text-amber-400", bg: "from-amber-500/5 to-amber-500/0" },
              { label: "Messages Sent", value: stats?.totalSent || 0, icon: Send, color: "text-cyan-400", bg: "from-cyan-500/5 to-cyan-500/0" },
              { label: "Blocked", value: stats?.totalBlocked || 0, icon: Shield, color: "text-red-400", bg: "from-red-500/5 to-red-500/0" },
              { label: "Pending Review", value: stats?.pendingReviews || 0, icon: Inbox, color: "text-violet-400", bg: "from-violet-500/5 to-violet-500/0" },
            ].map(stat => (
              <div key={stat.label} className={`p-4 rounded-xl border border-border bg-gradient-to-br ${stat.bg} text-center group hover:border-foreground/10 transition`}>
                <stat.icon className={`w-5 h-5 mx-auto mb-1.5 ${stat.color} group-hover:scale-110 transition-transform`} />
                <p className="font-heading font-bold text-xl">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Quick Actions + Active Rules */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" /> Quick Actions
              </h3>
              {[
                { href: "/automation/comments", icon: MessageCircle, label: "New Comment Rule", desc: "Reply + DM + Hide", color: "from-blue-500/10 to-violet-500/10" },
                { href: "/automation/flows", icon: Radio, label: "New Flow Automation", desc: "Visual workflow builder", color: "from-amber-500/10 to-orange-500/10" },
                { href: "/automation/schedule", icon: Calendar, label: "Schedule Post", desc: "Instagram & Facebook", color: "from-emerald-500/10 to-teal-500/10" },
                { href: "/automation/inbox", icon: Inbox, label: "AI Review Inbox", desc: "Review pending replies", color: "from-violet-500/10 to-purple-500/10" },
                { href: "/automation/analytics", icon: BarChart3, label: "View Analytics", desc: "Performance metrics", color: "from-cyan-500/10 to-blue-500/10" },
                { href: "/automation/compliance", icon: Shield, label: "Compliance Logs", desc: "Audit trail & blocks", color: "from-emerald-500/10 to-green-500/10" },
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
                  <Activity className="w-4 h-4 text-amber-500" /> Active Rules
                </h3>
                <Link href="/automation/flows" className="text-xs text-amber-500 hover:underline">
                  View all →
                </Link>
              </div>

              {rules.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl">
                  <Zap className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No automation rules created yet</p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Link href="/automation/flows" className="text-xs text-amber-500 hover:underline">
                      Create from templates →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.map(rule => {
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

          {/* Compliance Pipeline Status */}
          <div className="p-5 rounded-2xl border border-border bg-card">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-emerald-400" />
              Compliance Pipeline
            </h3>
            <div className="flex items-center gap-3 text-xs flex-wrap">
              {[
                { label: "24h Window", status: "active", color: "bg-emerald-400" },
                { label: "Rate Limiter", status: "120/hr", color: "bg-emerald-400" },
                { label: "Content Filter", status: "active", color: "bg-emerald-400" },
                { label: "Send Queue", status: "processing", color: "bg-cyan-400" },
                { label: "AI Scoring", status: "active", color: "bg-violet-400" },
              ].map((item, i) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40">
                    <div className={`w-1.5 h-1.5 rounded-full ${item.color} animate-pulse`} />
                    <span className="font-medium">{item.label}</span>
                    <span className="text-muted-foreground">{item.status}</span>
                  </div>
                  {i < 4 && <ArrowUpRight className="w-3 h-3 text-muted-foreground/30 rotate-45" />}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
