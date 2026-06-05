"use client";

import { useEffect, useState } from "react";
import { Download, ArrowUpRight, ArrowDownRight, IndianRupee, Search, Database, RefreshCw, Loader2 } from "lucide-react";

interface Transaction {
  id: string; userName: string; userEmail: string;
  type: string; plan: string; amount: number; currency: string;
  method: string; razorpay_payment_id: string; razorpay_order_id?: string;
  razorpay_subscription_id?: string; status: string; created_at: string;
}
interface Summary { gross: number; refunds: number; net: number; count: number; }

const TYPE_COLORS: Record<string, string> = {
  payment: "text-green-400 bg-green-500/10 border border-green-500/20",
  refund: "text-red-400 bg-red-500/10 border border-red-500/20",
  plan_change: "text-blue-400 bg-blue-500/10 border border-blue-500/20",
};

export default function AdminTransactionsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary>({ gross: 0, refunds: 0, net: 0, count: 0 });
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchTxns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/transactions");
      const data = await res.json();
      setTxns(data.transactions || []);
      setSummary(data.summary || { gross: 0, refunds: 0, net: 0, count: 0 });
      setDemo(data.demo || false);
    } catch { setDemo(true); }
    setLoading(false);
  };

  useEffect(() => { fetchTxns(); }, []);

  const filtered = txns.filter(t => {
    const s = search.toLowerCase();
    const matchSearch = !search || t.userName?.toLowerCase().includes(s) || t.userEmail?.toLowerCase().includes(s) || t.razorpay_payment_id?.includes(search);
    const matchType = typeFilter === "all" || t.type === typeFilter || (typeFilter === "failed" && t.status === "failed");
    return matchSearch && matchType;
  });

  const exportCsv = () => {
    const header = "ID,User,Email,Type,Plan,Amount,Status,Date";
    const rows = filtered.map(t => `${t.id},${t.userName},${t.userEmail},${t.type},${t.plan},${t.amount},${t.status},${t.created_at}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-100">Transactions</h1>
          <p className="text-zinc-500 text-sm">{loading ? "Loading..." : `${summary.count} total`}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTxns} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={exportCsv} disabled={txns.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-40">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {demo && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm">
          <Database className="w-4 h-4 flex-shrink-0" />
          <span><strong>Demo Mode</strong> — No real transactions yet. Connect Supabase + Razorpay to see payment history.</span>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Gross Revenue", value: `₹${summary.gross}`, icon: ArrowUpRight, color: "text-green-400" },
          { label: "Refunds", value: `₹${Math.abs(summary.refunds)}`, icon: ArrowDownRight, color: "text-red-400" },
          { label: "Net Revenue", value: `₹${summary.net}`, icon: IndianRupee, color: "text-amber-400" },
          { label: "Transactions", value: summary.count, icon: ArrowUpRight, color: "text-blue-400" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950">
            <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
            <p className="font-heading text-lg font-bold text-zinc-100">{loading ? "—" : s.value}</p>
            <p className="text-xs text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user, email, payment ID..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/30" />
        </div>
        <div className="flex gap-1.5">
          {["all", "payment", "refund", "plan_change", "failed"].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition ${typeFilter === t ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
              {t.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading transactions...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-600 text-sm">
            {demo ? "No transactions — connect Razorpay to see payment history" : "No transactions match filters"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  {["User", "Type", "Plan", "Amount", "Status", "Payment ID", "Date"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900/60 transition">
                    <td className="px-4 py-3"><p className="font-medium text-zinc-200">{t.userName}</p><p className="text-xs text-zinc-500">{t.userEmail}</p></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[t.type] || ""}`}>{t.type?.replace("_", " ")}</span></td>
                    <td className="px-4 py-3 text-xs text-zinc-400 capitalize">{t.plan}</td>
                    <td className={`px-4 py-3 font-bold ${t.amount < 0 ? "text-red-400" : "text-green-400"}`}>
                      {t.amount < 0 ? "-" : "+"}₹{Math.abs(t.amount)}
                    </td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.status === "success" ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>{t.status}</span></td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{t.razorpay_payment_id || "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{t.created_at ? new Date(t.created_at).toLocaleDateString("en-IN") : "—"}</td>
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
