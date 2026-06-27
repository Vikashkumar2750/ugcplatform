"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield, ShieldCheck, ShieldX, Clock, AlertTriangle,
  RefreshCw, ChevronDown, Filter, Search, TrendingUp,
  CheckCircle2, XCircle, Loader2, BarChart3, Eye
} from "lucide-react";

interface ComplianceLog {
  id: string;
  account_id: string;
  recipient_id: string;
  direction: string;
  decision: "allowed" | "blocked";
  reason_code: string | null;
  reason_detail: string | null;
  message_preview: string;
  created_at: string;
}

interface QueueStats {
  queued: number;
  ready: number;
  processing: number;
  sent: number;
  failed: number;
  blocked: number;
}

const REASON_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  outside_messaging_window: { label: "24h Window Expired", color: "text-orange-400", icon: Clock },
  opted_out: { label: "User Opted Out", color: "text-red-400", icon: ShieldX },
  account_inactive: { label: "Account Inactive", color: "text-gray-400", icon: AlertTriangle },
  blocked_content: { label: "Blocked Content", color: "text-red-500", icon: XCircle },
  invalid_message_tag: { label: "Invalid Tag", color: "text-yellow-400", icon: AlertTriangle },
  rate_exceeded: { label: "Rate Limited", color: "text-amber-400", icon: Clock },
};

export default function CompliancePage() {
  const [logs, setLogs] = useState<ComplianceLog[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "allowed" | "blocked">("all");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch(`/api/automation/compliance-logs?limit=100${filter !== "all" ? `&decision=${filter}` : ""}`),
        fetch("/api/automation/queue-stats"),
      ]);
      const logsData = await logsRes.json();
      const statsData = await statsRes.json();
      setLogs(logsData.logs || []);
      setStats(statsData);
    } catch { }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live counts
  const totalLogs = logs.length;
  const allowedCount = logs.filter(l => l.decision === "allowed").length;
  const blockedCount = logs.filter(l => l.decision === "blocked").length;
  const blockRate = totalLogs > 0 ? Math.round((blockedCount / totalLogs) * 100) : 0;

  // Reason breakdown
  const reasonCounts: Record<string, number> = {};
  logs.filter(l => l.decision === "blocked").forEach(l => {
    const key = l.reason_code || "unknown";
    reasonCounts[key] = (reasonCounts[key] || 0) + 1;
  });

  const filteredLogs = logs.filter(l => {
    if (search) {
      const q = search.toLowerCase();
      return (
        l.recipient_id?.toLowerCase().includes(q) ||
        l.message_preview?.toLowerCase().includes(q) ||
        l.reason_code?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-500" />
            Compliance Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time view of messaging compliance, rate limits, and content filtering
          </p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="p-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground transition disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Decisions", value: totalLogs, icon: BarChart3, color: "text-blue-400", bg: "bg-blue-400/10" },
          { label: "Allowed", value: allowedCount, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10" },
          { label: "Blocked", value: blockedCount, icon: XCircle, color: "text-red-400", bg: "bg-red-400/10" },
          { label: "Block Rate", value: `${blockRate}%`, icon: Shield, color: blockRate > 20 ? "text-amber-400" : "text-emerald-400", bg: blockRate > 20 ? "bg-amber-400/10" : "bg-emerald-400/10" },
        ].map(stat => (
          <div key={stat.label} className="p-4 rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold font-heading">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Queue Status */}
      {stats && (
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            Send Queue Status
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: "Queued", value: stats.queued, color: "bg-blue-400" },
              { label: "Ready", value: stats.ready, color: "bg-amber-400" },
              { label: "Processing", value: stats.processing, color: "bg-purple-400" },
              { label: "Sent", value: stats.sent, color: "bg-emerald-400" },
              { label: "Failed", value: stats.failed, color: "bg-red-400" },
              { label: "Blocked", value: stats.blocked, color: "bg-gray-400" },
            ].map(q => (
              <div key={q.label} className="text-center p-3 rounded-xl bg-muted/30">
                <div className={`w-2 h-2 rounded-full ${q.color} mx-auto mb-1.5`} />
                <p className="text-lg font-bold">{q.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{q.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Block Reason Breakdown */}
      {Object.keys(reasonCounts).length > 0 && (
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <ShieldX className="w-4 h-4 text-red-400" />
            Block Reasons
          </h3>
          <div className="space-y-2">
            {Object.entries(reasonCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([reason, count]) => {
                const info = REASON_LABELS[reason] || { label: reason, color: "text-gray-400", icon: AlertTriangle };
                const pct = blockedCount > 0 ? Math.round((count / blockedCount) * 100) : 0;
                return (
                  <div key={reason} className="flex items-center gap-3">
                    <info.icon className={`w-4 h-4 ${info.color} flex-shrink-0`} />
                    <span className="text-sm flex-1">{info.label}</span>
                    <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-red-400 to-orange-400 transition-all"
                        style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-12 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Compliance Log */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            Audit Log
          </h3>
          <div className="flex-1" />
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="pl-9 pr-4 py-2 rounded-xl border border-border text-sm bg-background w-48 focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
          </div>
          <div className="flex rounded-xl border border-border overflow-hidden">
            {(["all", "allowed", "blocked"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium transition ${filter === f ? "bg-amber-400/20 text-amber-500" : "text-muted-foreground hover:bg-muted/50"}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
            <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No compliance logs yet</p>
            <p className="text-xs text-muted-foreground mt-1">Logs appear when automated messages are sent or blocked</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredLogs.map(log => {
              const info = log.reason_code ? REASON_LABELS[log.reason_code] : null;
              return (
                <div key={log.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition hover:bg-muted/30 ${
                    log.decision === "blocked" ? "border-red-500/20 bg-red-500/5" : "border-border bg-card"
                  }`}>
                  {log.decision === "allowed" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate max-w-[200px]">
                        {log.message_preview || "—"}
                      </span>
                      {info && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${info.color} bg-current/10 font-medium`}>
                          {info.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      To: {log.recipient_id?.substring(0, 16)}… • {log.reason_detail?.substring(0, 80) || "Passed all checks"}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
