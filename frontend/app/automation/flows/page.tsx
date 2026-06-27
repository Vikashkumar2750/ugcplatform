"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Radio, Plus, Trash2, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Loader2, RefreshCw, X,
  MessageSquare, Clock, GitBranch, UserPlus, Hash,
  AtSign, Heart, Bookmark, Share2, Send, Zap,
  ArrowRight, Copy, Eye, Rocket, Pause, Undo2,
  AlertCircle, CheckCircle2, Tag, Filter, Users,
  Globe, Image as ImageIcon, Bot, Sparkles, Lock
} from "lucide-react";

// ─── All trigger types (2026-level competitor features) ────────────────
const ALL_TRIGGER_TYPES = [
  { value: "dm_keyword", label: "Keyword in DM", desc: "Auto-reply when DM contains specific keywords", icon: Hash, category: "dm" },
  { value: "dm_new_follower", label: "New Follower Welcome", desc: "Welcome message when someone follows you", icon: UserPlus, category: "dm" },
  { value: "story_reply", label: "Story Reply", desc: "Auto-reply when someone replies to your story", icon: Heart, category: "dm" },
  { value: "story_mention", label: "Story Mention", desc: "Thank users who mention you in their story", icon: AtSign, category: "dm" },
  { value: "comment_to_dm", label: "Comment → DM", desc: "DM users who comment with a keyword", icon: MessageSquare, category: "comment" },
  { value: "comment_auto_reply", label: "Auto Comment Reply", desc: "Automatically reply to comments", icon: MessageSquare, category: "comment" },
  { value: "ice_breaker", label: "Ice Breaker", desc: "Suggested conversation starters shown in DM", icon: Sparkles, category: "dm" },
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

interface FlowRule {
  id: string;
  name: string;
  type: string;
  trigger_config: any;
  action_config: any;
  is_active: boolean;
  trigger_count: number;
  version: number;
  publish_status: string;
  created_at: string;
  last_triggered?: string;
  steps?: FlowStep[];
}

interface FlowStep {
  id: string;
  order: number;
  type: "message" | "delay" | "condition" | "collect_input" | "tag";
  config: any;
}

// ─── Flow Builder Modal ────────────────────────────────────────────────
function FlowBuilderModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("dm_keyword");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1); // 1: trigger, 2: config, 3: steps

  // Trigger config
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [matchType, setMatchType] = useState("any");

  // Action / Steps
  const [steps, setSteps] = useState<FlowStep[]>([
    { id: "s1", order: 0, type: "message", config: { text: "" } },
  ]);

  // Scope
  const [scope, setScope] = useState<"global" | "specific">("global");
  const [selectedPost, setSelectedPost] = useState<any>(null);

  const addKeyword = () => {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKeywordInput("");
    }
  };

  const addStep = (stepType: FlowStep["type"]) => {
    setSteps([...steps, {
      id: `s${Date.now()}`,
      order: steps.length,
      type: stepType,
      config: stepType === "message" ? { text: "" }
        : stepType === "delay" ? { seconds: 300 }
        : stepType === "condition" ? { keyword: "", thenMessage: "", elseMessage: "" }
        : stepType === "collect_input" ? { field: "email", prompt: "" }
        : { tag: "" },
    }]);
  };

  const updateStep = (id: string, config: any) => {
    setSteps(steps.map(s => s.id === id ? { ...s, config } : s));
  };

  const removeStep = (id: string) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter(s => s.id !== id));
  };

  const handleSave = async () => {
    if (!name) { setError("Name is required"); return; }
    const firstMsg = steps.find(s => s.type === "message");
    if (!firstMsg?.config.text) { setError("At least one message is required"); return; }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/automation/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          platform: "instagram",
          keywords,
          matchType,
          dmMessage: firstMsg.config.text,
          dmLink: firstMsg.config.link || "",
          delay: 0,
          steps: steps.length > 1 ? steps : undefined,
          scope,
          mediaId: selectedPost?.id,
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
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-bold text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                {step === 1 ? "Choose Trigger" : step === 2 ? "Configure Trigger" : "Build Flow"}
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

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* STEP 1: Choose trigger type */}
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
                    className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left hover:border-amber-400/50 hover:bg-amber-400/5 ${
                      type === t.value ? "border-amber-400/60 bg-amber-400/8" : "border-border"
                    }`}>
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

          {/* STEP 2: Configure trigger */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Automation Name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Welcome New Followers 🙏"
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
              </div>

              {/* Keyword config for keyword-based triggers */}
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

              {/* Lead capture fields */}
              {type === "lead_capture" && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border border-emerald-500/20 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" /> Lead Capture Fields
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {["Name", "Email", "Phone", "City", "Interest", "Budget"].map(field => (
                      <label key={field} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-xs cursor-pointer hover:border-emerald-400/40 transition">
                        <input type="checkbox" className="accent-emerald-500" defaultChecked={["Name", "Email"].includes(field)} />
                        {field}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* AI config */}
              {type === "ai_auto_reply" && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/5 to-purple-500/5 border border-violet-500/20 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Bot className="w-4 h-4 text-violet-400" /> AI Configuration
                  </p>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Business Context</label>
                    <textarea rows={3} placeholder="Describe your business, products, services..."
                      className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">Reply Style</label>
                      <select className="w-full px-3 py-2 mt-1 rounded-xl border border-border text-sm bg-background">
                        <option value="friendly">Friendly 😊</option>
                        <option value="professional">Professional 👔</option>
                        <option value="casual">Casual 🤙</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Language</label>
                      <select className="w-full px-3 py-2 mt-1 rounded-xl border border-border text-sm bg-background">
                        <option value="en">English</option>
                        <option value="hi">Hindi</option>
                        <option value="hinglish">Hinglish</option>
                      </select>
                    </div>
                  </div>
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
                  Next: Build Flow →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Build message flow */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Steps */}
              <div className="space-y-3">
                {steps.map((flowStep, i) => (
                  <div key={flowStep.id} className="relative">
                    {i > 0 && (
                      <div className="absolute -top-3 left-5 w-px h-3 bg-border" />
                    )}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-500 text-[10px] font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {flowStep.type === "message" ? "💬 Message" :
                             flowStep.type === "delay" ? "⏰ Delay" :
                             flowStep.type === "condition" ? "🔀 Condition" :
                             flowStep.type === "collect_input" ? "📋 Collect" :
                             "🏷️ Tag"}
                          </span>
                        </div>
                        {steps.length > 1 && (
                          <button onClick={() => removeStep(flowStep.id)} className="text-muted-foreground hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {flowStep.type === "message" && (
                        <div className="space-y-2">
                          <textarea value={flowStep.config.text} onChange={e => updateStep(flowStep.id, { ...flowStep.config, text: e.target.value })}
                            rows={3} placeholder="Namaste! 🙏 Thanks for reaching out..."
                            className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
                          <input value={flowStep.config.link || ""} onChange={e => updateStep(flowStep.id, { ...flowStep.config, link: e.target.value })}
                            placeholder="Link (optional) — https://..."
                            className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none" />
                        </div>
                      )}

                      {flowStep.type === "delay" && (
                        <select value={flowStep.config.seconds} onChange={e => updateStep(flowStep.id, { seconds: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-background">
                          <option value={60}>1 minute</option>
                          <option value={300}>5 minutes</option>
                          <option value={1800}>30 minutes</option>
                          <option value={3600}>1 hour</option>
                          <option value={14400}>4 hours</option>
                          <option value={86400}>24 hours</option>
                        </select>
                      )}

                      {flowStep.type === "condition" && (
                        <div className="space-y-2">
                          <input value={flowStep.config.keyword || ""} onChange={e => updateStep(flowStep.id, { ...flowStep.config, keyword: e.target.value })}
                            placeholder="If user replies with..."
                            className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none" />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-medium text-emerald-400 uppercase">✅ Then send</label>
                              <textarea value={flowStep.config.thenMessage || ""} onChange={e => updateStep(flowStep.id, { ...flowStep.config, thenMessage: e.target.value })}
                                rows={2} placeholder="Response if matched..."
                                className="w-full px-3 py-2 rounded-xl border border-emerald-500/30 text-sm bg-background focus:outline-none resize-none mt-1" />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-red-400 uppercase">❌ Else send</label>
                              <textarea value={flowStep.config.elseMessage || ""} onChange={e => updateStep(flowStep.id, { ...flowStep.config, elseMessage: e.target.value })}
                                rows={2} placeholder="Response if not matched..."
                                className="w-full px-3 py-2 rounded-xl border border-red-500/30 text-sm bg-background focus:outline-none resize-none mt-1" />
                            </div>
                          </div>
                        </div>
                      )}

                      {flowStep.type === "collect_input" && (
                        <div className="space-y-2">
                          <select value={flowStep.config.field} onChange={e => updateStep(flowStep.id, { ...flowStep.config, field: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-background">
                            <option value="name">Name</option>
                            <option value="email">Email</option>
                            <option value="phone">Phone</option>
                            <option value="city">City</option>
                            <option value="custom">Custom field</option>
                          </select>
                          <input value={flowStep.config.prompt || ""} onChange={e => updateStep(flowStep.id, { ...flowStep.config, prompt: e.target.value })}
                            placeholder="What should we ask? e.g. 'What's your email?'"
                            className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none" />
                        </div>
                      )}

                      {flowStep.type === "tag" && (
                        <input value={flowStep.config.tag || ""} onChange={e => updateStep(flowStep.id, { tag: e.target.value })}
                          placeholder="Tag name, e.g. 'interested', 'vip', 'lead'"
                          className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add step buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Add step:</span>
                {[
                  { type: "message" as const, label: "💬 Message", color: "border-blue-500/30 hover:bg-blue-500/10" },
                  { type: "delay" as const, label: "⏰ Delay", color: "border-amber-500/30 hover:bg-amber-500/10" },
                  { type: "condition" as const, label: "🔀 Condition", color: "border-purple-500/30 hover:bg-purple-500/10" },
                  { type: "collect_input" as const, label: "📋 Collect", color: "border-emerald-500/30 hover:bg-emerald-500/10" },
                  { type: "tag" as const, label: "🏷️ Tag", color: "border-orange-500/30 hover:bg-orange-500/10" },
                ].map(s => (
                  <button key={s.type} onClick={() => addStep(s.type)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${s.color}`}>
                    {s.label}
                  </button>
                ))}
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

