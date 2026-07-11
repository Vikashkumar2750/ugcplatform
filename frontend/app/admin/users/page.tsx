"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search, CheckCircle2, XCircle, Database, RefreshCw,
  Loader2, UserPlus, X, Eye, EyeOff, ChevronDown,
  AlertCircle, Clock, Wifi, WifiOff
} from "lucide-react";

type Plan = "lifetime" | "monthly" | "yearly" | "free";
type Status = "active" | "banned";

interface User {
  id: string; name: string; email: string; whatsapp: string;
  platform: string; niche: string; plan: Plan; status: Status;
  connectedAccounts: string[]; analysesCount: number; apiKeysSet: boolean;
  subscriptionStatus: string; periodEnd: string | null; createdAt: string;
  subscriptionTier: string; maxAccountsPerPlatform: number; accountsCount: number;
}

const PLAN_COLORS: Record<string, string> = {
  lifetime: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  monthly:  "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  yearly:   "bg-purple-500/15 text-purple-400 border border-purple-500/20",
  free:     "bg-zinc-700/50 text-zinc-400 border border-zinc-600",
};
const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border border-green-500/20",
  banned: "bg-red-500/15 text-red-400 border border-red-500/20",
};

// ─── Create User Modal ─────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    fullName: "", email: "", password: "", whatsapp: "",
    platform: "instagram", niche: "", plan: "free" as Plan,
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const update = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.email || !form.password) { setError("Email and password are required"); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      setSuccess(`✅ User created: ${data.user.email} (${data.user.plan} plan)`);
      setTimeout(() => { onCreated(); onClose(); }, 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-100">Create New User</h2>
              <p className="text-xs text-zinc-500">Auto email-confirmed, can login immediately</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && <div className="px-3 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">❌ {error}</div>}
          {success && <div className="px-3 py-2.5 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-sm">{success}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1.5">Full Name</label>
              <input value={form.fullName} onChange={e => update("fullName", e.target.value)} placeholder="Rahul Sharma"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1.5">WhatsApp</label>
              <input value={form.whatsapp} onChange={e => update("whatsapp", e.target.value)} placeholder="+91 98765 43210"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1.5">Email <span className="text-red-400">*</span></label>
            <input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="user@example.com"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30" />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1.5">Password <span className="text-red-400">*</span></label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={form.password} onChange={e => update("password", e.target.value)} placeholder="Min 6 characters"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 pr-10 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1.5">Platform</label>
              <select value={form.platform} onChange={e => update("platform", e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30">
                {["instagram", "youtube", "facebook", "twitter", "linkedin"].map(p => (
                  <option key={p} value={p} className="bg-zinc-900 capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1.5">Niche</label>
              <input value={form.niche} onChange={e => update("niche", e.target.value)} placeholder="fitness, cooking..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-2">Subscription Plan</label>
            <div className="grid grid-cols-4 gap-2">
              {(["free", "lifetime", "monthly", "yearly"] as Plan[]).map(p => (
                <button key={p} onClick={() => update("plan", p)}
                  className={`py-2 rounded-lg text-xs font-medium capitalize transition border ${
                    form.plan === p
                      ? p === "free" ? "border-zinc-500 bg-zinc-700 text-zinc-100"
                        : p === "lifetime" ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                        : p === "monthly" ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                        : "border-purple-500/50 bg-purple-500/10 text-purple-400"
                      : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                  }`}>{p}</button>
              ))}
            </div>
            {form.plan !== "free" && <p className="text-xs text-zinc-600 mt-1.5">ℹ️ Activated immediately without payment</p>}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex gap-3 sticky bottom-0 bg-zinc-950">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-medium hover:text-zinc-200 transition">Cancel</button>
          <button onClick={handleCreate} disabled={loading || !form.email || !form.password}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-400 transition disabled:opacity-50">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><UserPlus className="w-4 h-4" /> Create User</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Action Menu ───────────────────────────────────────────────────────
function ActionMenu({ user, onAction, busy }: {
  user: User;
  onAction: (action: string, value: string) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const PLANS = [
    { label: "Set Free", action: "set_plan", value: "free", color: "text-zinc-300" },
    { label: "Set Lifetime", action: "set_plan", value: "lifetime", color: "text-amber-400" },
    { label: "Set Monthly", action: "set_plan", value: "monthly", color: "text-blue-400" },
    { label: "Set Yearly", action: "set_plan", value: "yearly", color: "text-purple-400" },
  ];
  const banAction = { label: user.status === "banned" ? "✓ Unban" : "✕ Ban", action: "set_status", value: user.status === "banned" ? "active" : "banned", color: user.status === "banned" ? "text-green-400" : "text-red-400" };
  const ACTIONS = [...PLANS, banAction];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={busy}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition disabled:opacity-40"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Actions"}
        {!busy && <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl min-w-44 overflow-hidden">
            <div className="px-3 py-1.5 text-[10px] text-zinc-600 font-medium uppercase tracking-wider border-b border-zinc-800">Plan</div>
            {PLANS.map(a => (
              <button key={a.label}
                onClick={async () => { setOpen(false); await onAction(a.action, a.value); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium w-full text-left hover:bg-zinc-800 transition ${a.color} ${user.plan === a.value ? "opacity-40 pointer-events-none" : ""}`}>
                {user.plan === a.value ? "✓ " : ""}{a.label}
              </button>
            ))}
            <div className="border-t border-zinc-800" />
            <div className="px-3 py-1.5 text-[10px] text-zinc-600 font-medium uppercase tracking-wider border-b border-zinc-800">Multi-Account</div>
            <button
              onClick={async () => { setOpen(false); await onAction("grant_pro", "5"); }}
              disabled={user.subscriptionTier === "admin_granted" || user.subscriptionTier === "pro"}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium w-full text-left hover:bg-zinc-800 transition text-violet-400 ${(user.subscriptionTier === "admin_granted" || user.subscriptionTier === "pro") ? "opacity-40 pointer-events-none" : ""}`}>
              {user.subscriptionTier === "admin_granted" ? "✓ Pro Granted" : "🚀 Grant Pro (5 accounts)"}
            </button>
            <div className="border-t border-zinc-800" />
            <button
              onClick={async () => { setOpen(false); await onAction(banAction.action, banAction.value); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium w-full text-left hover:bg-zinc-800 transition ${banAction.color}`}>
              {banAction.label}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── User Card (Mobile) ────────────────────────────────────────────────
function UserCard({ user, onAction, saving }: { user: User; onAction: (userId: string, action: string, value: string) => Promise<void>; saving: string | null }) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3 ${user.status === "banned" ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-100 truncate">{user.name || "—"}</p>
          <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          {user.whatsapp && user.whatsapp !== "—" && <p className="text-xs text-zinc-600">{user.whatsapp}</p>}
        </div>
        <ActionMenu user={user} onAction={(a, v) => onAction(user.id, a, v)} busy={saving === user.id} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`px-2 py-0.5 rounded-full font-medium capitalize ${user.status === "banned" ? STATUS_BADGE.banned : PLAN_COLORS[user.plan]}`}>
          {user.status === "banned" ? "Banned" : user.plan}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 capitalize">{user.platform}</span>
        {user.niche && <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">{user.niche}</span>}
      </div>
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span>{user.analysesCount} analyses</span>
        <span className="flex items-center gap-1">
          API: {user.apiKeysSet ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-zinc-600" />}
        </span>
        {user.createdAt && <span>{new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ userId: string; msg: string } | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
      setDemo(data.demo || false);
      setLastRefresh(new Date());
    } catch {
      setDemo(true);
      setUsers([]);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchUsers(true), 30000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  const handleAction = async (userId: string, action: string, value: string) => {
    setSaving(userId);
    setActionError(null);
    // Optimistic update
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      if (action === "set_plan") return { ...u, plan: value as Plan };
      if (action === "set_status") return { ...u, status: value as Status };
      if (action === "grant_pro") return { ...u, subscriptionTier: "admin_granted", maxAccountsPerPlatform: parseInt(value) || 5 };
      return u;
    }));
    try {
      if (action === "grant_pro") {
        // Use the grant-multi-account endpoint
        const user = users.find(u => u.id === userId);
        const res = await fetch("/api/admin/grant-multi-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user?.email, maxAccountsPerPlatform: parseInt(value) || 5 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Grant failed");
      } else {
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, action, value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Action failed");
      }
      // Silently refresh to confirm server state
      await fetchUsers(true);
    } catch (e: any) {
      setActionError({ userId, msg: e.message });
      // Revert optimistic update
      await fetchUsers(true);
    } finally {
      setSaving(null);
    }
  };

  const filtered = users.filter(u => {
    const s = search.toLowerCase();
    const matchSearch = !search || u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s);
    const matchPlan = planFilter === "all" || (planFilter === "banned" ? u.status === "banned" : u.plan === planFilter);
    return matchSearch && matchPlan;
  });

  const stats = {
    total: users.length,
    lifetime: users.filter(u => u.plan === "lifetime").length,
    monthly: users.filter(u => u.plan === "monthly").length,
    yearly: users.filter(u => u.plan === "yearly").length,
    free: users.filter(u => u.plan === "free").length,
    banned: users.filter(u => u.status === "banned").length,
  };

  return (
    <div className="space-y-4">
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => fetchUsers()}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-zinc-100">User Management</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-zinc-500 text-sm">{loading ? "Loading..." : `${users.length} users`}</p>
            {!loading && (
              <span className="text-xs text-zinc-700 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchUsers()} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-400 transition">
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Action failed: {actionError.msg}</span>
          <button onClick={() => setActionError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {demo && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm">
          <Database className="w-4 h-4 flex-shrink-0" />
          <span><strong>Demo Mode</strong> — Connect Supabase to manage real users.</span>
        </div>
      )}

      {/* Stats chips */}
      {!loading && users.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Total", val: stats.total, color: "text-zinc-300 bg-zinc-800" },
            { label: "Lifetime", val: stats.lifetime, color: "text-amber-400 bg-amber-500/10 border border-amber-500/20" },
            { label: "Monthly", val: stats.monthly, color: "text-blue-400 bg-blue-500/10 border border-blue-500/20" },
            { label: "Yearly", val: stats.yearly, color: "text-purple-400 bg-purple-500/10 border border-purple-500/20" },
            { label: "Free", val: stats.free, color: "text-zinc-400 bg-zinc-800 border border-zinc-700" },
            { label: "Banned", val: stats.banned, color: "text-red-400 bg-red-500/10 border border-red-500/20" },
          ].map(s => (
            <button key={s.label} onClick={() => setPlanFilter(s.label === "Total" ? "all" : s.label.toLowerCase())}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${s.color} transition hover:opacity-80`}>
              <span className="font-bold">{s.val}</span> {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/30" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {["all", "lifetime", "monthly", "yearly", "free", "banned"].map(p => (
            <button key={p} onClick={() => setPlanFilter(p)}
              className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition whitespace-nowrap flex-shrink-0 ${planFilter === p ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading users...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-zinc-600 text-sm">{demo ? "No users yet" : search ? "No users match your search" : "No users in this category"}</p>
          {!demo && !search && (
            <button onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition">
              <UserPlus className="w-3.5 h-3.5" /> Create first user
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
            {filtered.map(u => (
              <UserCard key={u.id} user={u} onAction={handleAction} saving={saving} />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden lg:block rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
            <div className="overflow-x-auto min-h-[400px] pb-32">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60">
                    {["User", "Plan / Tier", "Connections", "Analyses", "Joined", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id} className={`border-b border-zinc-800 last:border-0 hover:bg-zinc-900/50 transition ${u.status === "banned" ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-200">{u.name || "—"}</p>
                        <p className="text-xs text-zinc-500">{u.email}</p>
                        {u.whatsapp && u.whatsapp !== "—" && <p className="text-xs text-zinc-700">{u.whatsapp}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize w-fit ${u.status === "banned" ? STATUS_BADGE.banned : PLAN_COLORS[u.plan]}`}>
                              {u.status === "banned" ? "Banned" : u.plan}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
                              u.subscriptionTier === "admin_granted" ? "bg-amber-500/15 text-amber-400"
                              : u.subscriptionTier === "pro" ? "bg-violet-500/15 text-violet-400"
                              : "bg-zinc-700/50 text-zinc-500"
                            }`}>
                              {u.subscriptionTier || "free"} · {u.maxAccountsPerPlatform || 1}acc
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-600 capitalize">{u.platform} {u.niche ? `· ${u.niche}` : ""}</p>
                          {saving === u.id && <span className="text-[10px] text-amber-400 flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /> Saving...</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.connectedAccounts.length === 0
                          ? <span className="text-xs text-zinc-600">None</span>
                          : <div className="flex gap-1 flex-wrap">
                            {u.connectedAccounts.map(acc => (
                              <span key={acc} className={`text-xs font-bold ${acc === "instagram" ? "text-pink-400" : acc === "youtube" ? "text-red-400" : acc === "linkedin" ? "text-sky-400" : "text-blue-400"}`}>
                                {acc === "instagram" ? "IG" : acc === "youtube" ? "YT" : acc === "linkedin" ? "LI" : "FB"}
                              </span>
                            ))}
                          </div>
                        }
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-zinc-200">{u.analysesCount}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ActionMenu user={u} onAction={(a, v) => handleAction(u.id, a, v)} busy={saving === u.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
