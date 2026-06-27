"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Radio, Plus, Trash2, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Loader2, RefreshCw, X,
  MessageSquare, Clock, GitBranch, UserPlus, Hash,
  AtSign, Heart, Share2, Send, Zap,
  ArrowRight, ArrowDown, Copy, Rocket, Pause, Undo2,
  AlertCircle, CheckCircle2, Users,
  Globe, Image as ImageIcon, Bot, Sparkles, Lock,
  Layout, BookOpen, ChevronRight, Play
} from "lucide-react";

// ─── Trigger Types ─────────────────────────────────────────────────────
const ALL_TRIGGER_TYPES = [
  { value: "dm_keyword", label: "Keyword in DM", desc: "Auto-reply when DM contains specific keywords", icon: Hash, category: "dm" },
  { value: "dm_new_follower", label: "New Follower Welcome", desc: "Welcome message when someone follows you", icon: UserPlus, category: "dm" },
  { value: "story_reply", label: "Story Reply", desc: "Auto-reply when someone replies to your story", icon: Heart, category: "dm" },
  { value: "story_mention", label: "Story Mention", desc: "Thank users who mention you in their story", icon: AtSign, category: "dm" },
  { value: "comment_to_dm", label: "Comment → DM", desc: "DM users who comment with a keyword", icon: MessageSquare, category: "comment" },
  { value: "comment_auto_reply", label: "Auto Comment Reply", desc: "Automatically reply to comments", icon: MessageSquare, category: "comment" },
  { value: "ai_auto_reply", label: "AI Auto-Reply", desc: "GPT-powered smart replies with confidence scoring", icon: Bot, category: "dm" },
  { value: "drip_sequence", label: "Drip Sequence", desc: "Multi-step message sequence with delays", icon: Clock, category: "sequence" },
  { value: "conditional_flow", label: "Conditional Flow", desc: "If/else branching based on user response", icon: GitBranch, category: "flow" },
  { value: "lead_capture", label: "Lead Capture", desc: "Collect email, phone, name via DM conversation", icon: Users, category: "dm" },
  { value: "broadcast", label: "Broadcast", desc: "Send one-time message to engaged audience", icon: Radio, category: "broadcast" },
];

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "dm", label: "DM" },
  { value: "comment", label: "Comments" },
  { value: "sequence", label: "Sequences" },
  { value: "flow", label: "Flows" },
  { value: "broadcast", label: "Broadcast" },
];

