"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, ToggleLeft, ToggleRight, MessageCircle,
  ChevronDown, ChevronUp, EyeOff, Loader2, RefreshCw,
  Globe, Image as ImageIcon, CheckCircle2, AlertCircle, X
} from "lucide-react";

const COMMENT_TRIGGER_TYPES = [
  { value: "comment_to_dm", label: "Comment → DM", desc: "DM anyone who comments with a keyword" },
  { value: "comment_reply", label: "Auto-reply to Comment", desc: "Reply publicly to matching comments" },
  { value: "hide_comment", label: "Hide Spam Comments", desc: "Auto-hide comments with specific words" },
];

interface MediaPost {
  id: string; type: string; url: string;
  thumbnail: string; caption: string; permalink: string;
}

interface CommentRule {
  id: string; name: string; type: string;
  trigger_config: { keywords: string[]; match_type: string; media_id: string | null; media_thumb?: string; media_caption?: string };
  action_config: { reply_text?: string; message?: string; link?: string };
  is_active: boolean; trigger_count: number; created_at: string;
}

// ─── Post Picker Modal ─────────────────────────────────────────────────
function PostPickerModal({ onSelect, onClose }: {
  onSelect: (post: MediaPost) => void;
  onClose: () => void;
}) {
  const [media, setMedia] = useState<MediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/automation/media")
      .then(r => r.json())
      .then(d => {
        if (d.error && !d.media?.length) setError(d.error);
        setMedia(d.media || []);
      })
      .catch(() => setError("Failed to load posts"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-bold text-base">Select a Post</h3>
            <p className="text-xs text-muted-foreground">Rule will only trigger on comments from this post</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading your posts...
            </div>
          ) : error ? (
            <div className="text-center py-12 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground">Connect Instagram first from the Connect page</p>
            </div>
          ) : media.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No posts found on your account</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {media.map(post => (
                <button key={post.id} onClick={() => { onSelect(post); onClose(); }}
                  className="relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-amber-400 transition group">
                  {post.url ? (
                    <img src={post.url} alt={post.caption} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-end">
                    <p className="text-[10px] text-white p-1.5 line-clamp-2 opacity-0 group-hover:opacity-100 transition">{post.caption || "No caption"}</p>
                  </div>
                  {post.type === "VIDEO" && (
                    <div className="absolute top-1 right-1 bg-black/60 rounded px-1 py-0.5 text-[9px] text-white">Reel</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── New Rule Modal ────────────────────────────────────────────────────
function NewRuleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("comment_to_dm");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [matchType, setMatchType] = useState<"any" | "all">("any");
  const [replyText, setReplyText] = useState("");
  const [dmMessage, setDmMessage] = useState("");
  const [dmLink, setDmLink] = useState("");

  // Scope: global vs per-post
  const [scope, setScope] = useState<"global" | "specific">("global");
  const [selectedPost, setSelectedPost] = useState<MediaPost | null>(null);
  const [showPostPicker, setShowPostPicker] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const handleSave = async () => {
    if (!name) { setError("Rule name is required"); return; }
    if (scope === "specific" && !selectedPost) { setError("Please select a post"); return; }

    setSaving(true); setError("");
    try {
      const res = await fetch("/api/automation/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, type, platform: "instagram", keywords, matchType,
          replyText, dmMessage, dmLink,
          mediaId: scope === "specific" ? selectedPost?.id : null,
          mediaThumb: scope === "specific" ? selectedPost?.thumbnail : null,
          mediaCaption: scope === "specific" ? selectedPost?.caption : null,
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

  return (
    <>
      {showPostPicker && (
        <PostPickerModal
          onSelect={post => setSelectedPost(post)}
          onClose={() => setShowPostPicker(false)}
        />
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card rounded-2xl border border-border w-full max-w-lg max-h-[92vh] overflow-y-auto">
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg">New Comment Rule</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            {/* Rule name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Rule name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Send guide on 'link' comment"
                className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
            </div>

            {/* Rule type */}
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

            {/* ── SCOPE TOGGLE ─────────────────────────────────────── */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Apply to</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setScope("global"); setSelectedPost(null); }}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition ${scope === "global" ? "border-amber-400/60 bg-amber-400/8 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                  <Globe className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-medium text-xs">All Posts</p>
                    <p className="text-[10px] text-muted-foreground">Triggers on every post</p>
                  </div>
                </button>
                <button onClick={() => setScope("specific")}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition ${scope === "specific" ? "border-amber-400/60 bg-amber-400/8 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                  <ImageIcon className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-medium text-xs">Specific Post</p>
                    <p className="text-[10px] text-muted-foreground">Choose one reel/post</p>
                  </div>
                </button>
              </div>

              {scope === "specific" && (
                <div className="mt-2">
                  {selectedPost ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-400/40 bg-amber-400/5">
                      <img src={selectedPost.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{selectedPost.caption || "No caption"}</p>
                        <p className="text-[10px] text-amber-500 mt-0.5">{selectedPost.type}</p>
                      </div>
                      <button onClick={() => setShowPostPicker(true)} className="text-xs text-amber-500 hover:text-amber-400 font-medium">Change</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowPostPicker(true)}
                      className="w-full py-3 rounded-xl border-2 border-dashed border-border hover:border-amber-400/40 text-sm text-muted-foreground hover:text-foreground transition flex items-center justify-center gap-2">
                      <ImageIcon className="w-4 h-4" /> Pick a post or reel
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Keywords */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Trigger keywords</label>
                <div className="flex gap-1">
                  {(["any", "all"] as const).map(m => (
                    <button key={m} onClick={() => setMatchType(m)}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition ${matchType === m ? "bg-amber-400/20 text-amber-500" : "text-muted-foreground hover:text-foreground"}`}>
                      Match {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input value={keywordInput} onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                  placeholder="e.g. guide, link, info (leave empty = all comments)"
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
              {keywords.length === 0 && <p className="text-xs text-muted-foreground">⚠️ Empty = rule triggers on ALL comments</p>}
            </div>

            {/* Action: comment reply */}
            {type === "comment_reply" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Public reply text</label>
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3}
                  placeholder="Thanks for commenting! Maine tumhe DM kiya hai 🙌"
                  className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
              </div>
            )}

            {/* Action: DM */}
            {(type === "comment_to_dm") && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">DM message to send</label>
                  <textarea value={dmMessage} onChange={e => setDmMessage(e.target.value)} rows={4}
                    placeholder="Namaste! Tumne comment kiya tha — yeh raha tumhara guide 👇"
                    className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
                  <p className="text-xs text-muted-foreground">💡 Include opt-out: &ldquo;Reply STOP to unsubscribe&rdquo;</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Link (optional)</label>
                  <input value={dmLink} onChange={e => setDmLink(e.target.value)} placeholder="https://your-link.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none" />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/60 transition">Cancel</button>
              <button onClick={handleSave} disabled={saving || !name}
                className="flex-1 py-2.5 rounded-xl btn-amber text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Rule"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Rule Card ─────────────────────────────────────────────────────────
function RuleCard({ rule, onToggle, onDelete }: { rule: CommentRule; onToggle: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = COMMENT_TRIGGER_TYPES.find(t => t.value === rule.type)?.label;
  const isSpecific = !!rule.trigger_config?.media_id;
  const keywords = rule.trigger_config?.keywords || [];

  return (
    <div className={`rounded-2xl border transition-all ${rule.is_active ? "border-border bg-card" : "border-border bg-muted/30 opacity-60"}`}>
      <div className="p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center flex-shrink-0">
          {rule.type === "hide_comment" ? <EyeOff className="w-4 h-4 text-amber-500" /> : <MessageCircle className="w-4 h-4 text-amber-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="font-semibold text-sm truncate">{rule.name}</p>
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">{typeLabel}</span>
            {isSpecific ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1 flex-shrink-0">
                <ImageIcon className="w-2.5 h-2.5" /> Specific post
              </span>
            ) : (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1 flex-shrink-0">
                <Globe className="w-2.5 h-2.5" /> All posts
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {rule.trigger_count || 0} triggers · {keywords.length > 0 ? keywords.join(", ") : "All comments"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onToggle}>
            {rule.is_active ? <ToggleRight className="w-6 h-6 text-amber-500" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={onDelete} className="text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3 text-sm">
          {/* Post thumbnail if specific */}
          {isSpecific && rule.trigger_config.media_thumb && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
              <img src={rule.trigger_config.media_thumb} alt="" className="w-10 h-10 rounded-lg object-cover" />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Target Post</p>
                <p className="text-xs truncate">{rule.trigger_config.media_caption || "No caption"}</p>
              </div>
            </div>
          )}
          {rule.action_config?.reply_text && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">PUBLIC REPLY</p>
              <p className="bg-muted/40 rounded-lg p-3 text-sm">{rule.action_config.reply_text}</p>
            </div>
          )}
          {rule.action_config?.message && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">DM MESSAGE</p>
              <p className="bg-muted/40 rounded-lg p-3 text-sm">{rule.action_config.message}</p>
              {rule.action_config?.link && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">🔗 {rule.action_config.link}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────
export default function CommentsAutomationPage() {
  const [rules, setRules] = useState<CommentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/automation/rules?type=comments");
      const data = await res.json();
      setRules(data.rules || []);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleToggle = async (rule: CommentRule) => {
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

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-amber-500" /> Comment Automation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Auto-reply, send DMs from comments — on all posts or a specific reel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRules} disabled={loading} className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground transition disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowModal(true)} className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Rule
          </button>
        </div>
      </div>

      {/* Callout */}
      <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
        <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-1.5">💡 Two modes available</p>
        <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Globe className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
            <span><strong className="text-foreground">All Posts:</strong> Rule triggers on any post&apos;s comments — good for always-on rules like welcome DMs.</span>
          </div>
          <div className="flex items-start gap-2">
            <ImageIcon className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
            <span><strong className="text-foreground">Specific Post:</strong> Pick one reel/post — rule only fires on that post. Perfect for promotions.</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading rules...
        </div>
      ) : rules.length === 0 ? (
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
          {/* Stats row */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Total: <span className="text-foreground font-medium">{rules.length}</span></span>
            <span>Active: <span className="text-green-400 font-medium">{rules.filter(r => r.is_active).length}</span></span>
            <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> All posts: <span className="text-blue-400 font-medium">{rules.filter(r => !r.trigger_config?.media_id).length}</span></span>
            <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Specific: <span className="text-amber-400 font-medium">{rules.filter(r => !!r.trigger_config?.media_id).length}</span></span>
          </div>
          {rules.map(rule => (
            <RuleCard key={rule.id} rule={rule}
              onToggle={() => handleToggle(rule)}
              onDelete={() => handleDelete(rule.id)} />
          ))}
        </div>
      )}

      {showModal && <NewRuleModal onClose={() => setShowModal(false)} onSaved={fetchRules} />}
    </div>
  );
}
