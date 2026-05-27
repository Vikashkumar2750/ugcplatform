"use client";

import { useState } from "react";
import {
  Plus, Trash2, ToggleLeft, ToggleRight, MessageCircle,
  AlertCircle, ChevronDown, ChevronUp, Send, Eye, EyeOff
} from "lucide-react";

const COMMENT_TRIGGER_TYPES = [
  { value: "comment_reply", label: "Auto-reply to Comment", desc: "Reply publicly to matching comments" },
  { value: "comment_to_dm", label: "Comment → DM", desc: "Send a DM to anyone who comments with keyword" },
  { value: "hide_comment", label: "Hide Spam Comments", desc: "Auto-hide comments with specific words" },
];

interface CommentRule {
  id: string;
  name: string;
  type: string;
  keywords: string[];
  replyText?: string;
  dmMessage?: string;
  dmLink?: string;
  isActive: boolean;
  triggerCount: number;
}

function NewRuleModal({ onClose, onSave }: { onClose: () => void; onSave: (rule: Omit<CommentRule, "id" | "triggerCount">) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("comment_to_dm");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [replyText, setReplyText] = useState("");
  const [dmMessage, setDmMessage] = useState("");
  const [dmLink, setDmLink] = useState("");

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const handleSave = () => {
    if (!name) return;
    onSave({ name, type, keywords, replyText, dmMessage, dmLink, isActive: true });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <h2 className="font-heading font-bold text-lg">New Comment Rule</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Rule name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Send guide to commenters"
            className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Rule type</label>
          {COMMENT_TRIGGER_TYPES.map(t => (
            <button key={t.value} onClick={() => setType(t.value)}
              className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${type === t.value ? "border-amber-400/60 bg-amber-400/8" : "border-border hover:border-foreground/30"}`}>
              <p className="font-medium">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Trigger keywords (leave empty = apply to all comments)</label>
          <div className="flex gap-2">
            <input value={keywordInput} onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addKeyword()}
              placeholder="e.g. guide, link, info"
              className="flex-1 px-4 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none" />
            <button onClick={addKeyword} className="px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted/60">Add</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map(k => (
              <span key={k} className="px-2.5 py-1 rounded-full bg-muted text-xs flex items-center gap-1.5">
                {k}
                <button onClick={() => setKeywords(keywords.filter(kw => kw !== k))} className="hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        </div>

        {type === "comment_reply" && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reply text (public comment reply)</label>
            <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3}
              placeholder="Thanks for commenting! Maine tumhe DM kiya hai 🙌"
              className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
          </div>
        )}

        {(type === "comment_to_dm") && (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">DM message to send</label>
              <textarea value={dmMessage} onChange={e => setDmMessage(e.target.value)} rows={4}
                placeholder="Namaste! Tumne comment kiya tha — yeh raha tumhara guide 👇"
                className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Link (optional)</label>
              <input value={dmLink} onChange={e => setDmLink(e.target.value)} placeholder="https://your-link.com"
                className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none" />
            </div>
          </>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/60">Cancel</button>
          <button onClick={handleSave} disabled={!name}
            className="flex-1 py-2.5 rounded-xl btn-amber text-sm font-bold disabled:opacity-40">Save Rule</button>
        </div>
      </div>
    </div>
  );
}

function RuleCard({ rule, onToggle, onDelete }: { rule: CommentRule; onToggle: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = COMMENT_TRIGGER_TYPES.find(t => t.value === rule.type)?.label;

  return (
    <div className={`rounded-2xl border transition-all ${rule.isActive ? "border-border bg-card" : "border-border bg-muted/30 opacity-60"}`}>
      <div className="p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center flex-shrink-0">
          {rule.type === "hide_comment" ? <EyeOff className="w-4 h-4 text-amber-500" /> : <MessageCircle className="w-4 h-4 text-amber-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-sm truncate">{rule.name}</p>
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{typeLabel}</span>
          </div>
          <p className="text-xs text-muted-foreground">{rule.triggerCount} triggers · {rule.keywords.length > 0 ? rule.keywords.join(", ") : "All comments"}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onToggle}>
            {rule.isActive ? <ToggleRight className="w-6 h-6 text-amber-500" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={onDelete} className="text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border p-4 space-y-3 text-sm">
          {rule.replyText && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">PUBLIC REPLY</p>
              <p className="bg-muted/40 rounded-lg p-3 text-sm">{rule.replyText}</p>
            </div>
          )}
          {rule.dmMessage && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">DM MESSAGE</p>
              <p className="bg-muted/40 rounded-lg p-3 text-sm">{rule.dmMessage}</p>
              {rule.dmLink && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">🔗 {rule.dmLink}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CommentsAutomationPage() {
  const [rules, setRules] = useState<CommentRule[]>([]);
  const [showModal, setShowModal] = useState(false);

  const addRule = (rule: Omit<CommentRule, "id" | "triggerCount">) => {
    setRules([...rules, { ...rule, id: Date.now().toString(), triggerCount: 0 }]);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-amber-500" />
            Comment Automation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Auto-reply, send DMs from comments, and hide spam
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {/* Popular use case callout */}
      <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
        <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-2">💡 Most popular automation</p>
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Comment → DM flow:</strong> Post "Comment GUIDE below" → Whoever comments gets an automatic DM with your link.
          This drives 3–5x more DMs than just putting a link in bio. Creators use this for free guides, offers, and lead magnets.
        </p>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No comment rules yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create a rule to automate comment replies and DMs</p>
          <button onClick={() => setShowModal(true)} className="mt-4 btn-amber px-6 py-2.5 rounded-xl text-sm font-bold">
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <RuleCard key={rule.id} rule={rule}
              onToggle={() => setRules(rules.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r))}
              onDelete={() => setRules(rules.filter(r => r.id !== rule.id))} />
          ))}
        </div>
      )}

      {showModal && <NewRuleModal onClose={() => setShowModal(false)} onSave={addRule} />}
    </div>
  );
}