// ─── Pre-built Templates ───────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "lead_magnet",
    name: "Comment → DM Lead Magnet",
    desc: "When someone comments a keyword, reply publicly and DM them a link to your guide/freebie",
    icon: "🎯",
    category: "comment",
    config: {
      type: "comment_to_dm",
      name: "Lead Magnet — Comment DM",
      keywords: ["link", "guide", "send"],
      matchType: "any",
      steps: [
        { id: "s1", order: 0, type: "message" as const, config: { text: "Hey! 🙌 Thanks for your interest — here's the guide I mentioned 👇\n\nReply STOP to unsubscribe.", link: "https://your-link.com" } },
      ],
    },
  },
  {
    id: "welcome_follower",
    name: "Welcome New Followers",
    desc: "Automatically send a warm welcome DM when someone follows you",
    icon: "👋",
    category: "dm",
    config: {
      type: "dm_new_follower",
      name: "Welcome New Follower 🙏",
      keywords: [],
      steps: [
        { id: "s1", order: 0, type: "message" as const, config: { text: "Namaste! 🙏 Thanks for following!\n\nI share content about [your niche] here. Let me know if you have any questions!\n\nReply STOP to unsubscribe." } },
      ],
    },
  },
  {
    id: "story_mention_thanks",
    name: "Story Mention Thank You",
    desc: "Thank users who mention you in their Instagram stories",
    icon: "📖",
    category: "dm",
    config: {
      type: "story_mention",
      name: "Story Mention Thank You ❤️",
      keywords: [],
      steps: [
        { id: "s1", order: 0, type: "message" as const, config: { text: "Hey! Thanks so much for the mention in your story! ❤️ Really appreciate the love 🙏\n\nReply STOP to unsubscribe." } },
      ],
    },
  },
  {
    id: "drip_3day",
    name: "3-Day Drip Sequence",
    desc: "Send 3 messages over 3 days — perfect for nurturing leads or onboarding",
    icon: "🔄",
    category: "sequence",
    config: {
      type: "drip_sequence",
      name: "3-Day Nurture Sequence",
      keywords: ["interested", "yes"],
      steps: [
        { id: "s1", order: 0, type: "message" as const, config: { text: "Day 1: Welcome! Here's what you need to know to get started 👇" } },
        { id: "s2", order: 1, type: "delay" as const, config: { seconds: 86400 } },
        { id: "s3", order: 2, type: "message" as const, config: { text: "Day 2: Quick tip — most people see results in the first week when they follow these 3 steps..." } },
        { id: "s4", order: 3, type: "delay" as const, config: { seconds: 86400 } },
        { id: "s5", order: 4, type: "message" as const, config: { text: "Day 3: Ready to take the next step? Here's an exclusive offer just for you 🎁" } },
      ],
    },
  },
  {
    id: "ai_smart_reply",
    name: "AI Smart Reply",
    desc: "Use AI to generate contextual replies — low-confidence replies go to review inbox",
    icon: "🤖",
    category: "dm",
    config: {
      type: "ai_auto_reply",
      name: "AI Smart Reply Bot",
      keywords: [],
      steps: [
        { id: "s1", order: 0, type: "message" as const, config: { text: "[AI Generated Reply]\n\nThis will be replaced by GPT-powered smart response based on your business context." } },
      ],
    },
  },
  {
    id: "lead_capture_funnel",
    name: "Lead Capture Funnel",
    desc: "Collect name, email, and phone via a conversational DM flow",
    icon: "📋",
    category: "dm",
    config: {
      type: "lead_capture",
      name: "Lead Capture — Full Funnel",
      keywords: ["join", "signup", "register"],
      steps: [
        { id: "s1", order: 0, type: "message" as const, config: { text: "Awesome! Let me get your details so we can set you up 🚀\n\nFirst, what's your full name?" } },
        { id: "s2", order: 1, type: "collect_input" as const, config: { field: "name", prompt: "What's your full name?" } },
        { id: "s3", order: 2, type: "message" as const, config: { text: "Great! Now, what's your email address? 📧" } },
        { id: "s4", order: 3, type: "collect_input" as const, config: { field: "email", prompt: "What's your email?" } },
        { id: "s5", order: 4, type: "message" as const, config: { text: "Perfect! You're all set ✅ We'll reach out to you soon!" } },
      ],
    },
  },
  {
    id: "product_launch",
    name: "Product Launch Promo",
    desc: "Comment keyword → DM coupon code + public reply with CTA",
    icon: "📢",
    category: "comment",
    config: {
      type: "comment_to_dm",
      name: "Launch Promo — Coupon DM",
      keywords: ["price", "buy", "order", "discount"],
      matchType: "any",
      steps: [
        { id: "s1", order: 0, type: "message" as const, config: { text: "🎉 Thanks for your interest!\n\nHere's your exclusive 20% discount code: LAUNCH20\n\nUse it at: https://your-store.com\n\nReply STOP to unsubscribe.", link: "https://your-store.com" } },
      ],
    },
  },
  {
    id: "giveaway",
    name: "Giveaway Auto-Entry",
    desc: "Comment keyword to enter — auto-DM confirmation + tag as participant",
    icon: "🎁",
    category: "comment",
    config: {
      type: "comment_to_dm",
      name: "Giveaway Entry",
      keywords: ["giveaway", "enter", "win", "contest"],
      matchType: "any",
      steps: [
        { id: "s1", order: 0, type: "message" as const, config: { text: "🎉 You're IN! Your giveaway entry is confirmed ✅\n\nWinner announced on [date]. Good luck! 🍀\n\nReply STOP to unsubscribe." } },
        { id: "s2", order: 1, type: "tag" as const, config: { tag: "giveaway_participant" } },
      ],
    },
  },
];

