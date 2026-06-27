"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Inbox, Bot, CheckCircle2, XCircle, Edit3,
  RefreshCw, Loader2, AlertCircle, Send, Sparkles,
  ThumbsUp, ThumbsDown, ArrowRight, MessageSquare, User
} from "lucide-react";

interface ReviewItem {
  id: string;
  recipient_id: string;
  ai_draft_text: string;
  ai_confidence: number;
  escalation_reason: string;
  ai_provider: string;
  ai_model: string;
  status: string;
  created_at: string;
  reviewed_at?: string;
  agent_edit?: string;
}

function getConfidenceBadge(score: number) {
  if (score >= 70) return { color: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30", label: "High" };
  if (score >= 40) return { color: "bg-amber-400/15 text-amber-400 border-amber-400/30", label: "Medium" };
  return { color: "bg-red-400/15 text-red-400 border-red-400/30", label: "Low" };
}

export default function AIInboxPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "resolved">("pending");

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/automation/ai-reviews?status=${tab}`);
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch { }
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleApprove = async (item: ReviewItem, edited?: string) => {
    setActionLoading(item.id);
    try {
      await fetch(`/api/automation/ai-reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: item.id, action: "approve", editedText: edited }),
      });
      setReviews(prev => prev.filter(r => r.id !== item.id));
      setActiveId(null);
    } catch { }
    setActionLoading(null);
  };

  const handleDiscard = async (item: ReviewItem) => {
    setActionLoading(item.id);
    try {
      await fetch(`/api/automation/ai-reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: item.id, action: "discard" }),
      });
      setReviews(prev => prev.filter(r => r.id !== item.id));
    } catch { }
    setActionLoading(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Inbox className="w-6 h-6 text-violet-500" />
            AI Review Inbox
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review AI-generated replies before they&apos;re sent. Low confidence replies are flagged here.
          </p>
        </div>
        <button onClick={fetchReviews} disabled={loading}
          className="p-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground transition">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 w-fit">
        {(["pending", "resolved"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t === "pending" ? "⏳ Pending Review" : "✅ Resolved"}
            {t === "pending" && reviews.length > 0 && tab === "pending" && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-bold">
                {reviews.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-xl border border-violet-400/20 bg-violet-400/5 text-xs flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">AI Confidence Scoring:</span> Replies with &lt;70% confidence are routed here for human review.
          You can approve as-is, edit the reply, or discard it entirely.
        </div>
      </div>

      {/* Review Items */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading reviews...
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
          <Inbox className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">
            {tab === "pending" ? "No pending reviews 🎉" : "No resolved reviews yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {tab === "pending" ? "All AI replies had high enough confidence to auto-send" : "Reviews will appear here after you approve or discard them"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(item => {
            const badge = getConfidenceBadge(item.ai_confidence);
            const isEditing = activeId === item.id;
            const isLoading = actionLoading === item.id;

            return (
              <div key={item.id}
                className="rounded-2xl border border-border bg-card overflow-hidden transition-all hover:border-foreground/10">
                <div className="p-5 space-y-3">
                  {/* Meta info */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-violet-400/10 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">AI Draft for</p>
                        <p className="text-sm font-medium flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {item.recipient_id?.substring(0, 16)}…
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${badge.color}`}>
                        {item.ai_confidence}% — {badge.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.ai_provider}/{item.ai_model?.substring(0, 20)}
                      </span>
                    </div>
                  </div>

                  {/* Escalation reason */}
                  <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-400/5 border border-amber-400/15">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">{item.escalation_reason}</p>
                  </div>

                  {/* AI Draft */}
                  <div className="relative">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">AI Reply Draft</p>
                    {isEditing ? (
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border border-violet-400/30 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-400/30 resize-none"
                      />
                    ) : (
                      <div className="px-4 py-3 rounded-xl bg-muted/40 border border-border">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.ai_draft_text}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {tab === "pending" && (
                    <div className="flex items-center gap-2 pt-1">
                      {isEditing ? (
                        <>
                          <button onClick={() => { setActiveId(null); setEditText(""); }}
                            className="px-3 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted/50 transition">
                            Cancel
                          </button>
                          <button onClick={() => handleApprove(item, editText)}
                            disabled={isLoading || !editText.trim()}
                            className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition hover:opacity-90">
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Send Edited Reply
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleApprove(item)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/25 transition disabled:opacity-50">
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                            Approve & Send
                          </button>
                          <button onClick={() => { setActiveId(item.id); setEditText(item.ai_draft_text); }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs font-bold hover:bg-blue-500/25 transition">
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={() => handleDiscard(item)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-bold hover:bg-red-500/25 transition disabled:opacity-50">
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                            Discard
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Resolved status */}
                  {tab === "resolved" && item.status && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                        item.status === "approved" || item.status === "edited" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}>
                        {item.status === "edited" ? "✏️ Edited & Sent" : item.status === "approved" ? "✅ Approved" : "❌ Discarded"}
                      </span>
                      {item.reviewed_at && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.reviewed_at).toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
