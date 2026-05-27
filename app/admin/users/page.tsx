"use client";

import { useEffect, useState } from "react";
import { Search, Ban, Gift, CreditCard, ChevronDown, CheckCircle2, XCircle, Database, RefreshCw, Loader2 } from "lucide-react";

type Plan = "lifetime" | "monthly" | "yearly" | "free";
type Status = "active" | "banned";

interface User {
  id: string; name: string; email: string; whatsapp: string;
  platform: string; niche: string; plan: Plan; status: Status;
  connectedAccounts: string[]; analysesCount: number; apiKeysSet: boolean;
  subscriptionStatus: string; periodEnd: string | null; createdAt: string;
}

const PLAN_COLORS: Record<string, string> = {
  lifetime: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  monthly: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  yearly: "bg-purple-500/15 text-purple-400 border border-purple-500/20",
  free: "bg-zinc-700/50 text-zinc-400 border border-zinc-600",
};

const PLATFORM_LABELS: Record<string, string> = { instagram: "IG", youtube: "YT", facebook: "FB" };
const PLATFORM_COLORS: Record<string, string> = { instagram: "text-pink-400", youtube: "text-red-400", facebook: "text-blue-400" };

function ActionMenu({ user, onAction }: { user: User; onAction: (action: string, value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ACTIONS = [
    { label: "Grant Free Access", action: "set_plan", value: "free", color: "text-green-400" },
    { label: "Set Lifetime", action: "set_plan", value: "lifetime", color: "text-amber-400" },
    { label: "Set Monthly", action: "set_plan", value: "monthly", color: "text-blue-400" },
    { label: "Set Yearly", action: "set_plan", value: "yearly", color: "text-purple-400" },
    { label: user.status === "banned" ? "✓ Unban User" : "✕ Ban User", action: "set_status", value: user.status === "banned" ? "active" : "banned", color: user.status === "banned" ? "text-green-400" : "text-red-400" },
  ];
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition">
        Actions <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl min-w-44 overflow-hidden">
            {ACTIONS.map(a => (
              <button key={a.label} onClick={() => { onAction(a.action, a.value); setOpen(false); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium w-full text-left hover:bg-zinc-800 transition ${a.color}`}>
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
      setDemo(data.demo || false);
    } catch { setDemo(true); setUsers([]); }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAction = async (userId: string, action: string, value: string) => {
    setSaving(userId);
    // Optimistic update
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      if (action === "set_plan") return { ...u, plan: value as Plan };
      if (action === "set_status") return { ...u, status: value as Status };
      return u;
    }));

    if (!demo) {
      try {
        await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, action, value }),
        });
      } catch { /* retry or show error */ }
    }
    setSaving(null);
  };

  const filtered = users.filter(u => {
    const s = search.toLowerCase();
    const matchSearch = !search || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
    const matchPlan = planFilter === "all" || (planFilter === "banned" ? u.status === "banned" : u.plan === planFilter);
    return matchSearch && matchPlan;
  });

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-100">User Management</h1>
          <p className="text-zinc-500 text-sm">{loading ? "Loading..." : `${users.length} users · ${users.filter(u => u.status === "banned").length} banned`}</p>
        </div>
        <button onClick={fetchUsers} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {demo && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm">
          <Database className="w-4 h-4 flex-shrink-0" />
          <span><strong>Demo Mode</strong> — Actions won't persist. Connect Supabase to manage real users.</span>
          <a href="/admin/setup" className="ml-auto text-xs px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition font-medium">Setup →</a>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/30" />
        </div>
        <div className="flex gap-1.5">
          {["all", "lifetime", "monthly", "yearly", "free", "banned"].map(p => (
            <button key={p} onClick={() => setPlanFilter(p)}
              className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition ${planFilter === p ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading users...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-600 text-sm">
            {demo ? "No users yet — Supabase not connected" : "No users match your search"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  {["User", "Platform/Niche", "Plan", "Connections", "Analyses", "API Keys", "Joined", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className={`border-b border-zinc-800 last:border-0 hover:bg-zinc-900/60 transition ${u.status === "banned" ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-200">{u.name}</p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-3"><p className="text-zinc-300">{u.platform}</p><p className="text-xs text-zinc-600">{u.niche}</p></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize w-fit ${u.status === "banned" ? "bg-red-500/15 text-red-400 border border-red-500/20" : PLAN_COLORS[u.plan]}`}>
                          {u.status === "banned" ? "Banned" : u.plan}
                        </span>
                        {saving === u.id && <span className="text-[10px] text-amber-400">Saving...</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {u.connectedAccounts.length === 0
                          ? <span className="text-xs text-zinc-600">None</span>
                          : u.connectedAccounts.map(acc => (
                            <span key={acc} className={`text-xs font-bold ${PLATFORM_COLORS[acc] || "text-zinc-400"}`}>{PLATFORM_LABELS[acc] || acc}</span>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-zinc-200">{u.analysesCount}</td>
                    <td className="px-4 py-3">
                      {u.apiKeysSet ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-zinc-600" />}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ActionMenu user={u} onAction={(action, value) => handleAction(u.id, action, value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
