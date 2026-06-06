"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import {
  Zap, ArrowRight, BarChart3, FileText, Clock,
  AlertCircle, ChevronRight, TrendingUp, Plus, Activity, Instagram, Youtube
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AnalysisRecord {
  id: string;
  profileUrl?: string;
  platform?: string;
  niche?: string;
  createdAt: string;
  audit?: any;
  pipeline?: any;
}

// ── Helper: load real analyses from localStorage ───────────────────────────────
function loadAnalysesFromStorage(): AnalysisRecord[] {
  const records: AnalysisRecord[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("analysis_") && !key.startsWith("analysis_meta_")) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || "");
        if (data?.id && data?.createdAt) records.push(data);
      } catch {}
    }
  }
  return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch { return iso; }
}

function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-8 text-center space-y-4">
        <div className="text-4xl">🎉</div>
        <h2 className="font-heading text-2xl font-bold">Swagat hai Content Engineer mein!</h2>
        <p className="text-muted-foreground text-sm">
          Ab pehle Settings mein jaake apni <strong>AI API key</strong> aur <strong>Apify API key</strong> add karo — phir pehla analysis run karo!
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

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸",
  youtube: "▶️",
  facebook: "📘",
  linkedin: "💼",
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "true";
  const [showWelcome, setShowWelcome] = useState(isWelcome);
  const [hasKeys, setHasKeys] = useState(true);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);

  useEffect(() => {
    // Load API key status
    try {
      const raw = localStorage.getItem("ce_settings_v2") || localStorage.getItem("ugc_keys");
      if (raw) {
        const data = JSON.parse(atob(raw));
        const hasLLM = data.llmKeys
          ? Object.values(data.llmKeys as Record<string,string>).some(v => !!v)
          : !!(data.anthropic);
        const hasScraper = data.scraperKeys
          ? Object.values(data.scraperKeys as Record<string,string>).some(v => !!v)
          : !!(data.apify);
        setHasKeys(hasLLM && hasScraper);
      } else {
        setHasKeys(false);
      }
    } catch { setHasKeys(false); }

    // Load REAL analyses from localStorage
    setAnalyses(loadAnalysesFromStorage());
  }, []);

  // Compute real stats
  const totalScripts = analyses.reduce((sum, a) => {
    return sum + (a.pipeline?.contentCalendar?.reduce((ws: number, w: any) => ws + (w.posts?.length || 0), 0) || 0);
  }, 0);
  const lastActive = analyses[0]?.createdAt ? formatDate(analyses[0].createdAt) : "Never";
  const erValues = analyses
    .map(a => parseFloat(a.audit?.engagementRate || "0"))
    .filter(v => v > 0);
  const avgER = erValues.length > 0
    ? (erValues.reduce((s, v) => s + v, 0) / erValues.length).toFixed(1) + "%"
    : "—";

  const stats = [
    { label: "Total Analyses", value: String(analyses.length), icon: Activity, color: "text-amber-500" },
    { label: "Scripts Generated", value: String(totalScripts || 0), icon: FileText, color: "text-blue-500" },
    { label: "Last Active", value: lastActive, icon: Clock, color: "text-green-500" },
    { label: "Avg Engagement", value: avgER, icon: TrendingUp, color: "text-purple-500" },
  ];

  const recent = analyses.slice(0, 5);

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
            <p className="text-sm font-medium">AI + Scraping API keys set nahi hain</p>
            <p className="text-xs text-muted-foreground">Koi bhi ek AI key (Claude/Gemini/OpenAI) aur ek Scraping key (Apify/RapidAPI) add karo</p>
          </div>
          <Link href="/settings" className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1">
            Add karo <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Stats — REAL data */}
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
            <h2 className="font-heading text-lg font-bold mb-1">
              {analyses.length === 0 ? "Apna pehla analysis run karo" : "Nayi analysis shuru karo"}
            </h2>
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

      {/* Recent analyses — REAL data */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-semibold">Recent Analyses</h2>
          <Link href="/history" className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1">
            Sab dekho <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-border">
              <BarChart3 className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Abhi tak koi analysis nahi hui</p>
              <Link href="/analyze" className="mt-3 text-xs font-bold text-amber-500 hover:underline">Pehla analysis run karo →</Link>
            </div>
          ) : recent.map((analysis) => {
            const er = analysis.audit?.engagementRate;
            const scripts = analysis.pipeline?.contentCalendar?.reduce((s: number, w: any) => s + (w.posts?.length || 0), 0) || 0;
            const platformIcon = PLATFORM_ICONS[analysis.platform || ""] || "📊";
            const topRec = analysis.audit?.topRecommendation;
            return (
              <Link
                key={analysis.id}
                href={`/results/${analysis.id}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-foreground/20 transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-lg">
                  {platformIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm capitalize">
                    {analysis.platform || "Profile"}{analysis.niche ? ` — ${analysis.niche}` : ""}
                  </p>
                  {topRec && <p className="text-xs text-muted-foreground truncate mt-0.5">{topRec}</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(analysis.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {er && er !== "0%" && <span className="text-xs font-bold text-amber-600 dark:text-amber-400">ER: {er}</span>}
                  {scripts > 0 && <span className="text-xs text-muted-foreground">{scripts} scripts</span>}
                  <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-1 rounded-full text-xs font-medium">
                    Done
                  </span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                </div>
              </Link>
            );
          })}
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
