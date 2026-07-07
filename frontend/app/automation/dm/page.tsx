"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Trash2, ToggleLeft, ToggleRight, MessageSquare,
  Link as LinkIcon, ChevronDown, ChevronUp, AlertCircle,
  Clock, Loader2, RefreshCw, Globe, Image as ImageIcon, X, Users
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

interface ConnectedAccount {
  id: string;
  platform: string;
  platform_username: string;
  platform_display_name: string;
}

const TRIGGER_TYPES = [
  { value: "dm_keyword", label: "Keyword in DM", desc: "Trigger when DM contains specific words" },
  { value: "dm_new_follower", label: "New Follower", desc: "Send welcome DM to new followers" },
  { value: "story_reply", label: "Story Reply", desc: "Auto-reply when someone replies to your story" },
  { value: "comment_to_dm", label: "Comment → DM", desc: "DM someone who comments with a keyword" },
];

interface MediaPost {
  id: string; type: string; url: string;
  thumbnail: string; caption: string; permalink: string;
}

interface DmRule {
  id: string; name: string; type: string;
  trigger_config: { keywords: string[]; match_type: string; media_id: string | null; media_thumb?: string; media_caption?: string };
  action_config: { message: string; link?: string; delay_seconds?: number };
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
      .then(d => { if (d.error && !d.media?.length) setError(d.error); setMedia(d.media || []); })
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
            <p className="text-xs text-muted-foreground">Rule triggers only on comments from this post</p>
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
              <p className="text-xs text-muted-foreground">Connect Instagram first</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {media.map(post => (
                <button key={post.id} onClick={() => { onSelect(post); onClose(); }}
                  className="relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-amber-400 transition group bg-muted">
                  {post.url ? (
                    <img src={post.url} alt={post.caption}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : null}
                  {/* Caption fallback shown always — visible when no image */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2 bg-gradient-to-br from-amber-500/20 to-amber-900/30">
                    <p className="text-[10px] text-center text-foreground/80 line-clamp-4 leading-tight">{post.caption || "Post"}</p>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition" />
                  {(post.type === "VIDEO" || post.type === "REEL") && (
                    <div className="absolute top-1 right-1 bg-black/60 rounded px-1 py-0.5 text-[9px] text-white z-10">Reel</div>
                  )}
                  {post.type === "CAROUSEL_ALBUM" && (
                    <div className="absolute top-1 right-1 bg-black/60 rounded px-1 py-0.5 text-[9px] text-white z-10">⊞</div>
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
function NewRuleModal({ onClose, onSaved, platform, accounts }: {
  onClose: () => void; onSaved: () => void; platform: string; accounts: ConnectedAccount[];
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("dm_keyword");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [delay, setDelay] = useState(0);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("ALL");

  // Scope (only shown for comment_to_dm)
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
    if (!message) { setError("Message is required"); return; }
    if (type === "comment_to_dm" && scope === "specific" && !selectedPost) {
      setError("Please select a post"); return;
    }

    setSaving(true); setError("");
    try {
      // If ALL selected, create rules for each account
      const accountIds = selectedAccountId === "ALL"
        ? accounts.map(a => a.id)
        : [selectedAccountId];

      for (const accId of accountIds) {
        const res = await fetch("/api/automation/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name, type, platform, keywords, dmMessage: message, dmLink: link, delay,
            account_id: accId || null,
            mediaId: (type === "comment_to_dm" && scope === "specific") ? selectedPost?.id : null,
            mediaThumb: (type === "comment_to_dm" && scope === "specific") ? selectedPost?.thumbnail : null,
            mediaCaption: (type === "comment_to_dm" && scope === "specific") ? selectedPost?.caption : null,
          }),
      });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Save failed");
      }
      onSaved(); onClose();
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
              <h2 className="font-heading font-bold text-lg">New DM Automation Rule</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            {/* Account selector */}
            {accounts.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Apply to account</label>
                <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/30">
                  <option value="ALL">🌐 ALL {platform} accounts ({accounts.length})</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>@{a.platform_username || a.platform_display_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Rule name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Rule name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome new followers"
                className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
            </div>

            {/* Trigger type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Trigger type</label>
              {TRIGGER_TYPES.map(t => (
                <button key={t.value} onClick={() => setType(t.value)}
                  className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${type === t.value ? "border-amber-400/60 bg-amber-400/8" : "border-border hover:border-foreground/30"}`}>
                  <p className="font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </button>
              ))}
            </div>

            {/* Scope selector — only for comment_to_dm */}
            {type === "comment_to_dm" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Apply to which posts</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setScope("global"); setSelectedPost(null); }}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition ${scope === "global" ? "border-amber-400/60 bg-amber-400/8 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                    <Globe className="w-4 h-4" />
                    <div className="text-left">
                      <p className="font-medium text-xs">All Posts</p>
                      <p className="text-[10px] text-muted-foreground">Every post</p>
                    </div>
                  </button>
                  <button onClick={() => setScope("specific")}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition ${scope === "specific" ? "border-amber-400/60 bg-amber-400/8 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                    <ImageIcon className="w-4 h-4" />
                    <div className="text-left">
                      <p className="font-medium text-xs">Specific Post</p>
                      <p className="text-[10px] text-muted-foreground">One reel/post</p>
                    </div>
                  </button>
                </div>

                {scope === "specific" && (
                  <div className="mt-1">
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
            )}

            {/* Keywords */}
            {(type === "dm_keyword" || type === "comment_to_dm") && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Keywords (trigger words)</label>
                <div className="flex gap-2">
                  <input value={keywordInput} onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                    placeholder="Type keyword + Enter"
                    className="flex-1 px-4 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none" />
                  <button onClick={addKeyword} className="px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted/60 transition">Add</button>
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
            )}

            {/* Message */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message to send</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
                placeholder="Namaste! 🙏 Thanks for reaching out. Yeh lo mera free guide..."
                className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
              <p className="text-xs text-muted-foreground">💡 Meta Rule: Include opt-out (e.g. &ldquo;Reply STOP to unsubscribe&rdquo;)</p>
            </div>

            {/* Link */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Link (optional)</label>
              <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://your-link.com"
                className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none" />
            </div>

            {/* Delay */}
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
              <button onClick={handleSave} disabled={saving || !name || !message}
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
function RuleCard({ rule, onToggle, onDelete }: { rule: DmRule; onToggle: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = TRIGGER_TYPES.find(t => t.value === rule.type);
  const isSpecific = rule.type === "comment_to_dm" && !!rule.trigger_config?.media_id;

  return (
    <div className={`rounded-2xl border transition-all ${rule.is_active ? "border-border bg-card" : "border-border bg-muted/30 opacity-60"}`}>
      <div className="p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="font-semibold text-sm truncate">{rule.name}</p>
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">{typeInfo?.label}</span>
            {rule.type === "comment_to_dm" && (
              isSpecific ? (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1 flex-shrink-0">
                  <ImageIcon className="w-2.5 h-2.5" /> Specific post
                </span>
              ) : (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1 flex-shrink-0">
                  <Globe className="w-2.5 h-2.5" /> All posts
                </span>
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{rule.action_config?.message?.substring(0, 60)}...</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{rule.trigger_count || 0} triggers</span>
            {(rule.action_config?.delay_seconds || 0) > 0 && (
              <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{rule.action_config.delay_seconds}s</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onToggle}>{rule.is_active ? <ToggleRight className="w-6 h-6 text-amber-500" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}</button>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={onDelete} className="text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border p-4 space-y-3 text-sm">
          {isSpecific && rule.trigger_config.media_thumb && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
              <img src={rule.trigger_config.media_thumb} alt="" className="w-10 h-10 rounded-lg object-cover" />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Target Post</p>
                <p className="text-xs truncate">{rule.trigger_config.media_caption || "No caption"}</p>
              </div>
            </div>
          )}
          {rule.trigger_config.keywords?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">KEYWORDS</p>
              <div className="flex flex-wrap gap-1.5">
                {rule.trigger_config.keywords.map(k => (
                  <span key={k} className="px-2.5 py-1 rounded-full bg-muted text-xs font-medium">{k}</span>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">MESSAGE</p>
            <p className="text-sm bg-muted/40 rounded-lg p-3 leading-relaxed">{rule.action_config?.message}</p>
          </div>
          {rule.action_config?.link && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <LinkIcon className="w-3 h-3" /> {rule.action_config.link}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────
export default function DmAutomationPage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") || "instagram";
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
  const [showModal, setShowModal] = useState(false);

  const { data: accountsData } = useSWR("/api/connect/accounts", fetcher);
  const { data: rulesData, mutate: mutateRules } = useSWR(`/api/automation/rules?type=dm&platform=${platform}`, fetcher);

  const loading = !accountsData || !rulesData;
  const accounts = (accountsData?.accounts || []).filter((a: any) => a.platform === platform);
  const rules = rulesData?.rules || [];

  const handleToggle = async (rule: DmRule) => {
    mutateRules({
      ...rulesData,
      rules: rules.map((r: DmRule) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r)
    }, false);
    
    await fetch("/api/automation/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
    });
    mutateRules();
  };

  const handleDelete = async (id: string) => {
    mutateRules({
      ...rulesData,
      rules: rules.filter((r: DmRule) => r.id !== id)
    }, false);
    
    await fetch(`/api/automation/rules?id=${id}`, { method: "DELETE" });
    mutateRules();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-amber-500" /> {platformLabel} DM Automation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Auto-reply to {platformLabel} DMs based on keywords, new followers, or story replies
            {accounts.length > 0 && <span className="ml-1 text-amber-500 font-medium">({accounts.length} account{accounts.length > 1 ? "s" : ""})</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => mutateRules()} disabled={loading} className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground transition disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowModal(true)} className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Rule
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5 text-xs flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Meta 24-hour messaging window:</span> DMs can only be sent within 24h of user&apos;s last message.
          For new followers, one welcome message is allowed. Always include opt-out option.
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading rules...
        </div>
      ) : rules.length === 0 ? (
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
          {rules.map((rule: DmRule) => (
            <RuleCard key={rule.id} rule={rule}
              onToggle={() => handleToggle(rule)}
              onDelete={() => handleDelete(rule.id)} />
          ))}
        </div>
      )}

      {showModal && <NewRuleModal onClose={() => setShowModal(false)} onSaved={() => mutateRules()} platform={platform} accounts={accounts} />}
    </div>
  );
}
