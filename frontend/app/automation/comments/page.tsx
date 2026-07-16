"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Trash2, ToggleLeft, ToggleRight, MessageCircle,
  ChevronDown, ChevronUp, EyeOff, Loader2, RefreshCw,
  Globe, Image as ImageIcon, CheckCircle2, AlertCircle, X,
  MessageSquare, Send, Link as LinkIcon, Eye, Users
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

interface ConnectedAccount {
  id: string;
  platform: string;
  platform_username: string;
  platform_display_name: string;
}

interface MediaPost {
  id: string; type: string; url: string;
  thumbnail: string; caption: string; permalink: string;
}

interface CommentRule {
  id: string; name: string; type: string;
  trigger_config: { keywords: string[]; match_type: string; media_id: string | null; media_thumb?: string; media_caption?: string };
  action_config: { reply_text?: string; message?: string; link?: string; hide?: boolean; actions_enabled?: { reply: boolean; dm: boolean; hide: boolean } };
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

// ─── Action Toggle ─────────────────────────────────────────────────────
function ActionToggle({ icon: Icon, label, desc, active, onChange, color }: {
  icon: any; label: string; desc: string; active: boolean; onChange: () => void; color: string;
}) {
  return (
    <button onClick={onChange}
      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all text-left w-full ${
        active ? `${color} border-current/30` : "border-border text-muted-foreground hover:border-foreground/20"
      }`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? "bg-current/10" : "bg-muted/50"}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-[11px] opacity-70 mt-0.5">{desc}</p>
      </div>
      <div className={`w-9 h-5 rounded-full transition flex-shrink-0 mt-1 ${active ? "bg-current/60" : "bg-muted-foreground/30"}`}>
        <div className={`w-4 h-4 rounded-full bg-white transition-all mt-0.5 ${active ? "ml-4" : "ml-0.5"}`} />
      </div>
    </button>
  );
}

// ─── New Rule Modal (UNIFIED: DM + Reply + Hide in ONE rule) ───────────
function NewRuleModal({ onClose, onSaved, platform, accounts }: {
  onClose: () => void; onSaved: () => void; platform: string; accounts: ConnectedAccount[];
}) {
  const [name, setName] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("ALL");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [matchType, setMatchType] = useState<"any" | "all">("any");

  // Unified actions — user can enable any combination
  const [enableReply, setEnableReply] = useState(true);
  const [enableDM, setEnableDM] = useState(true);
  const [enableHide, setEnableHide] = useState(false);

  // Action content
  const [replyTexts, setReplyTexts] = useState<string[]>([""]);
  const [dmMessages, setDmMessages] = useState<string[]>([""]);
  const [dmLink, setDmLink] = useState("");

  // Advanced Flow
  const [requireFollow, setRequireFollow] = useState(false);
  const [followPromptMessages, setFollowPromptMessages] = useState<string[]>([""]);
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpDelay, setFollowUpDelay] = useState<number>(30);
  const [followUpMessages, setFollowUpMessages] = useState<string[]>([""]);

  // Scope
  const [scope, setScope] = useState<"global" | "specific">("global");
  const [selectedPost, setSelectedPost] = useState<MediaPost | null>(null);
  const [showPostPicker, setShowPostPicker] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1); // 1: trigger, 2: actions

  const addKeyword = () => {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKeywordInput("");
    }
  };

  const handleSave = async () => {
    if (!name) { setError("Rule name is required"); return; }
    if (!enableReply && !enableDM && !enableHide) { setError("Enable at least one action"); return; }
    if (enableReply && !replyTexts.some(t => t.trim())) { setError("At least one reply text is required"); return; }
    if (enableDM && !dmMessages.some(t => t.trim())) { setError("At least one DM message is required"); return; }
    if (enableDM && requireFollow && !followPromptMessages.some(t => t.trim())) { setError("Follow prompt message is required"); return; }
    if (scope === "specific" && !selectedPost) { setError("Please select a post"); return; }

    // Auto-add any pending keyword before saving
    let finalKeywords = [...keywords];
    const pendingKw = keywordInput.trim().toLowerCase();
    if (pendingKw && !finalKeywords.includes(pendingKw)) {
      finalKeywords.push(pendingKw);
    }

    setSaving(true); setError("");
    try {
      // If ALL selected, create a single rule with account_id = null
      const accountIds = selectedAccountId === "ALL" 
        ? [null] 
        : [selectedAccountId];

      for (const accId of accountIds) {
        const res = await fetch("/api/automation/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            type: "comment_automation",
            platform,
            account_id: accId || null,
            keywords: finalKeywords,
            matchType,
            replyTexts: enableReply ? replyTexts.filter(t => t.trim()) : [],
            dmMessages: enableDM ? dmMessages.filter(t => t.trim()) : [],
            dmLink: enableDM ? dmLink : "",
            requireFollow: enableDM ? requireFollow : false,
            followPromptMessages: (enableDM && requireFollow) ? followPromptMessages.filter(t => t.trim()) : [],
            followUpEnabled: enableDM ? followUpEnabled : false,
            followUpDelay: (enableDM && followUpEnabled) ? followUpDelay : 0,
            followUpMessages: (enableDM && followUpEnabled) ? followUpMessages.filter(t => t.trim()) : [],
            hide: enableHide,
            actionsEnabled: { reply: enableReply, dm: enableDM, hide: enableHide },
            mediaId: scope === "specific" ? selectedPost?.id : null,
            mediaThumb: scope === "specific" ? selectedPost?.thumbnail : null,
            mediaCaption: scope === "specific" ? selectedPost?.caption : null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Save failed");
      }
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
        <div className="relative bg-card rounded-2xl border border-border w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
          <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="font-heading font-bold text-lg">
                {step === 1 ? "When someone comments..." : "What should happen?"}
              </h2>
              <div className="flex gap-1.5 mt-2">
                {[1, 2].map(s => (
                  <div key={s} className={`h-1 flex-1 rounded-full transition ${step >= s ? "bg-amber-400" : "bg-border"}`} />
                ))}
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-6 space-y-5">
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            {step === 1 && (
              <>
                {/* Account selector */}
                {accounts.length > 0 && (
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
                  <input value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. Send guide when someone comments 'link'"
                    className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
                </div>

                {/* Scope */}
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
                      <span key={k} className="px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-500 text-xs flex items-center gap-1.5 border border-amber-400/20">
                        {k}
                        <button onClick={() => setKeywords(keywords.filter(kw => kw !== k))} className="hover:text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                  {keywords.length === 0 && <p className="text-xs text-muted-foreground">⚠️ Empty = rule triggers on ALL comments</p>}
                </div>

                <button onClick={() => setStep(2)} disabled={!name.trim()}
                  className="w-full py-3 rounded-xl btn-amber text-sm font-bold disabled:opacity-40">
                  Next: Choose Actions →
                </button>
              </>
            )}

            {step === 2 && (
              <>
                {/* Unified Action Toggles */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Enable actions <span className="text-xs text-muted-foreground">(select one or more)</span></p>
                  <ActionToggle icon={MessageCircle} label="Auto-Reply to Comment" desc="Post a public reply under the comment"
                    active={enableReply} onChange={() => setEnableReply(!enableReply)} color="text-blue-500 bg-blue-500/8" />
                  <ActionToggle icon={Send} label="Send DM" desc="Send a private message to the commenter"
                    active={enableDM} onChange={() => setEnableDM(!enableDM)} color="text-violet-500 bg-violet-500/8" />
                  <ActionToggle icon={EyeOff} label="Hide Comment" desc="Auto-hide matching comments (spam filter)"
                    active={enableHide} onChange={() => setEnableHide(!enableHide)} color="text-red-400 bg-red-400/8" />
                </div>

                {/* Reply text */}
                {enableReply && (
                  <div className="space-y-1.5 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <MessageCircle className="w-3.5 h-3.5 text-blue-500" /> Public reply text (Spintax)
                    </label>
                    {replyTexts.map((val, idx) => (
                      <div key={idx} className="flex gap-2 mb-2">
                        <textarea value={val} onChange={e => { const n = [...replyTexts]; n[idx] = e.target.value; setReplyTexts(n); }} rows={2}
                          placeholder="Thanks for commenting! Check your DM 📩🙌"
                          className="w-full px-4 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
                        {replyTexts.length > 1 && (
                          <button onClick={() => setReplyTexts(replyTexts.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 p-2 self-start"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    ))}
                    {replyTexts.length < 5 && (
                      <button onClick={() => setReplyTexts([...replyTexts, ""])} className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1 mt-1">
                        <Plus className="w-3 h-3" /> Add random variation
                      </button>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">These will be picked randomly to prevent spam filters.</p>
                  </div>
                )}

                {/* DM message */}
                {enableDM && (
                  <div className="space-y-3 p-4 rounded-xl border border-violet-500/20 bg-violet-500/5">
                    
                    {/* 1. Require Follow Flow */}
                    <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                      <div>
                        <p className="text-sm font-medium">Require Follower</p>
                        <p className="text-[10px] text-muted-foreground">Only send link if they follow you</p>
                      </div>
                      <div className="flex-shrink-0">
                        {requireFollow ? (
                          <button onClick={() => setRequireFollow(false)} className="text-violet-500"><ToggleRight className="w-7 h-7" /></button>
                        ) : (
                          <button onClick={() => setRequireFollow(true)} className="text-muted-foreground"><ToggleLeft className="w-7 h-7" /></button>
                        )}
                      </div>
                    </div>
                    {requireFollow && (
                      <div className="space-y-1.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                        <label className="text-sm font-medium text-amber-600 dark:text-amber-400">Step 1: Follow Prompt</label>
                        <p className="text-[10px] text-muted-foreground mb-2">Since we can't check follows instantly, we ask them to reply 'DONE' once followed.</p>
                        {followPromptMessages.map((val, idx) => (
                          <div key={idx} className="flex gap-2 mb-2">
                            <textarea value={val} onChange={e => { const n = [...followPromptMessages]; n[idx] = e.target.value; setFollowPromptMessages(n); }} rows={2}
                              placeholder="Hey! 🎁 Please follow me and reply 'DONE' to receive the link!"
                              className="w-full px-4 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
                            {followPromptMessages.length > 1 && (
                              <button onClick={() => setFollowPromptMessages(followPromptMessages.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 p-2 self-start"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        ))}
                        {followPromptMessages.length < 5 && (
                          <button onClick={() => setFollowPromptMessages([...followPromptMessages, ""])} className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Add variation
                          </button>
                        )}
                      </div>
                    )}

                    <div className="pt-2 border-t border-violet-500/10" />

                    {/* 2. Main DM Message */}
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Send className="w-3.5 h-3.5 text-violet-500" /> {requireFollow ? "Step 2: Main DM Message (After 'DONE')" : "Main DM message to send"}
                    </label>
                    {dmMessages.map((val, idx) => (
                      <div key={idx} className="flex gap-2 mb-2">
                        <textarea value={val} onChange={e => { const n = [...dmMessages]; n[idx] = e.target.value; setDmMessages(n); }} rows={3}
                          placeholder="Here is the link you requested 👇"
                          className="w-full px-4 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
                        {dmMessages.length > 1 && (
                          <button onClick={() => setDmMessages(dmMessages.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 p-2 self-start"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    ))}
                    {dmMessages.length < 5 && (
                      <button onClick={() => setDmMessages([...dmMessages, ""])} className="text-xs text-violet-500 hover:text-violet-600 font-medium flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add random variation
                      </button>
                    )}

                    <div className="space-y-1.5 mt-2">
                      <label className="text-xs font-medium flex items-center gap-1.5">
                        <LinkIcon className="w-3 h-3" /> Link (optional)
                      </label>
                      <input value={dmLink} onChange={e => setDmLink(e.target.value)} placeholder="https://your-link.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none" />
                    </div>
                    
                    <div className="pt-2 border-t border-violet-500/10" />

                    {/* 3. Follow-up DM */}
                    <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border mt-2">
                      <div>
                        <p className="text-sm font-medium">Follow-up DM</p>
                        <p className="text-[10px] text-muted-foreground">Send a follow-up if they engage</p>
                      </div>
                      <div className="flex-shrink-0">
                        {followUpEnabled ? (
                          <button onClick={() => setFollowUpEnabled(false)} className="text-violet-500"><ToggleRight className="w-7 h-7" /></button>
                        ) : (
                          <button onClick={() => setFollowUpEnabled(true)} className="text-muted-foreground"><ToggleLeft className="w-7 h-7" /></button>
                        )}
                      </div>
                    </div>
                    {followUpEnabled && (
                      <div className="space-y-2 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium">Wait before sending:</label>
                          <select value={followUpDelay} onChange={e => setFollowUpDelay(Number(e.target.value))} className="px-2 py-1 rounded bg-background border text-xs">
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={1440}>24 hours</option>
                          </select>
                        </div>
                        {followUpMessages.map((val, idx) => (
                          <div key={idx} className="flex gap-2 mb-2">
                            <textarea value={val} onChange={e => { const n = [...followUpMessages]; n[idx] = e.target.value; setFollowUpMessages(n); }} rows={2}
                              placeholder="Did you check it out? Let me know!"
                              className="w-full px-4 py-2 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
                            {followUpMessages.length > 1 && (
                              <button onClick={() => setFollowUpMessages(followUpMessages.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 p-2 self-start"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        ))}
                        {followUpMessages.length < 5 && (
                          <button onClick={() => setFollowUpMessages([...followUpMessages, ""])} className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Add variation
                          </button>
                        )}
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground mt-2">💡 Note: A mandatory opt-out ("Reply STOP to unsubscribe") is automatically added to all DMs.</p>
                  </div>
                )}

                {/* Summary */}
                {(enableReply || enableDM || enableHide) && (
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Rule Summary</p>
                    <p className="text-xs text-muted-foreground">
                      When someone comments {keywords.length > 0 ? <span className="text-amber-500 font-medium">{keywords.join(", ")}</span> : "anything"} on {scope === "global" ? "any post" : "the selected post"}:
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {enableReply && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 font-medium">💬 Auto-reply</span>}
                      {enableDM && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 font-medium">📩 Send DM</span>}
                      {enableHide && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-400/15 text-red-400 border border-red-400/20 font-medium">🙈 Hide comment</span>}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/60 transition">
                    ← Back
                  </button>
                  <button onClick={handleSave} disabled={saving || (!enableReply && !enableDM && !enableHide)}
                    className="flex-1 py-2.5 rounded-xl btn-amber text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Create Rule"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Webhook Status Banner ─────────────────────────────────────────────
function WebhookStatusBanner() {
  const [status, setStatus] = useState<"loading" | "ok" | "not_subscribed" | "error" | "no_page">("loading");
  const [subscribing, setSubscribing] = useState(false);
  const [detail, setDetail] = useState("");

  useEffect(() => {
    fetch("/api/webhooks/meta/subscribe")
      .then(r => r.json())
      .then(data => {
        if (!data.results?.length) {
          setStatus("no_page");
          setDetail("No connected account with page found");
          return;
        }
        
        const subscribedCount = data.results.filter((r: any) => r.subscriptions?.length > 0).length;
        const errorResult = data.results.find((r: any) => r.error);
        const total = data.results.length;

        if (errorResult && subscribedCount === 0) {
          setStatus("error");
          setDetail(errorResult.error);
        } else if (subscribedCount > 0) {
          setStatus("ok");
          if (total === 1) {
            setDetail(`Page "${data.results[0].page_name}" subscribed`);
          } else {
            setDetail(`${subscribedCount} connected accounts subscribed`);
          }
        } else {
          setStatus("not_subscribed");
          setDetail(`Pages NOT subscribed — webhooks won't fire`);
        }
      })
      .catch(() => { setStatus("error"); setDetail("Failed to check"); });
  }, []);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const res = await fetch("/api/webhooks/meta/subscribe", { method: "POST" });
      const data = await res.json();
      
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      
      if (successCount > 0) {
        setStatus("ok");
        setDetail(`✅ Subscribed successfully!`);
      } else {
        setStatus("error");
        setDetail(data.results?.[0]?.error || "Subscription failed");
      }
    } catch {
      setStatus("error");
      setDetail("Network error");
    }
    setSubscribing(false);
  };

  if (status === "loading") return null;
  if (status === "ok") return (
    <div className="p-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 flex items-center gap-2 text-xs">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      <span className="text-emerald-600 dark:text-emerald-400 font-medium">{detail}</span>
      <span className="text-muted-foreground">— webhooks active</span>
    </div>
  );

  return (
    <div className="p-3 rounded-xl border border-red-400/20 bg-red-400/5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs">
        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span className="text-red-500 font-medium">{detail}</span>
      </div>
      {status !== "no_page" && (
        <button onClick={handleSubscribe} disabled={subscribing}
          className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition disabled:opacity-50 flex-shrink-0">
          {subscribing ? "Subscribing..." : "Fix: Subscribe Now"}
        </button>
      )}
      {status === "no_page" && (
        <a href="/connect" className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition flex-shrink-0">
          Reconnect Instagram
        </a>
      )}
    </div>
  );
}

