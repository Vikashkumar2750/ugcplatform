"use client";

import { useState } from "react";
import {
  Plus, Trash2, ToggleLeft, ToggleRight, MessageSquare,
  Link as LinkIcon, Zap, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Clock
} from "lucide-react";

const TRIGGER_TYPES = [
  { value: "dm_keyword", label: "Keyword in DM", desc: "Trigger when DM contains specific words" },
  { value: "dm_new_follower", label: "New Follower", desc: "Send welcome DM to new followers" },
  { value: "story_reply", label: "Story Reply", desc: "Auto-reply when someone replies to your story" },
  { value: "comment_to_dm", label: "Comment → DM", desc: "DM someone who comments with a keyword" },
];

interface DmRule {
  id: string;
  name: string;
  type: string;
  keywords: string[];
  message: string;
  link?: string;
  delay: number;
  isActive: boolean;
  triggerCount: number;
}

const MOCK_RULES: DmRule[] = [];

function RuleCard({ rule, onToggle, onDelete }: { rule: DmRule; onToggle: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-2xl border transition-all ${rule.isActive ? "border-border bg-card" : "border-border bg-muted/30 opacity-60"}`}>
      <div className="p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-sm truncate">{rule.name}</p>
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {TRIGGER_TYPES.find(t => t.value === rule.type)?.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{rule.message.substring(0, 60)}...</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span>{rule.triggerCount} triggers</span>
            {rule.delay > 0 && <span><Clock className="w-3 h-3 inline mr-0.5" />{rule.delay}s delay</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition">
            {rule.isActive ? <ToggleRight className="w-6 h-6 text-amber-500" /> : <ToggleLeft className="w-6 h-6" />}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground transition">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={onDelete} className="text-muted-foreground hover:text-red-500 transition">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border p-4 space-y-3 text-sm">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">KEYWORDS</p>
            <div className="flex flex-wrap gap-1.5">
              {rule.keywords.map(k => (
                <span key={k} className="px-2.5 py-1 rounded-full bg-muted text-xs font-medium">{k}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">MESSAGE</p>
            <p className="text-sm bg-muted/40 rounded-lg p-3 leading-relaxed">{rule.message}</p>
          </div>
          {rule.link && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <LinkIcon className="w-3 h-3" /> {rule.link}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewRuleModal({ onClose, onSave }: { onClose: () => void; onSave: (rule: Omit<DmRule, "id" | "triggerCount">) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("dm_keyword");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [delay, setDelay] = useState(0);

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const handleSave = () => {
    if (!name || !message) return;
    onSave({ name, type, keywords, message, link: link || undefined, delay, isActive: true });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <h2 className="font-heading font-bold text-lg">New DM Automation Rule</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Rule name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome new followers"
            className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Trigger type</label>
          <div className="space-y-2">
            {TRIGGER_TYPES.map(t => (
              <button key={t.value} onClick={() => setType(t.value)}
                className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${type === t.value ? "border-amber-400/60 bg-amber-400/8" : "border-border hover:border-foreground/30"}`}>
                <p className="font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {(type === "dm_keyword" || type === "comment_to_dm") && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Keywords (trigger words)</label>
            <div className="flex gap-2">
              <input value={keywordInput} onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addKeyword()}
                placeholder="Type keyword + Enter"
                className="flex-1 px-4 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none" />
              <button onClick={addKeyword} className="px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted/60 transition">Add</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map(k => (
                <span key={k} className="px-2.5 py-1 rounded-full bg-muted text-xs flex items-center gap-1.5">
                  {k}
                  <button onClick={() => setKeywords(keywords.filter(kw => kw !== k))} className="text-muted-foreground hover:text-red-500">×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Message to send</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
            placeholder="Namaste! 🙏 Thanks for reaching out. Yeh lo mera free guide..."
            className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
          <p className="text-xs text-muted-foreground">💡 Meta Rule: Must include opt-out option (e.g. "Reply STOP to unsubscribe")</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Link to include (optional)</label>
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://your-link.com"
            className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Delay before sending</label>
          <select value={delay} onChange={e => setDelay(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none">
            <option value={0}>Immediately</option>
            <option value={60}>1 minute</option>
            <option value={300}>5 minutes</option>
            <option value={1800}>30 minutes</option>
            <option value={3600}>1 hour</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/60 transition">Cancel</button>
          <button onClick={handleSave} disabled={!name || !message}
            className="flex-1 py-2.5 rounded-xl btn-amber text-sm font-bold disabled:opacity-40">Save Rule</button>
        </div>
      </div>
    </div>
  );
}

export default function DmAutomationPage() {
  const [rules, setRules] = useState<DmRule[]>(MOCK_RULES);
  const [showModal, setShowModal] = useState(false);

  const addRule = (rule: Omit<DmRule, "id" | "triggerCount">) => {
    setRules([...rules, { ...rule, id: Date.now().toString(), triggerCount: 0 }]);
  };
  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };
  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-amber-500" />
            DM Automation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Auto-reply to DMs based on keywords, new followers, or story replies
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {/* Meta 24-hour window notice */}
      <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5 text-xs flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Meta 24-hour messaging window:</span> Automated DMs can only be sent within 24 hours of the user's last message.
          For new followers, you can send one welcome message. Always include an opt-out option.
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No DM automation rules yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first rule to start automating DMs</p>
          <button onClick={() => setShowModal(true)} className="mt-4 btn-amber px-6 py-2.5 rounded-xl text-sm font-bold">
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <RuleCard key={rule.id} rule={rule} onToggle={() => toggleRule(rule.id)} onDelete={() => deleteRule(rule.id)} />
          ))}
        </div>
      )}

      {showModal && <NewRuleModal onClose={() => setShowModal(false)} onSave={addRule} />}
    </div>
  );
}
