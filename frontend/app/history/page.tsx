"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart3, ChevronRight, Calendar, TrendingUp, FileText, Plus, Trash2, ExternalLink, Loader2, RefreshCw } from "lucide-react";

interface AnalysisRecord {
  id: string;
  profileUrl: string;
  platform: string;
  niche: string;
  language: string;
  createdAt: string;
  audit?: any;
  competitors?: any;
  trends?: any;
  pipeline?: any;
}

const platformColors: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  youtube: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  facebook: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function getPhases(record: AnalysisRecord): string[] {
  const phases = [];
  if (record.audit) phases.push("Profile Audit");
  if (record.competitors) phases.push("Competitor Analysis");
  if (record.trends) phases.push("Trend Report");
  if (record.pipeline) phases.push("Content Pipeline");
  return phases;
}

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = () => {
    setLoading(true);
    try {
      const records: AnalysisRecord[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("analysis_") && !key.startsWith("analysis_meta_")) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || "");
            if (data?.id && data?.createdAt) {
              records.push(data);
            }
          } catch {}
        }
      }
      // Sort newest first
      records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAnalyses(records);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadHistory(); }, []);

  const handleDelete = (id: string) => {
    localStorage.removeItem(`analysis_${id}`);
    localStorage.removeItem(`analysis_meta_${id}`);
    setAnalyses(prev => prev.filter(a => a.id !== id));
  };

  const totalScripts = analyses.reduce((sum, a) => {
    return sum + (a.pipeline?.contentCalendar?.reduce((ws: number, w: any) => ws + (w.posts?.length || 0), 0) || 0);
  }, 0);

  const thisMonth = analyses.filter(a => {
    const d = new Date(a.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Analysis History</h1>
          <p className="text-muted-foreground text-sm mt-1">{analyses.length} analyses completed</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadHistory} className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/analyze" className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Naya Analysis
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Analyses", value: String(analyses.length), icon: BarChart3 },
          { label: "Posts Generated", value: String(totalScripts), icon: FileText },
          { label: "With Full Pipeline", value: String(analyses.filter(a => !!a.pipeline).length), icon: TrendingUp },
          { label: "This Month", value: String(thisMonth), icon: Calendar },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl bg-card border border-border text-center">
            <s.icon className="w-4 h-4 text-amber-500 mx-auto mb-2" />
            <p className="font-heading text-xl font-bold">{loading ? "—" : s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* History list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading history...
        </div>
      ) : analyses.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Koi analysis nahi mili</p>
          <p className="text-sm text-muted-foreground mt-1">Pehla analysis run karo to yahan dikhega</p>
          <Link href="/analyze" className="mt-4 inline-block btn-amber px-6 py-2.5 rounded-xl text-sm font-bold">
            Analysis Shuru Karo
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map(item => {
            const phases = getPhases(item);
            const er = item.audit?.engagementRate;
            const platform = item.platform?.toLowerCase() || "instagram";

            return (
              <div key={item.id} className="rounded-2xl border border-border bg-card hover:border-foreground/20 transition-all group">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <BarChart3 className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${platformColors[platform] || "bg-muted text-muted-foreground"}`}>
                            {item.platform || "Instagram"}
                          </span>
                          {item.niche && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{item.niche}</span>
                          )}
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            ✓ {phases.length} phases
                          </span>
                        </div>
                        <p className="font-semibold text-sm truncate">{item.profileUrl || item.audit?.username || "Unknown Profile"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(item.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {er && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">ER</p>
                          <p className="font-bold text-amber-600 dark:text-amber-400">{er}</p>
                        </div>
                      )}
                      <Link href={`/results/${item.id}`}
                        className="p-2 rounded-lg border border-border hover:bg-muted/60 transition opacity-0 group-hover:opacity-100"
                        title="View results">
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <button onClick={() => handleDelete(item.id)}
                        className="p-2 rounded-lg border border-border hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                        title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {phases.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 pl-[52px]">
                      {phases.map(p => (
                        <span key={p} className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">{p}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-border px-5 py-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {phases.length} phases · {item.audit?.followerCount || "—"} followers · {item.audit?.engagementRate || "—"} ER
                  </span>
                  <Link href={`/results/${item.id}`}
                    className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1">
                    Full report <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
