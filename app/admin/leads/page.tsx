"use client";

import { useState } from "react";
import { Search, Download, CheckCircle2, Clock, XCircle } from "lucide-react";

const LEADS = [
  { id: 1, name: "Rahul Kumar", email: "rahul@gmail.com", whatsapp: "+91 98765 43210", platform: "YouTube", niche: "Finance", status: "paid", date: "26 May 2026", source: "Organic" },
  { id: 2, name: "Priya Sharma", email: "priya@gmail.com", whatsapp: "+91 87654 32109", platform: "Instagram", niche: "Fitness", status: "paid", date: "26 May 2026", source: "Instagram Ad" },
  { id: 3, name: "Aryan Mehta", email: "aryan@gmail.com", whatsapp: "+91 76543 21098", platform: "Instagram", niche: "Tech", status: "pending", date: "25 May 2026", source: "Google" },
  { id: 4, name: "Neha Joshi", email: "neha@gmail.com", whatsapp: "+91 65432 10987", platform: "YouTube", niche: "Beauty", status: "paid", date: "25 May 2026", source: "Dost ne bataya" },
  { id: 5, name: "Amit Kumar", email: "amit@gmail.com", whatsapp: "+91 54321 09876", platform: "Instagram", niche: "Comedy", status: "paid", date: "24 May 2026", source: "Organic" },
  { id: 6, name: "Sneha Singh", email: "sneha@gmail.com", whatsapp: "+91 43210 98765", platform: "Facebook", niche: "Food", status: "paid", date: "24 May 2026", source: "Instagram Ad" },
  { id: 7, name: "Raj Patel", email: "raj@gmail.com", whatsapp: "+91 32109 87654", platform: "Instagram", niche: "Travel", status: "failed", date: "23 May 2026", source: "Google" },
];

const STATUS_CONFIG = {
  paid: { label: "Paid", icon: CheckCircle2, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  pending: { label: "Pending", icon: Clock, className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-600" },
  failed: { label: "Failed", icon: XCircle, className: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

export default function AdminLeadsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = LEADS.filter(l => {
    const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">All Leads</h1>
          <p className="text-sm text-muted-foreground">{LEADS.length} total · {LEADS.filter(l => l.status === "paid").length} paid</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted/60 transition">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Search by name or email..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="flex gap-1.5">
          {["all", "paid", "pending", "failed"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-all capitalize ${statusFilter === s ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Name", "Email", "WhatsApp", "Platform", "Niche", "Source", "Status", "Date"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => {
                const cfg = STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG];
                return (
                  <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition">
                    <td className="px-4 py-3 font-medium">{lead.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.whatsapp}</td>
                    <td className="px-4 py-3">{lead.platform}</td>
                    <td className="px-4 py-3">{lead.niche}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.source}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