interface FlowRule {
  id: string; name: string; type: string;
  trigger_config: any; action_config: any;
  is_active: boolean; trigger_count: number;
  version: number; publish_status: string;
  created_at: string; last_triggered?: string;
}

interface FlowStep {
  id: string; order: number;
  type: "message" | "delay" | "condition" | "collect_input" | "tag";
  config: any;
}

const STEP_TYPES = [
  { type: "message" as const, label: "💬 Message", color: "border-blue-500/30 bg-blue-500/5", nodeColor: "border-blue-400 bg-blue-500/10" },
  { type: "delay" as const, label: "⏰ Delay", color: "border-amber-500/30 bg-amber-500/5", nodeColor: "border-amber-400 bg-amber-500/10" },
  { type: "condition" as const, label: "🔀 Condition", color: "border-purple-500/30 bg-purple-500/5", nodeColor: "border-purple-400 bg-purple-500/10" },
  { type: "collect_input" as const, label: "📋 Collect", color: "border-emerald-500/30 bg-emerald-500/5", nodeColor: "border-emerald-400 bg-emerald-500/10" },
  { type: "tag" as const, label: "🏷️ Tag", color: "border-orange-500/30 bg-orange-500/5", nodeColor: "border-orange-400 bg-orange-500/10" },
];

