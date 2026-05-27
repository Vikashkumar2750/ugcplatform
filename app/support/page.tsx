"use client";

import { useState, useEffect, useRef } from "react";
import { LifeBuoy, Plus, Send, CheckCircle2, Clock, MessageSquare, ChevronRight, Loader2 } from "lucide-react";

const CATEGORIES = ["Bug / Error", "Billing / Payment", "Feature Request", "Account Issue", "General Question"];

interface Message { id: string; sender_role: "user" | "admin"; sender_name: string; content: string; created_at: string; }
interface Ticket { id: string; subject: string; category: string; status: string; created_at: string; messages?: Message[]; }

const STATUS_COLORS: Record<string, string> = {
  open: "text-red-500 bg-red-50 dark:bg-red-900/20",
  in_progress: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
  resolved: "text-green-600 bg-green-50 dark:bg-green-900/20",
  closed: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800",
};

// Simulated realtime — in production, replace with Supabase channel subscription
function useRealtimeMessages(ticketId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticketId) return;
    setLoading(true);

    // Simulated initial load
    const mockMessages: Message[] = [
      { id: "1", sender_role: "user", sender_name: "You", content: "Mera analysis 30 min se stuck hai.", created_at: new Date().toISOString() },
    ];
    setMessages(mockMessages);
    setLoading(false);

    // In production with Supabase configured:
    // const supabase = createClient();
    // const channel = supabase.channel(`ticket-${ticketId}`)
    //   .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` },
    //     payload => setMessages(prev => [...prev, payload.new as Message]))
    //   .subscribe();
    // return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  const addMessage = (msg: Message) => setMessages(prev => [...prev, msg]);
  return { messages, loading, addMessage };
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [view, setView] = useState<"list" | "new" | "chat">("list");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, loading: msgsLoading, addMessage } = useRealtimeMessages(selectedTicket?.id || null);

  // Auto-scroll to bottom when new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 600));

    const newTicket: Ticket = {
      id: `tkt-${Date.now()}`,
      subject, category, status: "open",
      created_at: new Date().toISOString(),
    };

    setTickets(prev => [newTicket, ...prev]);
    setSubmitting(false);
    setSubject(""); setCategory(""); setFirstMessage("");

    // Go to chat immediately
    setSelectedTicket(newTicket);
    setView("chat");
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setSending(true);

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      sender_role: "user",
      sender_name: "You",
      content: replyText,
      created_at: new Date().toISOString(),
    };

    addMessage(newMsg);
    setReplyText("");
    setSending(false);

    // In production: insert to Supabase → Realtime broadcasts to admin
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-amber-500" /> Support Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ticket banao — real-time mein reply milega
          </p>
        </div>
        {view !== "new" && (
          <button id="new-ticket-btn" onClick={() => setView("new")}
            className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        )}
      </div>

      {/* New ticket form */}
      {view === "new" && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-lg">New Support Ticket</h2>
            <button onClick={() => setView("list")} className="text-muted-foreground hover:text-foreground text-sm">← Back</button>
          </div>
          <form onSubmit={submitTicket} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium block">Subject</label>
              <input required value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Briefly describe your issue..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium block">Category</label>
              <select required value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30">
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium block">Describe your issue</label>
              <textarea required rows={4} value={firstMessage} onChange={e => setFirstMessage(e.target.value)}
                placeholder="Poori problem explain karo..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none" />
            </div>
            <button type="submit" disabled={submitting}
              className="btn-amber w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><Send className="w-4 h-4" /> Submit & Open Chat</>}
            </button>
          </form>
        </div>
      )}

      {/* Real-time chat */}
      {view === "chat" && selectedTicket && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col" style={{ height: "70vh" }}>
          <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
            <div>
              <button onClick={() => setView("list")} className="text-xs text-muted-foreground hover:text-foreground mb-1">← Back to tickets</button>
              <h2 className="font-semibold text-sm">{selectedTicket.subject}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground">{selectedTicket.category}</p>
                <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[selectedTicket.status]}`}>
                  {selectedTicket.status}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-green-500 bg-green-50 dark:bg-green-900/20 px-2.5 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {msgsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Conversation shuru karo — admin jald hi reply karega
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-xs sm:max-w-md rounded-2xl px-4 py-3 ${m.sender_role === "user" ? "btn-amber text-black" : "bg-muted text-foreground"}`}>
                    <p className="text-[10px] font-bold mb-1 opacity-60">
                      {m.sender_role === "admin" ? "ContentIQ Support" : "You"} · {formatTime(m.created_at)}
                    </p>
                    <p className="text-sm">{m.content}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Reply box */}
          {selectedTicket.status !== "resolved" && selectedTicket.status !== "closed" ? (
            <div className="px-4 py-3 border-t border-border flex gap-2 bg-background">
              <input
                id="support-reply-input"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Message likho..."
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendReply())}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              <button onClick={sendReply} disabled={!replyText.trim() || sending}
                className="btn-amber px-4 py-2.5 rounded-xl font-bold disabled:opacity-40 flex items-center gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <div className="px-4 py-3 border-t border-border text-center text-sm text-muted-foreground bg-muted/20">
              <CheckCircle2 className="w-4 h-4 inline mr-1 text-green-500" /> Ticket resolved
            </div>
          )}
        </div>
      )}

      {/* Ticket list */}
      {view === "list" && (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">Koi ticket nahi hai abhi</p>
              <button onClick={() => setView("new")} className="mt-3 text-sm text-amber-600 dark:text-amber-400 hover:underline font-medium">
                Pehla ticket banao →
              </button>
            </div>
          ) : (
            tickets.map(t => (
              <button key={t.id} onClick={() => { setSelectedTicket(t); setView("chat"); }}
                className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-foreground/20 transition group flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${t.status === "resolved" ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/20"}`}>
                  {t.status === "resolved" ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Clock className="w-5 h-5 text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">{t.category} · {formatDate(t.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Contact info */}
      {view === "list" && (
        <div className="p-4 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground">
          <span className="font-medium">Urgent?</span> WhatsApp:{" "}
          <a href="https://wa.me/917827024726" className="text-amber-600 dark:text-amber-400 hover:underline">+91 78270 24726</a>
          <span className="mx-2">·</span>
          Email: <a href="mailto:support@techaasvik.in" className="text-amber-600 dark:text-amber-400 hover:underline">support@techaasvik.in</a>
        </div>
      )}
    </div>
  );
}
