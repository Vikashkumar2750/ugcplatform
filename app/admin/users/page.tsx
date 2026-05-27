"use client";

import { useEffect, useState } from "react";
import {
  Search, Ban, Gift, CreditCard, ChevronDown, CheckCircle2, XCircle,
  Database, RefreshCw, Loader2, UserPlus, X, Eye, EyeOff
} from "lucide-react";

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
      <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-100">Create New User</h2>
              <p className="text-xs text-zinc-500">User will be able to login immediately</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
              ❌ {error}
            </div>
          )}
          {success && (
            <div className="px-3 py-2.5 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-sm">
              {success}
            </div>
          )}

          {/* Name + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1.5">Full Name</label>
              <input
                value={form.fullName} onChange={e => update("fullName", e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1.5">WhatsApp</label>
              <input
                value={form.whatsapp} onChange={e => update("whatsapp", e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1.5">Email <span className="text-red-400">*</span></label>
            <input
              type="email" value={form.email} onChange={e => update("email", e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1.5">Password <span className="text-red-400">*</span></label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password} onChange={e => update("password", e.target.value)}
                placeholder="Min 6 characters"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 pr-10 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1.5">Platform</label>
              <select
                value={form.platform} onChange={e => update("platform", e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
              >
                {["instagram", "youtube", "facebook", "twitter", "linkedin"].map(p => (
                  <option key={p} value={p} className="bg-zinc-900 capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1.5">Niche</label>
              <input
                value={form.niche} onChange={e => update("niche", e.target.value)}
                placeholder="fitness, cooking..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>
          </div>

          {/* Plan */}
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
                      : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-600"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {form.plan !== "free" && (
              <p className="text-xs text-zinc-600 mt-1.5">
                ℹ️ Plan will be activated immediately without payment
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-medium hover:text-zinc-200 transition">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !form.email || !form.password}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-400 transition disabled:opacity-50"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><UserPlus className="w-4 h-4" /> Create User</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Action Menu ───────────────────────────────────────────────────────
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

// ─── Main Page ─────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

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
      } catch { }
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
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { fetchUsers(); }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-100">User Management</h1>
          <p className="text-zinc-500 text-sm">
            {loading ? "Loading..." : `${users.length} users · ${users.filter(u => u.status === "banned").length} banned`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchUsers} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-400 transition"
          >
            <UserPlus className="w-3.5 h-3.5" /> Create User
          </button>
        </div>
      </div>

      {demo && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm">
          <Database className="w-4 h-4 flex-shrink-0" />
          <span><strong>Demo Mode</strong> — Actions won&apos;t persist. Connect Supabase to manage real users.</span>
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
        <div className="flex gap-1.5 flex-wrap">
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
          <div className="py-16 text-center space-y-3">
            <p className="text-zinc-600 text-sm">{demo ? "No users yet — Supabase not connected" : "No users match your search"}</p>
            {!demo && (
              <button onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition">
                <UserPlus className="w-3.5 h-3.5" /> Create first user
              </button>
            )}
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
                      {u.whatsapp && u.whatsapp !== "—" && <p className="text-xs text-zinc-600">{u.whatsapp}</p>}
                    </td>
                    <td className="px-4 py-3"><p className="text-zinc-300 capitalize">{u.platform}</p><p className="text-xs text-zinc-600">{u.niche}</p></td>
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

      {/* Stats footer */}
      {!loading && users.length > 0 && (
        <div className="flex gap-4 text-xs text-zinc-600">
          <span>Total: <span className="text-zinc-400 font-medium">{users.length}</span></span>
          <span>Lifetime: <span className="text-amber-400 font-medium">{users.filter(u => u.plan === "lifetime").length}</span></span>
          <span>Monthly: <span className="text-blue-400 font-medium">{users.filter(u => u.plan === "monthly").length}</span></span>
          <span>Yearly: <span className="text-purple-400 font-medium">{users.filter(u => u.plan === "yearly").length}</span></span>
          <span>Free: <span className="text-zinc-400 font-medium">{users.filter(u => u.plan === "free").length}</span></span>
          <span>Banned: <span className="text-red-400 font-medium">{users.filter(u => u.status === "banned").length}</span></span>
        </div>
      )}
    </div>
  );
}
