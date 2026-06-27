"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageSquare, MessageCircle, Calendar, Zap, AlertCircle,
  Shield, BarChart3, Inbox, Radio, Bot, Send, Users,
  TrendingUp, ArrowUpRight, Loader2, CheckCircle2, Clock, Sparkles
} from "lucide-react";

interface OverviewStats {
  totalRules: number;
  activeRules: number;
  totalTriggers: number;
  totalSent: number;
  totalBlocked: number;
  pendingReviews: number;
}

const FEATURES = [
  {
    href: "/automation/flows",
    icon: Radio,
    title: "Automation Flows",
    desc: "Multi-step flows with conditions, delays, lead capture, and AI-powered replies",
    badge: "✨ NEW",
    badgeColor: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
    gradient: "from-amber-400/10 to-orange-400/10",
  },
  {
    href: "/automation/dm",
    icon: MessageSquare,
    title: "DM Automation",
    desc: "Keyword triggers, new follower welcome, story replies — auto-send with links",
    gradient: "from-blue-400/10 to-cyan-400/10",
  },
  {
    href: "/automation/comments",
    icon: MessageCircle,
    title: "Comment Automation",
    desc: "Auto-reply to comments, DM commenters, hide/pin based on keywords",
    gradient: "from-purple-400/10 to-violet-400/10",
  },
  {
    href: "/automation/schedule",
    icon: Calendar,
    title: "Post Scheduler",
    desc: "Schedule posts across Instagram, Facebook & YouTube. AI-suggested best times",
    gradient: "from-emerald-400/10 to-teal-400/10",
  },
  {
    href: "/automation/inbox",
    icon: Inbox,
    title: "AI Review Inbox",
    desc: "Review low-confidence AI replies before they're sent. Edit, approve, or discard",
    badge: "AI",
    badgeColor: "bg-violet-500/20 text-violet-400 border border-violet-500/30",
    gradient: "from-violet-400/10 to-purple-400/10",
  },
  {
    href: "/automation/analytics",
    icon: BarChart3,
    title: "Analytics",
    desc: "Performance metrics, delivery rates, hourly activity, and top-performing rules",
    gradient: "from-cyan-400/10 to-blue-400/10",
  },
  {
    href: "/automation/compliance",
    icon: Shield,
    title: "Compliance",
    desc: "Real-time compliance monitoring, block reasons, audit trail, and rate limit status",
    badge: "🛡️",
    gradient: "from-emerald-400/10 to-green-400/10",
  },
];

export default function AutomationPage() {
  const [hasConnected, setHasConnected] = useState<boolean | null>(null);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/connect/accounts").then(r => r.json()).catch(() => ({ accounts: [] })),
      fetch("/api/automation/analytics?period=7d").then(r => r.json()).catch(() => ({})),
    ]).then(([accountsData, analyticsData]) => {
      setHasConnected((accountsData.accounts || []).length > 0);
      setStats({
        totalRules: analyticsData.totalRules || 0,
        activeRules: analyticsData.activeRules || 0,
        totalTriggers: analyticsData.totalTriggers || 0,
        totalSent: analyticsData.totalSent || 0,
        totalBlocked: analyticsData.totalBlocked || 0,
        pendingReviews: 0,
      });
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-amber-500/5 via-card to-orange-500/5 p-6">
        <div className="relative z-10">
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            Automation Suite
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            Build Instagram automations that work 24/7 — DM flows, comment replies, AI-powered smart replies, lead capture, and compliance-first delivery.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-amber-400/10 to-transparent rounded-full blur-2xl" />
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

      {/* Live Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Active Rules", value: stats.activeRules, icon: CheckCircle2, color: "text-emerald-400" },
            { label: "Total Triggers", value: stats.totalTriggers, icon: Zap, color: "text-amber-400" },
            { label: "Messages Sent", value: stats.totalSent, icon: Send, color: "text-cyan-400" },
            { label: "Blocked", value: stats.totalBlocked, icon: Shield, color: "text-red-400" },
            { label: "Pending Review", value: stats.pendingReviews, icon: Inbox, color: "text-violet-400" },
          ].map(stat => (
            <div key={stat.label} className="p-4 rounded-xl border border-border bg-card text-center group hover:border-foreground/10 transition">
              <stat.icon className={`w-5 h-5 mx-auto mb-1.5 ${stat.color} group-hover:scale-110 transition-transform`} />
              <p className="font-heading font-bold text-xl">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map(f => (
          <Link
            key={f.href}
            href={f.href}
            className="p-5 rounded-2xl border border-border bg-card hover:border-foreground/15 transition-all group relative overflow-hidden"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-amber-400/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <f.icon className="w-5 h-5 text-amber-500" />
                </div>
                {f.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${f.badgeColor || "bg-amber-400/20 text-amber-400"}`}>
                    {f.badge}
                  </span>
                )}
              </div>
              <h3 className="font-heading font-semibold mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{f.desc}</p>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                Open <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Compliance Pipeline Status */}
      <div className="p-5 rounded-2xl border border-border bg-card">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-emerald-400" />
          Compliance Pipeline Status
        </h3>
        <div className="flex items-center gap-3 text-xs">
          {[
            { label: "24h Window", status: "active", color: "bg-emerald-400" },
            { label: "Rate Limiter", status: "120/hr", color: "bg-emerald-400" },
            { label: "Content Filter", status: "active", color: "bg-emerald-400" },
            { label: "Send Queue", status: "processing", color: "bg-cyan-400" },
            { label: "AI Scoring", status: "active", color: "bg-violet-400" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40">
              <div className={`w-1.5 h-1.5 rounded-full ${item.color} animate-pulse`} />
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground">{item.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