// ─── Visual Flow Node ──────────────────────────────────────────────────
function FlowNode({ step, index, total, onUpdate, onRemove, isSelected, onSelect }: {
  step: FlowStep; index: number; total: number;
  onUpdate: (config: any) => void; onRemove: () => void;
  isSelected: boolean; onSelect: () => void;
}) {
  const stepType = STEP_TYPES.find(s => s.type === step.type);
  const nodeColor = stepType?.nodeColor || "border-border bg-card";

  return (
    <div className="flex flex-col items-center">
      {/* Connector line from above */}
      {index > 0 && (
        <div className="flex flex-col items-center -mb-1">
          <div className="w-px h-6 bg-gradient-to-b from-amber-400/50 to-amber-400/20" />
          <ArrowDown className="w-3.5 h-3.5 text-amber-400/50 -mt-1" />
        </div>
      )}

      {/* Node */}
      <div onClick={onSelect}
        className={`relative w-full max-w-md rounded-xl border-2 p-4 cursor-pointer transition-all ${
          isSelected ? `${nodeColor} shadow-lg shadow-amber-400/5 scale-[1.02]` : `border-border bg-card hover:border-foreground/20`
        }`}>
        {/* Node header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-500 text-[10px] font-bold flex items-center justify-center">
              {index + 1}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {stepType?.label || step.type}
            </span>
          </div>
          {total > 1 && (
            <button onClick={e => { e.stopPropagation(); onRemove(); }}
              className="text-muted-foreground/50 hover:text-red-500 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Node content (inline editing) */}
        {step.type === "message" && (
          <div className="space-y-2">
            <textarea value={step.config.text || ""} onChange={e => onUpdate({ ...step.config, text: e.target.value })}
              onClick={e => e.stopPropagation()}
              rows={3} placeholder="Type your message..."
              className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none resize-none focus:border-amber-400/50" />
            <input value={step.config.link || ""} onChange={e => onUpdate({ ...step.config, link: e.target.value })}
              onClick={e => e.stopPropagation()}
              placeholder="Link (optional) — https://..."
              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs bg-background focus:outline-none" />
          </div>
        )}

        {step.type === "delay" && (
          <select value={step.config.seconds || 300} onChange={e => onUpdate({ seconds: Number(e.target.value) })}
            onClick={e => e.stopPropagation()}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background">
            <option value={60}>1 minute</option>
            <option value={300}>5 minutes</option>
            <option value={1800}>30 minutes</option>
            <option value={3600}>1 hour</option>
            <option value={14400}>4 hours</option>
            <option value={86400}>24 hours</option>
            <option value={172800}>48 hours</option>
          </select>
        )}

        {step.type === "condition" && (
          <div className="space-y-2" onClick={e => e.stopPropagation()}>
            <input value={step.config.keyword || ""} onChange={e => onUpdate({ ...step.config, keyword: e.target.value })}
              placeholder="If user replies with..."
              className="w-full px-3 py-1.5 rounded-lg border border-border text-sm bg-background focus:outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-emerald-400 uppercase">✅ Then</label>
                <textarea value={step.config.thenMessage || ""} onChange={e => onUpdate({ ...step.config, thenMessage: e.target.value })}
                  rows={2} placeholder="If matched..."
                  className="w-full px-3 py-1.5 rounded-lg border border-emerald-500/30 text-xs bg-background focus:outline-none resize-none mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-red-400 uppercase">❌ Else</label>
                <textarea value={step.config.elseMessage || ""} onChange={e => onUpdate({ ...step.config, elseMessage: e.target.value })}
                  rows={2} placeholder="If not matched..."
                  className="w-full px-3 py-1.5 rounded-lg border border-red-500/30 text-xs bg-background focus:outline-none resize-none mt-1" />
              </div>
            </div>
          </div>
        )}

        {step.type === "collect_input" && (
          <div className="space-y-2" onClick={e => e.stopPropagation()}>
            <select value={step.config.field || "email"} onChange={e => onUpdate({ ...step.config, field: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg border border-border text-sm bg-background">
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="city">City</option>
              <option value="custom">Custom field</option>
            </select>
            <input value={step.config.prompt || ""} onChange={e => onUpdate({ ...step.config, prompt: e.target.value })}
              placeholder="What should we ask?"
              className="w-full px-3 py-1.5 rounded-lg border border-border text-xs bg-background focus:outline-none" />
          </div>
        )}

        {step.type === "tag" && (
          <input value={step.config.tag || ""} onChange={e => onUpdate({ tag: e.target.value })}
            onClick={e => e.stopPropagation()}
            placeholder="Tag name, e.g. 'interested', 'vip', 'lead'"
            className="w-full px-3 py-1.5 rounded-lg border border-border text-sm bg-background focus:outline-none" />
        )}
      </div>
    </div>
  );
}

// ─── Visual Flow Builder ───────────────────────────────────────────────
function FlowBuilderModal({ onClose, onSaved, template }: {
  onClose: () => void; onSaved: () => void;
  template?: typeof TEMPLATES[0] | null;
}) {
  const [name, setName] = useState(template?.config.name || "");
  const [type, setType] = useState(template?.config.type || "dm_keyword");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(template ? 3 : 1); // Skip to builder if template

  // Trigger config
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>(template?.config.keywords || []);
  const [matchType, setMatchType] = useState(template?.config.matchType || "any");

  // Flow steps
  const [steps, setSteps] = useState<FlowStep[]>(
    template?.config.steps || [{ id: "s1", order: 0, type: "message", config: { text: "" } }]
  );
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const addKeyword = () => {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKeywordInput("");
    }
  };

  const addStep = (stepType: FlowStep["type"]) => {
    const newStep: FlowStep = {
      id: `s${Date.now()}`,
      order: steps.length,
      type: stepType,
      config: stepType === "message" ? { text: "" }
        : stepType === "delay" ? { seconds: 300 }
        : stepType === "condition" ? { keyword: "", thenMessage: "", elseMessage: "" }
        : stepType === "collect_input" ? { field: "email", prompt: "" }
        : { tag: "" },
    };
    setSteps([...steps, newStep]);
    setSelectedStepId(newStep.id);
  };

  const updateStep = (id: string, config: any) => {
    setSteps(steps.map(s => s.id === id ? { ...s, config } : s));
  };

  const removeStep = (id: string) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter(s => s.id !== id));
    if (selectedStepId === id) setSelectedStepId(null);
  };

  const handleSave = async () => {
    if (!name) { setError("Name is required"); return; }
    const firstMsg = steps.find(s => s.type === "message");
    if (!firstMsg?.config.text) { setError("At least one message is required"); return; }

    setSaving(true); setError("");
    try {
      const res = await fetch("/api/automation/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, type, platform: "instagram",
          keywords, matchType,
          dmMessage: firstMsg.config.text,
          dmLink: firstMsg.config.link || "",
          delay: 0,
          steps: steps.length > 1 ? steps : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = categoryFilter === "all"
    ? ALL_TRIGGER_TYPES
    : ALL_TRIGGER_TYPES.filter(t => t.category === categoryFilter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-heading font-bold text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              {step === 1 ? "Choose Trigger" : step === 2 ? "Configure Trigger" : "Build Workflow"}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1 flex-1 rounded-full transition ${step >= s ? "bg-amber-400" : "bg-border"}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* STEP 1: Choose trigger */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-1 flex-wrap">
                {CATEGORIES.map(c => (
                  <button key={c.value} onClick={() => setCategoryFilter(c.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      categoryFilter === c.value ? "bg-amber-400/20 text-amber-500" : "text-muted-foreground hover:bg-muted/50"
                    }`}>
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
                {filtered.map(t => (
                  <button key={t.value} onClick={() => { setType(t.value); setStep(2); }}
                    className="flex items-start gap-3 p-4 rounded-xl border border-border transition-all text-left hover:border-amber-400/50 hover:bg-amber-400/5">
                    <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <t.icon className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* STEP 2: Configure */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Automation Name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Welcome New Followers 🙏"
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
              </div>

              {["dm_keyword", "comment_to_dm", "comment_auto_reply"].includes(type) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Trigger Keywords</label>
                  <div className="flex gap-2">
                    <input value={keywordInput} onChange={e => setKeywordInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                      placeholder="Type keyword + Enter"
                      className="flex-1 px-4 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none" />
                    <button onClick={addKeyword}
                      className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted/60 transition">Add</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map(k => (
                      <span key={k} className="px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-500 text-xs flex items-center gap-1.5 border border-amber-400/20">
                        {k}
                        <button onClick={() => setKeywords(keywords.filter(kw => kw !== k))} className="hover:text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-muted-foreground">Match:</label>
                    {["any", "all", "exact"].map(m => (
                      <label key={m} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="radio" name="matchType" value={m} checked={matchType === m}
                          onChange={() => setMatchType(m)} className="accent-amber-500" />
                        {m === "any" ? "Any keyword" : m === "all" ? "All keywords" : "Exact match"}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {type === "ai_auto_reply" && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/5 to-purple-500/5 border border-violet-500/20 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Bot className="w-4 h-4 text-violet-400" /> AI Configuration
                  </p>
                  <textarea rows={3} placeholder="Describe your business, products, services..."
                    className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-400/10 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    <span>Replies below 70% confidence are sent to AI Inbox for review</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl border border-border text-sm hover:bg-muted/60 transition">
                  ← Back
                </button>
                <button onClick={() => setStep(3)} disabled={!name}
                  className="flex-1 py-2.5 rounded-xl btn-amber text-sm font-bold disabled:opacity-40">
                  Next: Build Workflow →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Visual Flow Builder */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Trigger node (non-removable) */}
              <div className="flex flex-col items-center">
                <div className="w-full max-w-md rounded-xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-400/10 to-orange-400/10 p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-500">⚡ Trigger</p>
                      <p className="text-sm font-medium">{ALL_TRIGGER_TYPES.find(t => t.value === type)?.label}</p>
                    </div>
                  </div>
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {keywords.map(k => (
                        <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-500">{k}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Flow nodes */}
              {steps.map((flowStep, i) => (
                <FlowNode key={flowStep.id} step={flowStep} index={i} total={steps.length}
                  onUpdate={config => updateStep(flowStep.id, config)}
                  onRemove={() => removeStep(flowStep.id)}
                  isSelected={selectedStepId === flowStep.id}
                  onSelect={() => setSelectedStepId(flowStep.id === selectedStepId ? null : flowStep.id)} />
              ))}

              {/* Add step connector + buttons */}
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-1.5 flex-wrap justify-center p-2 rounded-xl border border-dashed border-border bg-muted/20">
                  <span className="text-[10px] text-muted-foreground font-medium mr-1">+ Add:</span>
                  {STEP_TYPES.map(s => (
                    <button key={s.type} onClick={() => addStep(s.type)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition ${s.color} hover:opacity-80`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compliance reminder */}
              <div className="p-3 rounded-xl border border-amber-400/20 bg-amber-400/5 text-xs flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>All messages pass through compliance checks (24h window, rate limits, content filter) before sending.</span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="px-4 py-2.5 rounded-xl border border-border text-sm hover:bg-muted/60 transition">
                  ← Back
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Rocket className="w-4 h-4" /> Create Automation</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Template Card ─────────────────────────────────────────────────────
function TemplateCard({ template, onUse }: { template: typeof TEMPLATES[0]; onUse: () => void }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card hover:border-amber-400/30 transition group">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{template.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{template.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{template.desc}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{template.category}</span>
            <span className="text-[10px] text-muted-foreground">{template.config.steps.length} steps</span>
          </div>
        </div>
        <button onClick={onUse}
          className="px-3 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-bold hover:bg-amber-500 transition opacity-0 group-hover:opacity-100 flex items-center gap-1">
          <Play className="w-3 h-3" /> Use
        </button>
      </div>
    </div>
  );
}

// ─── Flow Card ─────────────────────────────────────────────────────────
function FlowCard({ rule, onToggle, onDelete, onPublish, onPause, onRollback }: {
  rule: FlowRule; onToggle: () => void; onDelete: () => void;
  onPublish: () => void; onPause: () => void; onRollback: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const triggerInfo = ALL_TRIGGER_TYPES.find(t => t.value === rule.type);
  const TriggerIcon = triggerInfo?.icon || Zap;
  const statusBadge = {
    published: { label: "Live", color: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30" },
    draft: { label: "Draft", color: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
    paused: { label: "Paused", color: "bg-gray-400/15 text-gray-400 border-gray-400/30" },
  }[rule.publish_status || "published"] || { label: rule.publish_status, color: "bg-gray-400/15 text-gray-400" };

  return (
    <div className={`rounded-2xl border transition-all ${rule.is_active ? "border-border bg-card hover:border-foreground/10" : "border-border bg-muted/20 opacity-60"}`}>
      <div className="p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-400/20 flex items-center justify-center flex-shrink-0">
          <TriggerIcon className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="font-semibold text-sm truncate">{rule.name}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
            {rule.version > 1 && <span className="text-[10px] text-muted-foreground">v{rule.version}</span>}
          </div>
          <p className="text-xs text-muted-foreground">{triggerInfo?.desc}</p>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {rule.trigger_count || 0} triggers</span>
            {rule.last_triggered && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Last: {new Date(rule.last_triggered).toLocaleDateString("en-IN")}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onToggle} title={rule.is_active ? "Deactivate" : "Activate"}>
            {rule.is_active ? <ToggleRight className="w-7 h-7 text-amber-500" /> : <ToggleLeft className="w-7 h-7 text-muted-foreground" />}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground p-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3">
          {rule.trigger_config?.keywords?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Keywords ({rule.trigger_config.match_type || "any"})</p>
              <div className="flex flex-wrap gap-1.5">
                {rule.trigger_config.keywords.map((k: string) => (
                  <span key={k} className="px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-500 text-xs border border-amber-400/20">{k}</span>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Message</p>
            <p className="text-sm bg-muted/40 rounded-xl p-3 leading-relaxed">{rule.action_config?.message}</p>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            {rule.publish_status !== "published" && (
              <button onClick={onPublish} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition">
                <Rocket className="w-3 h-3" /> Publish
              </button>
            )}
            {rule.publish_status === "published" && (
              <button onClick={onPause} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition">
                <Pause className="w-3 h-3" /> Pause
              </button>
            )}
            {rule.version > 1 && (
              <button onClick={onRollback} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold hover:bg-blue-500/25 transition">
                <Undo2 className="w-3 h-3" /> Rollback
              </button>
            )}
            <div className="flex-1" />
            <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-400 text-xs font-medium hover:bg-red-500/10 transition">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────
export default function FlowsPage() {
  const [rules, setRules] = useState<FlowRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [activeTab, setActiveTab] = useState<"automations" | "templates">("automations");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[0] | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/automation/rules");
      const data = await res.json();
      setRules(data.rules || []);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleAction = async (ruleId: string, action: string) => {
    await fetch("/api/automation/rules/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId, action }),
    });
    fetchRules();
  };

  const handleToggle = async (rule: FlowRule) => {
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    await fetch("/api/automation/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
    });
  };

  const handleDelete = async (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    await fetch(`/api/automation/rules?id=${id}`, { method: "DELETE" });
  };

  const useTemplate = (tpl: typeof TEMPLATES[0]) => {
    setSelectedTemplate(tpl);
    setShowBuilder(true);
  };

  const filteredRules = categoryFilter === "all"
    ? rules
    : rules.filter(r => {
        const info = ALL_TRIGGER_TYPES.find(t => t.value === r.type);
        return info?.category === categoryFilter;
      });

  const filteredTemplates = categoryFilter === "all"
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === categoryFilter);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Radio className="w-6 h-6 text-amber-500" />
            Automation Flows
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visual workflow builder with pre-built templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRules} disabled={loading}
            className="p-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground transition">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => { setSelectedTemplate(null); setShowBuilder(true); }}
            className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Automation
          </button>
        </div>
      </div>

      {/* Tabs: Automations / Templates */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 w-fit">
        {([
          { key: "automations" as const, label: "⚡ My Automations", count: rules.length },
          { key: "templates" as const, label: "📋 Templates", count: TEMPLATES.length },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-1 flex-wrap">
        {CATEGORIES.map(c => {
          const count = activeTab === "automations"
            ? (c.value === "all" ? rules.length : rules.filter(r => ALL_TRIGGER_TYPES.find(t => t.value === r.type)?.category === c.value).length)
            : (c.value === "all" ? TEMPLATES.length : TEMPLATES.filter(t => t.category === c.value).length);
          return (
            <button key={c.value} onClick={() => setCategoryFilter(c.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                categoryFilter === c.value ? "bg-amber-400/20 text-amber-500" : "text-muted-foreground hover:bg-muted/50"
              }`}>
              {c.label}
              {count > 0 && <span className="ml-1 text-[10px] opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === "templates" ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Click "Use" to start with a pre-built template — customize it to fit your needs.</p>
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No templates in this category</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredTemplates.map(tpl => (
                <TemplateCard key={tpl.id} template={tpl} onUse={() => useTemplate(tpl)} />
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading automations...
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
          <Radio className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">No automations yet</p>
          <p className="text-sm text-muted-foreground mt-1">Start from a template or build from scratch</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => setActiveTab("templates")}
              className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/60 transition flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Browse Templates
            </button>
            <button onClick={() => { setSelectedTemplate(null); setShowBuilder(true); }}
              className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold">
              Build from Scratch
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRules.map(rule => (
            <FlowCard key={rule.id} rule={rule}
              onToggle={() => handleToggle(rule)}
              onDelete={() => handleDelete(rule.id)}
              onPublish={() => handleAction(rule.id, "publish")}
              onPause={() => handleAction(rule.id, "pause")}
              onRollback={() => handleAction(rule.id, "rollback")} />
          ))}
        </div>
      )}

      {showBuilder && (
        <FlowBuilderModal
          onClose={() => { setShowBuilder(false); setSelectedTemplate(null); }}
          onSaved={fetchRules}
          template={selectedTemplate}
        />
      )}
    </div>
  );
}