// ─── Rule Card ─────────────────────────────────────────────────────────
function RuleCard({ rule, onToggle, onDelete }: { rule: CommentRule; onToggle: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isSpecific = !!rule.trigger_config?.media_id;
  const keywords = rule.trigger_config?.keywords || [];

  // Determine actions from rule
  const actions = rule.action_config?.actions_enabled || {
    reply: !!rule.action_config?.reply_text,
    dm: !!rule.action_config?.message,
    hide: rule.type === "hide_comment" || !!rule.action_config?.hide,
  };

  // Legacy type label
  const legacyLabel = rule.type === "comment_to_dm" ? "Comment → DM"
    : rule.type === "comment_reply" ? "Auto-reply"
    : rule.type === "hide_comment" ? "Hide Spam"
    : "Comment Rule";

  return (
    <div className={`rounded-2xl border transition-all ${rule.is_active ? "border-border bg-card" : "border-border bg-muted/30 opacity-60"}`}>
      <div className="p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="font-semibold text-sm truncate">{rule.name}</p>
            {/* Action badges */}
            {actions.reply && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-0.5">
                <MessageCircle className="w-2.5 h-2.5" /> Reply
              </span>
            )}
            {actions.dm && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-0.5">
                <Send className="w-2.5 h-2.5" /> DM
              </span>
            )}
            {actions.hide && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20 flex items-center gap-0.5">
                <EyeOff className="w-2.5 h-2.5" /> Hide
              </span>
            )}
            {isSpecific ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-0.5">
                <ImageIcon className="w-2.5 h-2.5" /> Post
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5">
                <Globe className="w-2.5 h-2.5" /> All
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
          {/* Keywords & Trigger Config */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">🔑 Trigger Keywords</p>
              {keywords.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((k: string, i: number) => (
                    <span key={i} className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-medium border border-amber-500/20">
                      {k}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Any comment (no keyword filter)</p>
              )}
              {keywords.length > 1 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Match: <span className="font-medium text-foreground">{rule.trigger_config?.match_type === "all" ? "ALL keywords required" : "ANY keyword matches"}</span>
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">📌 Scope</p>
              {isSpecific ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                  {rule.trigger_config.media_thumb ? (
                    <img src={rule.trigger_config.media_thumb} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-xs truncate">{rule.trigger_config.media_caption || "Specific post"}</p>
                </div>
              ) : (
                <p className="text-xs flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-medium">All Posts</span>
                  <span className="text-muted-foreground">— triggers on any post</span>
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">⚡ Actions</p>
            
            {actions.reply && (
              <div className="rounded-lg border border-blue-500/15 bg-blue-500/5 p-3">
                <p className="text-[10px] font-bold text-blue-400 mb-1 flex items-center gap-1"><MessageCircle className="w-3 h-3" /> PUBLIC REPLY</p>
                <p className="text-sm">{rule.action_config?.reply_text || "—"}</p>
              </div>
            )}
            
            {actions.dm && (
              <div className="rounded-lg border border-violet-500/15 bg-violet-500/5 p-3">
                <p className="text-[10px] font-bold text-violet-400 mb-1 flex items-center gap-1"><Send className="w-3 h-3" /> DM MESSAGE</p>
                <p className="text-sm">{rule.action_config?.message || "—"}</p>
                {rule.action_config?.link && (
                  <p className="text-xs text-amber-500 mt-1.5 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" /> {rule.action_config.link}
                  </p>
                )}
              </div>
            )}
            
            {actions.hide && (
              <div className="rounded-lg border border-red-400/15 bg-red-400/5 p-3">
                <p className="text-[10px] font-bold text-red-400 flex items-center gap-1"><EyeOff className="w-3 h-3" /> AUTO-HIDE enabled</p>
              </div>
            )}

            {!actions.reply && !actions.dm && !actions.hide && (
              <p className="text-xs text-muted-foreground italic">No actions configured</p>
            )}
          </div>

          {/* Footer meta */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1 border-t border-border/50">
            <span>Type: <span className="font-medium text-foreground">{rule.type}</span></span>
            <span>Created: <span className="font-medium text-foreground">{new Date(rule.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></span>
            <span>Triggers: <span className="font-medium text-foreground">{rule.trigger_count || 0}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────
export default function CommentsAutomationPage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") || "instagram";
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
  const [showModal, setShowModal] = useState(false);

  const { data: accountsData } = useSWR("/api/connect/accounts", fetcher);
  const { data: rulesData, mutate: mutateRules } = useSWR(`/api/automation/rules?type=comments&platform=${platform}`, fetcher);

  const loading = !accountsData || !rulesData;
  const accounts = (accountsData?.accounts || []).filter((a: any) => a.platform === platform);
  const rules = rulesData?.rules || [];

  const handleToggle = async (rule: CommentRule) => {
    mutateRules({
      ...rulesData,
      rules: rules.map((r: CommentRule) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r)
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
      rules: rules.filter((r: CommentRule) => r.id !== id)
    }, false);
    
    await fetch(`/api/automation/rules?id=${id}`, { method: "DELETE" });
    mutateRules();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-amber-500" /> {platformLabel} Comment Automation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            One rule, multiple actions — auto-reply, DM, and hide in a single automation
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

      {/* How it works */}
      <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
        <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-2">⚡ One rule does it all</p>
        <div className="grid sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <MessageCircle className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
            <span><strong className="text-foreground">Auto-Reply:</strong> Post a public reply under matching comments</span>
          </div>
          <div className="flex items-start gap-2">
            <Send className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
            <span><strong className="text-foreground">Send DM:</strong> Privately DM the commenter with a message + link</span>
          </div>
          <div className="flex items-start gap-2">
            <EyeOff className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
            <span><strong className="text-foreground">Hide:</strong> Auto-hide spam or unwanted comments</span>
          </div>
        </div>
      </div>

      {/* Webhook subscription check */}
      <WebhookStatusBanner />

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading rules...
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No comment rules yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create a rule to auto-reply AND DM in one click</p>
          <button onClick={() => setShowModal(true)} className="mt-4 btn-amber px-6 py-2.5 rounded-xl text-sm font-bold">
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Total: <span className="text-foreground font-medium">{rules.length}</span></span>
            <span>Active: <span className="text-green-400 font-medium">{rules.filter((r: CommentRule) => r.is_active).length}</span></span>
          </div>
          {rules.map((rule: CommentRule) => (
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
