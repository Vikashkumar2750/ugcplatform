"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import {
  Zap, ArrowRight, BarChart3, FileText, Clock,
  AlertCircle, ChevronRight, TrendingUp, Plus, Activity
} from "lucide-react";

const RECENT_ANALYSES = [
  { id: "1", platform: "Instagram", niche: "Fitness", date: "2 days ago", status: "complete", er: "3.2%" },
  { id: "2", platform: "YouTube", niche: "Finance", date: "5 days ago", status: "complete", er: "5.1%" },
  { id: "3", platform: "Instagram", niche: "Travel", date: "1 week ago", status: "failed", er: "—" },
];

function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-8 text-center space-y-4">
        <div className="text-4xl">🎉</div>
        <h2 className="font-heading text-2xl font-bold">Swagat hai Content Engineer mein!</h2>
        <p className="text-muted-foreground text-sm">
          Payment ho gayi. Ab pehle Settings mein jaake apni <strong>Anthropic API key</strong> aur <strong>Apify API key</strong> add karo — phir pehla analysis run karo!
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link href="/settings" className="btn-amber w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
            <Zap className="w-4 h-4" /> API Keys Add Karo
          </Link>
          <button onClick={onClose} className="py-2 text-sm text-muted-foreground hover:text-foreground transition">
            Baad mein karta hoon
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "true";
  const [showWelcome, setShowWelcome] = useState(isWelcome);
  const [hasKeys, setHasKeys] = useState(true); // Optimistic — don't flash banner on load

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ugc_keys");
      if (saved) {
        const keys = JSON.parse(atob(saved));
        setHasKeys(!!(keys.anthropic && keys.apify));
      } else {
        setHasKeys(false);
      }
    } catch {
      setHasKeys(false);
    }
  }, []);

  const stats = [
    { label: "Total Analyses", value: "3", icon: Activity, color: "text-amber-500" },
    { label: "Scripts Generated", value: "21", icon: FileText, color: "text-blue-500" },
    { label: "Last Active", value: "Today", icon: Clock, color: "text-green-500" },
    { label: "Avg Engagement", value: "4.1%", icon: TrendingUp, color: "text-purple-500" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Namaste! 👋</h1>
          <p className="text-muted-foreground mt-1">Aaj kya analyze karna hai?</p>
        </div>
        <Link
          href="/analyze"
          id="dashboard-start-analysis-btn"
          className="btn-amber px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Analysis
        </Link>
      </div>

      {/* API Keys warning */}
      {!hasKeys && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-400/30 bg-amber-400/8">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">API keys set nahi ki hain</p>
            <p className="text-xs text-muted-foreground">Analytics run karne ke liye Anthropic + Apify keys zaroori hain</p>
          </div>
          <Link href="/settings" className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1">
            Add karo <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="p-4 rounded-xl bg-card border border-border">
            <stat.icon className={`w-5 h-5 ${stat.color} mb-3`} />
            <p className="font-heading text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick start CTA */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-400/10 to-orange-400/5 p-6">
        <div className="absolute right-0 top-0 w-40 h-40 amber-gradient opacity-10 rounded-full translate-x-10 -translate-y-10" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="font-heading text-lg font-bold mb-1">Apna pehla analysis run karo</h2>
            <p className="text-sm text-muted-foreground">Profile URL daalo aur 90 seconds mein poori strategy pao</p>
          </div>
          <Link
            href="/analyze"
            className="btn-amber px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 flex-shrink-0"
          >
            Shuru karo <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Recent analyses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-semibold">Recent Analyses</h2>
          <Link href="/history" className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1">
            Sab dekho <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {RECENT_ANALYSES.map((analysis) => (
            <div
              key={analysis.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-foreground/20 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{analysis.platform} — {analysis.niche}</p>
                <p className="text-xs text-muted-foreground">{analysis.date}</p>
              </div>
              <div className="flex items-center gap-3">
                {analysis.er !== "—" && (
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">ER: {analysis.er}</span>
                )}
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  analysis.status === "complete"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}>
                  {analysis.status === "complete" ? "Complete" : "Failed"}
                </span>
                <Link
                  href={`/results/${analysis.id}`}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition opacity-0 group-hover:opacity-100"
                >
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
