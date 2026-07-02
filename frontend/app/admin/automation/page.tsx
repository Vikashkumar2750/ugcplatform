"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bot, Search, RefreshCw, Loader2, CheckCircle2, XCircle,
  MessageSquare, AtSign, Zap, ToggleLeft, ToggleRight, Filter
} from "lucide-react";

interface AutomationRule {
  id: string;
  user_id: string;
  account_id: string | null;
  platform: string;
  name: string;
  type: string;
  is_active: boolean;
  trigger_count: number;
  trigger_config: any;
  action_config: any;
  created_at: string;
  // joined
  user_email?: string;
  user_name?: string;
  account_username?: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  comment_reply: { label: "Comment Reply", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: MessageSquare },
  comment_to_dm: { label: "Comment → DM", color: "text-violet-400 bg-violet-500/10 border-violet-500/20", icon: AtSign },
  comment_automation: { label: "Comment Auto", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20", icon: MessageSquare },
  dm_keyword: { label: "DM Keyword", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: Zap },
  dm_new_follower: { label: "New Follower DM", color: "text-pink-400 bg-pink-500/10 border-pink-500/20", icon: Zap },
  story_reply: { label: "Story Reply", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Zap },
  hide_comment: { label: "Hide Comment", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: XCircle },
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "text-pink-400", facebook: "text-blue-400", youtube: "text-red-400", linkedin: "text-sky-400",
};

export default function AdminAutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/automation");
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const toggleRule = async (rule: AutomationRule) => {
    setToggling(rule.id);
    try {
      await fetch("/api/admin/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId: rule.id, is_active: !rule.is_active }),
      });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    } catch {}
    setToggling(null);
  };

  // Filter & search
  const filtered = rules.filter(r => {
    if (filterType !== "all" && r.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        (r.user_email || "").toLowerCase().includes(q) ||
        (r.user_name || "").toLowerCase().includes(q) ||
        (r.account_username || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeCount = rules.filter(r => r.is_active).length;
  const totalTriggers = rules.reduce((s, r) => s + (r.trigger_count || 0), 0);
  const types = [...new Set(rules.map(r => r.type))];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Bot className="w-6 h-6 text-amber-400" /> Automation Rules
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Manage all user automation rules across the platform</p>
        </div>
        <button onClick={fetchRules} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Rules", value: rules.length, color: "text-blue-400" },
          { label: "Active", value: activeCount, color: "text-green-400" },
          { label: "Inactive", value: rules.length - activeCount, color: "text-zinc-400" },
          { label: "Total Triggers", value: totalTriggers, color: "text-amber-400" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950">
            <p className={`font-heading text-xl font-bold ${s.color}`}>{loading ? "—" : s.value}</p>
            <p className="text-[10px] text-zinc-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by rule name, user email, or account..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 focus:outline-none focus:border-amber-500/40 transition"
          />
        </div>
        <select
          value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-300 focus:outline-none"
        >
          <option value="all">All Types</option>
          {types.map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t]?.label || t}</option>
          ))}
        </select>
      </div>

      {/* Rules table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading automation rules...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-600 text-sm">
          {search || filterType !== "all" ? "No rules match your filter" : "No automation rules created yet"}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Rule Name</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Platform</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Triggers</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map(rule => {
                  const typeInfo = TYPE_LABELS[rule.type] || { label: rule.type, color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20", icon: Zap };
                  const TypeIcon = typeInfo.icon;
                  return (
                    <tr key={rule.id} className="hover:bg-zinc-900/50 transition">
                      <td className="px-4 py-3">
                        {rule.is_active
                          ? <span className="flex items-center gap-1 text-green-400 text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
                          : <span className="flex items-center gap-1 text-zinc-500 text-xs font-medium"><XCircle className="w-3.5 h-3.5" /> Off</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-200 truncate max-w-[200px]">{rule.name}</p>
                        {rule.account_username && (
                          <p className="text-[10px] text-zinc-500">@{rule.account_username}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border font-medium ${typeInfo.color}`}>
                          <TypeIcon className="w-3 h-3" /> {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-zinc-300 truncate max-w-[180px]">{rule.user_name || rule.user_email || rule.user_id.substring(0, 8)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold capitalize ${PLATFORM_COLORS[rule.platform] || "text-zinc-400"}`}>
                          {rule.platform}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-amber-400">{rule.trigger_count || 0}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRule(rule)}
                          disabled={toggling === rule.id}
                          className="flex items-center gap-1 text-xs font-medium transition disabled:opacity-50"
                        >
                          {toggling === rule.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                          ) : rule.is_active ? (
                            <ToggleRight className="w-5 h-5 text-green-400 hover:text-red-400 transition" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-zinc-500 hover:text-green-400 transition" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
