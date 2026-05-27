"use client";

import Link from "next/link";
import { MessageSquare, MessageCircle, Calendar, Zap, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";

const FEATURES = [
  {
    href: "/automation/dm",
    icon: MessageSquare,
    title: "DM Automation",
    desc: "Keyword triggers, new follower welcome, story reply — auto-send messages with links or attachments",
    status: "active",
    stats: { label: "Rules", value: "0" },
  },
  {
    href: "/automation/comments",
    icon: MessageCircle,
    title: "Comment Automation",
    desc: "Auto-reply to comments, send DMs to commenters, pin/hide comments based on keywords",
    status: "active",
    stats: { label: "Rules", value: "0" },
  },
  {
    href: "/automation/schedule",
    icon: Calendar,
    title: "Post Scheduler",
    desc: "Schedule posts for Instagram, Facebook, and YouTube. Calendar view with AI-suggested best times",
    status: "active",
    stats: { label: "Scheduled", value: "0" },
  },
];

export default function AutomationPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Zap className="w-6 h-6 text-amber-500" />
          Automation Suite
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          DM automation, comment replies, and post scheduling — all in one place
        </p>
      </div>

      {/* Connect accounts warning if no accounts connected */}
      <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">Connect accounts to activate automation</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            DM and comment automation requires a connected Instagram Business or Facebook Page account.
          </p>
          <Link href="/connect" className="text-amber-600 dark:text-amber-400 text-xs font-bold hover:underline mt-1 inline-block">
            Connect accounts →
          </Link>
        </div>
      </div>

      {/* Meta review note */}
      <div className="p-4 rounded-xl border border-border bg-card flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Meta App Review note:</span> DM and comment automation features require Meta App Review approval.
          You can create rules now and they'll activate automatically once approved.
          Post scheduling works immediately.{" "}
          <Link href="/docs/meta-setup" className="text-amber-600 dark:text-amber-400 hover:underline">
            Read setup guide →
          </Link>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {FEATURES.map(f => (
          <Link
            key={f.href}
            href={f.href}
            className="p-5 rounded-2xl border border-border bg-card hover:border-foreground/20 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-400/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <f.icon className="w-5 h-5 text-amber-500" />
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                f.status === "active"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                {f.status === "active" ? "Active" : "Coming soon"}
              </span>
            </div>
            <h3 className="font-heading font-semibold mb-1">{f.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">{f.desc}</p>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-lg font-bold">{f.stats.value}</span>
                <span className="text-xs text-muted-foreground ml-1">{f.stats.label}</span>
              </div>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium group-hover:translate-x-1 transition-transform inline-block">
                Open →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total DMs Sent", value: "0" },
          { label: "Comments Auto-replied", value: "0" },
          { label: "Posts Published", value: "0" },
          { label: "Posts Scheduled", value: "0" },
        ].map(stat => (
          <div key={stat.label} className="p-4 rounded-xl border border-border bg-card text-center">
            <p className="font-heading font-bold text-xl">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