// ─── Flow Card ─────────────────────────────────────────────────────────
function FlowCard({ rule, onToggle, onDelete, onPublish, onPause, onRollback }: {
  rule: FlowRule;
  onToggle: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onPause: () => void;
  onRollback: () => void;
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
            {rule.version > 1 && (
              <span className="text-[10px] text-muted-foreground">v{rule.version}</span>
            )}
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
          {/* Keywords */}
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

          {/* Message preview */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Message</p>
            <p className="text-sm bg-muted/40 rounded-xl p-3 leading-relaxed">{rule.action_config?.message}</p>
          </div>

          {/* Version control actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            {rule.publish_status !== "published" && (
              <button onClick={onPublish}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition">
                <Rocket className="w-3 h-3" /> Publish
              </button>
            )}
            {rule.publish_status === "published" && (
              <button onClick={onPause}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition">
                <Pause className="w-3 h-3" /> Pause
              </button>
            )}
            {rule.version > 1 && (
              <button onClick={onRollback}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold hover:bg-blue-500/25 transition">
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
  const [categoryFilter, setCategoryFilter] = useState("all");

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

  const filteredRules = categoryFilter === "all"
    ? rules
    : rules.filter(r => {
        const info = ALL_TRIGGER_TYPES.find(t => t.value === r.type);
        return info?.category === categoryFilter;
      });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Radio className="w-6 h-6 text-amber-500" />
            Automation Flows
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Build multi-step automations with conditions, delays, and lead capture
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRules} disabled={loading}
            className="p-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground transition">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowBuilder(true)}
            className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Automation
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-1 flex-wrap">
        {CATEGORIES.map(c => {
          const count = c.value === "all" ? rules.length
            : rules.filter(r => ALL_TRIGGER_TYPES.find(t => t.value === r.type)?.category === c.value).length;
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

      {/* Rules list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading automations...
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
          <Radio className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">No automations yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first automation to start growing on autopilot</p>
          <button onClick={() => setShowBuilder(true)}
            className="mt-4 btn-amber px-6 py-2.5 rounded-xl text-sm font-bold">
            Create First Automation
          </button>
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

      {showBuilder && <FlowBuilderModal onClose={() => setShowBuilder(false)} onSaved={fetchRules} />}
    </div>
  );
}
