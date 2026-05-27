"use client";

import Link from "next/link";
import { BarChart3, ChevronRight, Calendar, TrendingUp, FileText, Plus, Trash2, ExternalLink } from "lucide-react";

const MOCK_HISTORY = [
  {
    id: "analysis_1",
    platform: "Instagram",
    handle: "@fitnesswithrahul",
    niche: "Fitness",
    date: "26 May 2026",
    time: "9:14 PM",
    phases: ["Profile Audit", "Competitor Analysis", "7-Day Pipeline"],
    er: "3.2%",
    status: "complete",
    scriptsGenerated: 7,
    competitorCount: 3,
  },
  {
    id: "analysis_2",
    platform: "YouTube",
    handle: "Finance Talks India",
    niche: "Finance",
    date: "21 May 2026",
    time: "7:45 PM",
    phases: ["Profile Audit", "Trend Research", "7-Day Pipeline"],
    er: "5.1%",
    status: "complete",
    scriptsGenerated: 7,
    competitorCount: 0,
  },
  {
    id: "analysis_3",
    platform: "Instagram",
    handle: "@travelwithpriya",
    niche: "Travel",
    date: "19 May 2026",
    time: "11:22 AM",
    phases: ["Profile Audit"],
    er: "—",
    status: "failed",
    scriptsGenerated: 0,
    competitorCount: 0,
    errorReason: "Apify scrape failed — profile may be private",
  },
  {
    id: "analysis_4",
    platform: "Instagram",
    handle: "@techbyaryan",
    niche: "Tech",
    date: "14 May 2026",
    time: "8:30 PM",
    phases: ["Profile Audit", "Competitor Analysis", "Trend Research", "7-Day Pipeline"],
    er: "4.8%",
    status: "complete",
    scriptsGenerated: 14,
    competitorCount: 2,
  },
];

const platformColors: Record<string, string> = {
  Instagram: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  YouTube: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Facebook: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function HistoryPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Analysis History</h1>
          <p className="text-muted-foreground text-sm mt-1">{MOCK_HISTORY.length} analyses completed</p>
        </div>
        <Link
          href="/analyze"
          className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Naya Analysis
        </Link>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Analyses", value: "4", icon: BarChart3 },
          { label: "Scripts Generated", value: "28", icon: FileText },
          { label: "Competitors Analyzed", value: "5", icon: TrendingUp },
          { label: "This Month", value: "3", icon: Calendar },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl bg-card border border-border text-center">
            <s.icon className="w-4 h-4 text-amber-500 mx-auto mb-2" />
            <p className="font-heading text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* History list */}
      <div className="space-y-3">
        {MOCK_HISTORY.map(item => (
          <div
            key={item.id}
            className={`rounded-2xl border bg-card transition-all group ${
              item.status === "failed" ? "border-red-400/20 bg-red-400/3" : "border-border hover:border-foreground/20"
            }`}
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <BarChart3 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${platformColors[item.platform] || "bg-muted text-muted-foreground"}`}>
                        {item.platform}
                      </span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{item.niche}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        item.status === "complete"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {item.status === "complete" ? "✓ Complete" : "✗ Failed"}
                      </span>
                    </div>
                    <p className="font-semibold text-sm truncate">{item.handle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.date} · {item.time}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.er !== "—" && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Engagement</p>
                      <p className="font-bold text-amber-600 dark:text-amber-400">{item.er}</p>
                    </div>
                  )}
                  {item.status === "complete" && (
                    <Link
                      href={`/results/${item.id}`}
                      className="p-2 rounded-lg border border-border hover:bg-muted/60 transition opacity-0 group-hover:opacity-100"
                      title="View results"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Phase chips */}
              {item.status === "complete" && (
                <div className="mt-3 flex flex-wrap gap-1.5 pl-[52px]">
                  {item.phases.map(p => (
                    <span key={p} className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">{p}</span>
                  ))}
                  {item.scriptsGenerated > 0 && (
                    <span className="text-xs px-2 py-1 rounded-md bg-amber-400/10 text-amber-600 dark:text-amber-400 font-medium">
                      {item.scriptsGenerated} scripts
                    </span>
                  )}
                  {item.competitorCount > 0 && (
                    <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">
                      {item.competitorCount} competitors
                    </span>
                  )}
                </div>
              )}

              {/* Error reason */}
              {item.status === "failed" && item.errorReason && (
                <p className="mt-2 text-xs text-red-500 ml-13 pl-1 flex items-center gap-1">
                  ⚠ {item.errorReason}
                </p>
              )}
            </div>

            {item.status === "complete" && (
              <div className="border-t border-border px-5 py-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {item.phases.length} phases · {item.scriptsGenerated} scripts · {item.competitorCount} competitors
                </span>
                <Link
                  href={`/results/${item.id}`}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                >
                  Full report dekho <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            )}

            {item.status === "failed" && (
              <div className="border-t border-red-400/15 px-5 py-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Analysis incomplete</span>
                <Link
                  href="/analyze"
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                >
                  Dobara try karo <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
