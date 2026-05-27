"use client";

import { useEffect, useState, useRef } from "react";
import { Search, Send, Database, RefreshCw, Loader2, AlertCircle, Clock, CheckCircle2, X } from "lucide-react";

type Priority = "low" | "medium" | "high" | "urgent";
type Status = "open" | "in_progress" | "resolved" | "closed";

interface Message { id: string; sender_role: "user" | "admin"; sender_name: string; content: string; created_at: string; }
interface Ticket {
  id: string; user_email: string; user_name: string; subject: string; category: string;
  priority: Priority; status: Status; created_at: string; support_messages?: Message[];
}

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "text-red-400 bg-red-500/10 border border-red-500/30",
  high: "text-orange-400 bg-orange-500/10 border border-orange-500/30",
  medium: "text-amber-400 bg-amber-500/10 border border-amber-500/30",
  low: "text-zinc-400 bg-zinc-700/30 border border-zinc-600",
};

const STATUS_ICONS: Record<Status, any> = {
  open: AlertCircle, in_progress: Clock, resolved: CheckCircle2, closed: X
};
const STATUS_COLORS: Record<Status, string> = {
  open: "text-red-400", in_progress: "text-amber-400", resolved: "text-green-400", closed: "text-zinc-500"
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tickets");
      const data = await res.json();
      setTickets(data.tickets || []);
      setDemo(data.demo || false);
      // Update selected ticket messages if one is open
      if (selected) {
        const updated = (data.tickets || []).find((t: Ticket) => t.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch { setDemo(true); }
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [selected?.support_messages?.length]);

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: selected.id, action: "reply", message: reply }),
      });
      setReply("");
      fetchTickets();
    } catch { }
    setSending(false);
  };

  const updateStatus = async (ticketId: string, status: Status) => {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t));
    if (selected?.id === ticketId) setSelected(s => s ? { ...s, status } : s);
    if (!demo) {
      await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, action: "set_status", value: status }),
      });
    }
  };

  const filtered = tickets.filter(t => {
    const s = search.toLowerCase();
    const matchSearch = !search || t.subject?.toLowerCase().includes(s) || t.user_email?.toLowerCase().includes(s);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCount = tickets.filter(t => t.status === "open").length;

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {/* Ticket list */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-lg font-bold text-zinc-100">Support Tickets</h1>
            <p className="text-xs text-zinc-500">{openCount} open · {tickets.length} total</p>
          </div>
          <button onClick={fetchTickets} disabled={loading} className="p-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {demo && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs">
            <Database className="w-3 h-3 flex-shrink-0" />
            Demo Mode — no real tickets
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none" />
        </div>

        <div className="flex gap-1">
          {["all", "open", "in_progress", "resolved"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium capitalize transition ${statusFilter === s ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-400"}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-xs">
              {demo ? "No tickets yet — Supabase not connected" : "No tickets match filters"}
            </div>
          ) : (
            filtered.map(t => {
              const SIcon = STATUS_ICONS[t.status];
              const unread = (t.support_messages || []).filter(m => m.sender_role === "user").length;
              return (
                <button key={t.id} onClick={() => setSelected(t)}
                  className={`w-full text-left p-3.5 rounded-xl border transition ${selected?.id === t.id ? "border-red-500/40 bg-red-500/5" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-zinc-200 line-clamp-1">{t.subject}</span>
                    {t.status === "open" && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1" />}
                  </div>
                  <p className="text-[10px] text-zinc-500 mb-2">{t.user_email} · {new Date(t.created_at).toLocaleDateString("en-IN")}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${PRIORITY_COLORS[t.priority] || ""}`}>{t.priority}</span>
                    <SIcon className={`w-3 h-3 ${STATUS_COLORS[t.status]}`} />
                    <span className={`text-[10px] ${STATUS_COLORS[t.status]}`}>{t.status.replace("_", " ")}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat panel */}
      {selected ? (
        <div className="flex-1 flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-zinc-100">{selected.subject}</h2>
              <p className="text-xs text-zinc-500 mt-0.5">{selected.user_name} · {selected.user_email} · {selected.category}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["open", "in_progress", "resolved", "closed"] as Status[]).map(s => (
                <button key={s} onClick={() => updateStatus(selected.id, s)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium capitalize transition ${selected.status === s ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {(selected.support_messages || []).length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">No messages yet</div>
            ) : (
              (selected.support_messages || []).map((m, i) => (
                <div key={i} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-lg rounded-xl p-3.5 text-sm ${m.sender_role === "admin" ? "bg-red-500/15 text-zinc-200 border border-red-500/20" : "bg-zinc-800 text-zinc-200"}`}>
                    <p className="text-[10px] font-bold mb-1.5 text-zinc-400">
                      {m.sender_role === "admin" ? "You (Admin)" : selected.user_name} · {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {m.content}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-4 py-3 border-t border-zinc-800 flex gap-2">
            <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply to user..." rows={2}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendReply())}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none" />
            <button onClick={sendReply} disabled={!reply.trim() || sending}
              className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold text-sm flex items-center gap-2 hover:bg-red-400 transition disabled:opacity-40 self-end">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center flex-col gap-3 text-zinc-600">
          <Search className="w-10 h-10 opacity-30" />
          <p className="text-sm">Select a ticket to view conversation</p>
        </div>
      )}
    </div>
  );
}
