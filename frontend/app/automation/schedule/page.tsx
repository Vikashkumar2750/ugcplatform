"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Plus, Clock, Camera, Share2, Trash2, X, RefreshCw, Loader2,
  Upload, CheckCircle2, AlertCircle, Zap, Send, Music, Bot,
  History, Search, Copy, PlayCircle, Users
} from "lucide-react";

type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";

interface ScheduledPost {
  id: string;
  platform: "instagram" | "facebook";
  content_type: string;
  caption: string;
  first_comment?: string;
  media_url?: string;
  scheduled_at: string;
  status: PostStatus;
  published_at?: string;
  error_message?: string;
  created_at: string;
  audio_name?: string;
  dm_automation_id?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "text-pink-500 bg-pink-500/10 border-pink-500/20",
  facebook:  "text-blue-500 bg-blue-500/10 border-blue-500/20",
};

const STATUS_CFG: Record<PostStatus, { label: string; dot: string; badge: string }> = {
  draft:      { label: "Draft",      dot: "bg-muted-foreground", badge: "bg-muted/50 text-muted-foreground" },
  scheduled:  { label: "Scheduled",  dot: "bg-amber-500",        badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  publishing: { label: "Publishing", dot: "bg-blue-500 animate-pulse", badge: "bg-blue-500/15 text-blue-400" },
  published:  { label: "Published",  dot: "bg-green-500",        badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  failed:     { label: "Failed",     dot: "bg-red-500",          badge: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

// ── Media Upload ──────────────────────────────────────────────────
function MediaUpload({ mediaUrl, onUploaded, onClear, accept, acceptLabel }: {
  mediaUrl: string;
  onUploaded: (url: string) => void;
  onClear: () => void;
  accept?: string;
  acceptLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading]   = useState(false);
  const [progress, setProgress]     = useState(0);
  const [uploadError, setUploadError] = useState("");

  const upload = async (file: File) => {
    setUploading(true);
    setUploadError("");
    setProgress(20);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/automation/schedule/upload", { method: "POST", body: formData });
      setProgress(90);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setProgress(100);
      setTimeout(() => { setProgress(0); setUploading(false); onUploaded(data.url); }, 300);
    } catch (err: any) {
      setUploadError(err.message);
      setUploading(false);
      setProgress(0);
    }
  };

  const isVideo = /\.(mp4|mov)$/i.test(mediaUrl);

  if (mediaUrl) {
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Media</label>
        <div className="relative rounded-xl overflow-hidden border border-border bg-muted/20">
          {isVideo
            ? <video src={mediaUrl} className="w-full max-h-36 object-cover" controls />
            : <img src={mediaUrl} alt="preview" className="w-full max-h-36 object-cover" />}
          <button onClick={onClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const defaultAccept = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime";
  const defaultLabel = "JPG, PNG, WebP, MP4, MOV";

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">Media</label>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-amber-500/50 transition-colors"
      >
        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-500" />
            <p className="text-sm text-muted-foreground">Uploading... {progress}%</p>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <>
            <Upload className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground/50" />
            <p className="text-sm font-medium">Click to upload or drag & drop</p>
            <p className="text-xs text-muted-foreground mt-0.5">{acceptLabel || defaultLabel}</p>
          </>
        )}
      </div>
      {uploadError && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{uploadError}</p>}
      <input ref={inputRef} type="file"
        accept={accept || defaultAccept}
        className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
    </div>
  );
}

// ── Post Modal (with multi-platform, trending audio, DM automation) ──
type ContentTypeKey = "reel" | "post" | "story" | "carousel";

const IG_TYPES: { key: ContentTypeKey; label: string }[] = [
  { key: "reel",     label: "🎬 Reel" },
  { key: "post",     label: "🖼️ Post" },
  { key: "story",    label: "⏱️ Story" },
  { key: "carousel", label: "🎠 Carousel" },
];
const FB_TYPES: { key: ContentTypeKey; label: string }[] = [
  { key: "post",  label: "📝 Post" },
  { key: "reel",  label: "🎬 Reel" },
  { key: "story", label: "⏱️ Story" },
];

// Trending audio suggestions for Reels
const TRENDING_AUDIOS = [
  "Original Audio",
  "Aesthetic Vibes — Lo-Fi",
  "Trending Beat — Hip Hop",
  "Bollywood Remix — Latest",
  "Motivational Speech BG",
  "Podcast Style — Narration",
];

function PostModal({ onClose, onSave, onPublishNow, defaultDate, automationRules, connectedAccounts }: {
  onClose: () => void;
  onSave: (p: any) => Promise<void>;
  onPublishNow: (p: any) => Promise<void>;
  defaultDate?: Date;
  automationRules: Array<{ id: string; name: string; type: string }>;
  connectedAccounts: Array<{ id: string; platform: string; platform_username: string; avatar_url?: string }>;
}) {
  // Selected account IDs (multi-account)
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(() => {
    // Auto-select all connected accounts
    return new Set(connectedAccounts.map(a => a.id));
  });
  const [contentType, setContentType]     = useState<ContentTypeKey>("reel");
  const [caption, setCaption]             = useState("");
  const [firstComment, setFirstComment]   = useState("");
  const [mediaUrl, setMediaUrl]           = useState("");
  const [audioName, setAudioName]         = useState("");
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [dmAutomationId, setDmAutomationId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(() => {
    if (!defaultDate) return "";
    const d = new Date(defaultDate);
    d.setHours(19, 0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [saving, setSaving]       = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pubError, setPubError]   = useState("");
  const [step, setStep]           = useState(1); // 1: content, 2: schedule+options

  // Per-platform caption overrides
  const [showPlatformCaptions, setShowPlatformCaptions] = useState(false);
  const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({});

  // Group accounts by platform
  const accountsByPlatform: Record<string, typeof connectedAccounts> = {};
  connectedAccounts.forEach(a => {
    if (!accountsByPlatform[a.platform]) accountsByPlatform[a.platform] = [];
    accountsByPlatform[a.platform].push(a);
  });

  // Selected platforms (derived from selected accounts)
  const selectedPlatforms = new Set(
    connectedAccounts.filter(a => selectedAccountIds.has(a.id)).map(a => a.platform)
  );
  const hasIG = selectedPlatforms.has("instagram");
  const hasFB = selectedPlatforms.has("facebook");
  const isMultiPlatform = selectedPlatforms.size > 1;

  // Toggle account selection
  const toggleAccount = (id: string) => {
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  };

  // Toggle all accounts for a platform
  const togglePlatform = (platform: string) => {
    const platformAccs = accountsByPlatform[platform] || [];
    const allSelected = platformAccs.every(a => selectedAccountIds.has(a.id));
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all from this platform (but keep at least 1 account total)
        platformAccs.forEach(a => next.delete(a.id));
        if (next.size === 0 && platformAccs.length > 0) next.add(platformAccs[0].id);
      } else {
        platformAccs.forEach(a => next.add(a.id));
      }
      return next;
    });
  };

  // Content types available across selected platforms
  const availableTypes = hasIG ? IG_TYPES : FB_TYPES;
  const isReel = contentType === "reel";

  // Get selected accounts
  const selectedAccounts = connectedAccounts.filter(a => selectedAccountIds.has(a.id));

  const makePayload = (account: typeof connectedAccounts[0]) => ({
    platform: account.platform,
    content_type: contentType,
    caption: platformCaptions[account.platform] || caption,
    first_comment: (account.platform === "instagram" && firstComment) ? firstComment : undefined,
    media_url: mediaUrl || undefined,
    audio_name: isReel ? audioName || undefined : undefined,
    dm_automation_id: dmAutomationId || undefined,
    account_id: account.id,
  });

  const handleSchedule = async () => {
    if (!caption.trim() || !scheduledDate) return;
    setSaving(true);
    for (const acc of selectedAccounts) {
      await onSave({ ...makePayload(acc), scheduled_at: new Date(scheduledDate).toISOString(), status: "scheduled" });
    }
    setSaving(false);
    onClose();
  };

  const handleDraft = async () => {
    if (!caption.trim()) return;
    setSaving(true);
    for (const acc of selectedAccounts) {
      await onSave({ ...makePayload(acc), scheduled_at: new Date(Date.now() + 3600000).toISOString(), status: "draft" });
    }
    setSaving(false);
    onClose();
  };

  const handlePublishNow = async () => {
    if (!caption.trim()) return;
    setPublishing(true); setPubError("");
    try {
      for (const acc of selectedAccounts) {
        await onPublishNow(makePayload(acc));
      }
      onClose();
    } catch (err: any) {
      setPubError(err.message || "Publish failed — check Meta permissions");
    }
    setPublishing(false);
  };

  const PLATFORM_ICONS: Record<string, any> = {
    instagram: Camera, facebook: Share2, youtube: PlayCircle, linkedin: Users,
  };
  const PLATFORM_COLORS: Record<string, string> = {
    instagram: "border-pink-400 bg-pink-500/10 text-pink-500",
    facebook: "border-blue-400 bg-blue-500/10 text-blue-500",
    youtube: "border-red-400 bg-red-500/10 text-red-500",
    linkedin: "border-sky-400 bg-sky-500/10 text-sky-500",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border w-full max-w-lg max-h-[94vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-heading font-bold text-lg">
              {step === 1 ? "Create Post" : "Schedule & Options"}
            </h2>
            <div className="flex gap-1.5 mt-1.5">
              {[1, 2].map(s => (
                <div key={s} className={`h-1 flex-1 rounded-full transition ${step >= s ? "bg-amber-400" : "bg-border"}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {step === 1 && (
            <>
              {/* Multi-Account Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Publish to <span className="text-xs text-muted-foreground ml-1">({selectedAccounts.length} account{selectedAccounts.length !== 1 ? "s" : ""} selected)</span></p>
                  <button
                    onClick={() => {
                      const allSelected = connectedAccounts.every(a => selectedAccountIds.has(a.id));
                      setSelectedAccountIds(allSelected ? new Set([connectedAccounts[0]?.id].filter(Boolean)) : new Set(connectedAccounts.map(a => a.id)));
                    }}
                    className="text-xs text-amber-500 font-medium hover:text-amber-400"
                  >
                    {connectedAccounts.every(a => selectedAccountIds.has(a.id)) ? "Deselect All" : "Select All"}
                  </button>
                </div>

                {Object.entries(accountsByPlatform).map(([platform, accounts]) => {
                  const Icon = PLATFORM_ICONS[platform] || Zap;
                  const allPlatformSelected = accounts.every(a => selectedAccountIds.has(a.id));
                  const anySelected = accounts.some(a => selectedAccountIds.has(a.id));

                  return (
                    <div key={platform} className="space-y-1.5">
                      {/* Platform header with toggle all */}
                      <button
                        onClick={() => togglePlatform(platform)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium capitalize transition-all ${
                          anySelected ? PLATFORM_COLORS[platform] || "border-amber-400 bg-amber-400/10 text-amber-500" : "border-border text-muted-foreground hover:border-foreground/20"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {platform}
                        <span className="text-xs opacity-60 ml-1">({accounts.length})</span>
                        <div className="ml-auto">
                          {allPlatformSelected
                            ? <CheckCircle2 className="w-4 h-4" />
                            : anySelected
                            ? <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-current" /></div>
                            : <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                          }
                        </div>
                      </button>

                      {/* Individual accounts (show if >1 account) */}
                      {accounts.length > 1 && (
                        <div className="pl-3 space-y-1">
                          {accounts.map(acc => {
                            const selected = selectedAccountIds.has(acc.id);
                            return (
                              <button key={acc.id} onClick={() => toggleAccount(acc.id)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
                                  selected ? "bg-muted/50 text-foreground" : "text-muted-foreground hover:bg-muted/30"
                                }`}
                              >
                                <div className="w-6 h-6 rounded-full bg-muted overflow-hidden flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                  {acc.avatar_url
                                    ? <img src={acc.avatar_url} alt="" className="w-full h-full object-cover" />
                                    : (acc.platform_username || "?")[0]?.toUpperCase()
                                  }
                                </div>
                                <span className="font-medium truncate">@{acc.platform_username}</span>
                                <div className="ml-auto">
                                  {selected ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {selectedAccounts.length > 1 && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Post will be published to {selectedAccounts.length} accounts simultaneously
                  </p>
                )}
              </div>

              {/* Content type */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Content type</p>
                <div className="flex gap-2 flex-wrap">
                  {availableTypes.map(t => (
                    <button key={t.key} onClick={() => setContentType(t.key)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border
                        ${contentType === t.key ? "border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400" : "border-border text-muted-foreground hover:border-foreground/20"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Media upload */}
              <MediaUpload 
                mediaUrl={mediaUrl} 
                onUploaded={setMediaUrl} 
                onClear={() => setMediaUrl("")} 
                accept={
                  contentType === "reel" ? "video/mp4,video/quicktime" :
                  contentType === "post" || contentType === "carousel" ? "image/jpeg,image/png,image/webp,image/gif" :
                  undefined
                }
                acceptLabel={
                  contentType === "reel" ? "MP4, MOV (Video Only)" :
                  contentType === "post" || contentType === "carousel" ? "JPG, PNG, WebP (Image Only)" :
                  undefined
                }
              />

              {/* Trending Audio (for Reels only) */}
              {isReel && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Music className="w-4 h-4 text-violet-400" /> Trending Audio
                    <span className="text-xs text-muted-foreground">(for Reels)</span>
                  </p>
                  <div className="relative">
                    <input
                      value={audioName}
                      onChange={e => setAudioName(e.target.value)}
                      onFocus={() => setShowAudioPicker(true)}
                      placeholder="Search or type audio name..."
                      className="w-full px-4 py-2.5 pl-9 rounded-xl border border-border text-sm bg-background focus:outline-none focus:border-violet-400/50 transition"
                    />
                    <Music className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    {audioName && (
                      <button onClick={() => setAudioName("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {showAudioPicker && (
                    <div className="flex gap-1.5 flex-wrap">
                      {TRENDING_AUDIOS.filter(a => !audioName || a.toLowerCase().includes(audioName.toLowerCase())).map(audio => (
                        <button key={audio} onClick={() => { setAudioName(audio); setShowAudioPicker(false); }}
                          className="text-xs px-2.5 py-1 rounded-full bg-violet-400/10 text-violet-400 border border-violet-400/20 hover:bg-violet-400/20 transition">
                          🎵 {audio}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Note: Audio is added as metadata. Instagram may use it if the audio is available in their library.
                  </p>
                </div>
              )}

              {/* Caption */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Caption</p>
                  <span className="text-xs text-muted-foreground">{caption.length}/2200</span>
                </div>
                <textarea
                  value={caption} onChange={e => setCaption(e.target.value)}
                  rows={4} maxLength={2200}
                  placeholder={"Yaar, yeh ek cheez hai jo main chahta tha... 👇\n\n#ContentCreator #Viral"}
                  className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none focus:border-amber-500/50 transition"
                />
              </div>

              {/* Per-platform caption overrides */}
              {selectedPlatforms.size > 1 && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowPlatformCaptions(!showPlatformCaptions)}
                    className="flex items-center gap-2 text-xs text-violet-500 font-medium hover:text-violet-400 transition"
                  >
                    {showPlatformCaptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Customize caption per platform
                  </button>

                  {showPlatformCaptions && (
                    <div className="space-y-3 pl-1">
                      {Array.from(selectedPlatforms).map(platform => {
                        const Icon = PLATFORM_ICONS[platform] || Zap;
                        return (
                          <div key={platform} className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground capitalize">
                              <Icon className="w-3 h-3" /> {platform} caption
                              <span className="text-[10px] opacity-50">(leave empty = use main caption)</span>
                            </div>
                            <textarea
                              value={platformCaptions[platform] || ""}
                              onChange={e => setPlatformCaptions(prev => ({ ...prev, [platform]: e.target.value }))}
                              rows={2}
                              maxLength={2200}
                              placeholder={caption || `Caption for ${platform}...`}
                              className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-background focus:outline-none resize-none focus:border-violet-400/50 transition"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* First comment (Instagram only) */}
              {hasIG && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-muted-foreground">
                    First comment <span className="text-xs">(hashtags here — best practice)</span>
                  </p>
                  <input value={firstComment} onChange={e => setFirstComment(e.target.value)}
                    placeholder="#ContentCreator #UGCIndia #InstagramReels"
                    className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50 transition" />
                </div>
              )}

              <button onClick={() => setStep(2)} disabled={!caption.trim()}
                className="w-full py-3 rounded-xl btn-amber text-sm font-bold disabled:opacity-40">
                Next: Schedule & Options →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              {/* Schedule date */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" /> Schedule date & time (IST)
                </p>
                <input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50 transition" />
                <div className="flex gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground self-center">Best times:</span>
                  {[
                    { label: "Today 7PM", daysAdd: 0, hour: 19 },
                    { label: "Tomorrow 12PM", daysAdd: 1, hour: 12 },
                    { label: "Sat 8PM", daysAdd: ((6 - new Date().getDay() + 7) % 7) || 7, hour: 20 },
                    { label: "Sun 9PM", daysAdd: ((0 - new Date().getDay() + 7) % 7) || 7, hour: 21 },
                  ].map(t => (
                    <button key={t.label} onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + t.daysAdd);
                      d.setHours(t.hour, 0, 0, 0);
                      setScheduledDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                    }}
                      className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-600 dark:text-amber-400 hover:bg-amber-400/20 transition border border-amber-400/20">
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* DM Automation */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Bot className="w-4 h-4 text-violet-400" /> Attach DM Automation
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  When someone comments on this post, auto-DM them using the selected automation rule.
                </p>
                <select value={dmAutomationId} onChange={e => setDmAutomationId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:border-violet-400/50 transition">
                  <option value="">No automation</option>
                  {automationRules.map(rule => (
                    <option key={rule.id} value={rule.id}>
                      {rule.name} ({rule.type})
                    </option>
                  ))}
                </select>
                {dmAutomationId && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-400/8 border border-violet-400/20">
                    <Bot className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-xs text-violet-400">
                      Comments on this post will trigger the selected DM automation
                    </span>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Summary</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {Array.from(selectedPlatforms).map((p: string) => (
                    <span key={p} className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${PLATFORM_COLORS[p] || ''}`}>
                      {p}
                    </span>
                  ))}
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground capitalize">{contentType}</span>
                  {audioName && <span className="text-xs text-violet-400">🎵 {audioName}</span>}
                  {dmAutomationId && <span className="text-xs text-violet-400">🤖 Auto-DM</span>}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{caption.substring(0, 100)}...</p>
              </div>

              {/* Error */}
              {pubError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400 leading-relaxed">{pubError}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2 pb-1">
                <button onClick={handlePublishNow} disabled={publishing || !caption.trim()}
                  className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-all
                    bg-gradient-to-r from-amber-400 to-orange-400 text-black hover:from-amber-500 hover:to-orange-500 active:scale-[0.98]">
                  {publishing
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing to {selectedAccounts.length} account{selectedAccounts.length !== 1 ? 's' : ''}...</>
                    : <><Zap className="w-4 h-4" /> Publish Now {selectedAccounts.length > 1 ? `(${selectedAccounts.length} Accounts)` : ""}</>}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setStep(1)}
                    className="py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/60 transition">
                    ← Back
                  </button>
                  <button onClick={handleSchedule} disabled={saving || !caption.trim() || !scheduledDate}
                    className="py-2.5 rounded-xl border border-amber-400/40 bg-amber-400/8 text-amber-600 dark:text-amber-400 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-1.5 hover:bg-amber-400/15 transition">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Schedule</>}
                  </button>
                </div>
                <button onClick={handleDraft} disabled={saving || !caption.trim()}
                  className="w-full py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition text-center">
                  Save as Draft
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── History Tab Content ───────────────────────────────────────────
function PostHistoryTab({ posts, onRetry, onDelete, retryingId, deletingId }: {
  posts: ScheduledPost[];
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  retryingId: string | null;
  deletingId: string | null;
}) {
  const [filter, setFilter] = useState<"all" | PostStatus>("all");
  const [platformFilter, setPlatformFilter] = useState<"all" | "instagram" | "facebook">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = posts.filter(p => {
    if (filter !== "all" && p.status !== filter) return false;
    if (platformFilter !== "all" && p.platform !== platformFilter) return false;
    if (searchQuery && !p.caption.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const counts = {
    all: posts.length,
    scheduled: posts.filter(p => p.status === "scheduled").length,
    published: posts.filter(p => p.status === "published").length,
    draft: posts.filter(p => p.status === "draft").length,
    failed: posts.filter(p => p.status === "failed").length,
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50">
          {(["all", "scheduled", "published", "draft", "failed"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
                filter === f ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {f} {counts[f] > 0 && <span className="ml-1 opacity-60">({counts[f]})</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50">
          {(["all", "instagram", "facebook"] as const).map(p => (
            <button key={p} onClick={() => setPlatformFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
                platformFilter === p ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {p === "all" ? "All" : p === "instagram" ? "📸 IG" : "📘 FB"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search posts..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border text-xs bg-background focus:outline-none" />
        </div>
      </div>

      {/* Post list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl">
          <History className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No posts found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(post => {
            const PIcon = post.platform === "instagram" ? Camera : Share2;
            const s = STATUS_CFG[post.status];
            const dt = new Date(post.scheduled_at);
            const publishedDt = post.published_at ? new Date(post.published_at) : null;

            return (
              <div key={post.id} className="p-4 rounded-xl border border-border bg-card hover:border-foreground/10 transition group">
                <div className="flex items-start gap-3">
                  {/* Platform icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${PLATFORM_COLORS[post.platform]}`}>
                    <PIcon className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold capitalize">{post.platform}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground capitalize">{post.content_type}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${s.badge}`}>
                        {s.label}
                      </span>
                      {post.audio_name && (
                        <span className="text-[10px] text-violet-400 flex items-center gap-0.5">
                          <Music className="w-2.5 h-2.5" /> {post.audio_name}
                        </span>
                      )}
                    </div>

                    {/* Media preview */}
                    {post.media_url && (
                      <div className="w-16 h-12 rounded-lg overflow-hidden bg-muted/30">
                        {/\.(mp4|mov)$/i.test(post.media_url)
                          ? <video src={post.media_url} className="w-full h-full object-cover" />
                          : <img src={post.media_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground line-clamp-2">{post.caption}</p>

                    {/* Dates */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.status === "published" ? "Published" : "Scheduled"}: {dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} {dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {publishedDt && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Published: {publishedDt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>

                    {/* Error message */}
                    {post.error_message && (
                      <p className="text-[10px] text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {post.error_message}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                    {(post.status === "scheduled" || post.status === "draft" || post.status === "failed") && (
                      <button onClick={() => onRetry(post.id)} disabled={retryingId === post.id}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-bold disabled:opacity-50 flex items-center gap-1 hover:bg-amber-500 transition">
                        {retryingId === post.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        {post.status === "failed" ? "Retry" : "Publish"}
                      </button>
                    )}
                    <button onClick={() => onDelete(post.id)} disabled={deletingId === post.id}
                      className="p-1.5 rounded-lg border border-border hover:text-red-500 hover:border-red-500/30 transition">
                      {deletingId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Scheduler ────────────────────────────────────────────────
export default function SchedulerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") || "instagram";
  const now = new Date();
  const [viewYear, setViewYear]   = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [posts, setPosts]         = useState<ScheduledPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"calendar" | "history">("calendar");
  const [automationRules, setAutomationRules] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<Array<{ id: string; platform: string; platform_username: string; avatar_url?: string }>>([]);;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [postsRes, rulesRes, accountsRes] = await Promise.all([
        fetch("/api/automation/schedule"),
        fetch("/api/automation/rules"),
        fetch("/api/connect/accounts"),
      ]);
      if (postsRes.ok) { const j = await postsRes.json(); setPosts(j.posts || []); }
      if (rulesRes.ok) { const j = await rulesRes.json(); setAutomationRules((j.rules || []).map((r: any) => ({ id: r.id, name: r.name, type: r.type }))); }
      if (accountsRes.ok) { const j = await accountsRes.json(); setConnectedAccounts((j.accounts || []).map((a: any) => ({ id: a.id, platform: a.platform, platform_username: a.platform_username, avatar_url: a.avatar_url }))); }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (post: any) => {
    await fetch("/api/automation/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    });
    await load();
  };

  const publishNow = async (post: any) => {
    const res = await fetch("/api/automation/schedule/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.retryAfterHours
        ? `${data.error} (retry after ${data.retryAfterHours}h)`
        : (data.error || "Publish failed");
      throw new Error(msg);
    }
    await load();
  };

  const publishById = async (id: string) => {
    setPublishingId(id);
    await fetch("/api/automation/schedule/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: id }),
    });
    await load();
    setPublishingId(null);
  };

  const deletePost = async (id: string) => {
    setDeletingId(id);
    await fetch("/api/automation/schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
    setDeletingId(null);
  };

  const prev = () => { setViewMonth(m => { if (m===0){setViewYear(y=>y-1);return 11;} return m-1; }); };
  const next = () => { setViewMonth(m => { if (m===11){setViewYear(y=>y+1);return 0;} return m+1; }); };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay    = getFirstDay(viewYear, viewMonth);
  const dayPosts = (d: number) => posts.filter(p => {
    const dt = new Date(p.scheduled_at);
    return dt.getFullYear()===viewYear && dt.getMonth()===viewMonth && dt.getDate()===d;
  });

  const scheduled  = posts.filter(p => p.status === "scheduled");
  const drafts     = posts.filter(p => p.status === "draft");
  const published  = posts.filter(p => p.status === "published");
  const failed     = posts.filter(p => p.status === "failed");
  const upcoming   = scheduled
    .filter(p => new Date(p.scheduled_at) >= now)
    .sort((a,b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  return (
    <div className="p-6 max-w-6xl mx-auto pb-16 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-500" /> Post Scheduler
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Instagram & Facebook — schedule, publish, and track all your content
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl border border-border hover:bg-muted/60 transition" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={async () => {
              // Find the latest analysis from localStorage
              const keys = Object.keys(localStorage).filter(k => k.startsWith("analysis_"));
              if (keys.length === 0) {
                alert("No pipeline content found. Run Analysis first from the Analyze page.");
                return;
              }
              const latestKey = keys.sort().pop()!;
              try {
                const analysis = JSON.parse(localStorage.getItem(latestKey) || "{}");
                const pipeline = analysis.pipeline;
                if (!pipeline?.contentCalendar?.length) {
                  alert("No content calendar found in your latest analysis. Run the Pipeline phase first.");
                  return;
                }
                const confirm = window.confirm(
                  `Import ${pipeline.contentCalendar.reduce((s: number, w: any) => s + (w.posts?.length || 0), 0)} posts from your AI-generated pipeline? They will be added as drafts.`
                );
                if (!confirm) return;

                let imported = 0;
                const startDate = new Date();
                startDate.setHours(19, 0, 0, 0); // 7 PM default

                for (const week of pipeline.contentCalendar) {
                  for (const post of (week.posts || [])) {
                    const scheduledAt = new Date(startDate);
                    scheduledAt.setDate(scheduledAt.getDate() + imported);

                    await fetch("/api/automation/schedule", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        platform: "instagram",
                        content_type: post.format?.toLowerCase().includes("reel") ? "reel" 
                          : post.format?.toLowerCase().includes("carousel") ? "carousel" 
                          : "photo",
                        caption: post.caption || `${post.hook}\n\n${post.topic}`,
                        scheduled_at: scheduledAt.toISOString(),
                        status: "draft",
                        audio_name: post.music_suggestion || undefined,
                      }),
                    });
                    imported++;
                  }
                }
                alert(`✅ ${imported} posts imported as drafts! Review and schedule them.`);
                await load();
              } catch (err) {
                alert("Failed to import pipeline. Try running Analysis again.");
              }
            }}
            className="px-3 py-2.5 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-400 text-sm font-medium hover:bg-violet-500/20 transition flex items-center gap-2"
            title="Import posts from your AI-generated content pipeline"
          >
            <Bot className="w-4 h-4" /> Import Pipeline
          </button>
          <button
            onClick={() => router.push(`/automation/schedule-v2?platform=${platform}`)}
            className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Post
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Scheduled", val: scheduled.length, color: "text-amber-500", icon: Clock },
          { label: "Drafts",    val: drafts.length,    color: "text-muted-foreground", icon: Copy },
          { label: "Published", val: published.length, color: "text-green-500", icon: CheckCircle2 },
          { label: "Failed",    val: failed.length,    color: failed.length > 0 ? "text-red-500" : "text-muted-foreground", icon: AlertCircle },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-border bg-card text-center group hover:border-foreground/10 transition">
            <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color} group-hover:scale-110 transition-transform`} />
            <p className={`font-heading text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs: Calendar / History */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 w-fit">
        {([
          { key: "calendar", label: "📅 Calendar", icon: Calendar },
          { key: "history", label: "📋 Post History", icon: History },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {tab.label}
            {tab.key === "history" && posts.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-400 text-[10px] font-bold">
                {posts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500/50" />
        </div>
      ) : activeTab === "history" ? (
        <PostHistoryTab posts={posts} onRetry={publishById} onDelete={deletePost} retryingId={publishingId} deletingId={deletingId} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <button onClick={prev} className="p-1.5 rounded-lg hover:bg-muted/60"><ChevronLeft className="w-4 h-4" /></button>
              <h2 className="font-heading font-semibold">{FULL_MONTHS[viewMonth]} {viewYear}</h2>
              <button onClick={next} className="p-1.5 rounded-lg hover:bg-muted/60"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-7 border-b border-border">
              {DAYS.map(d => <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) =>
                <div key={`e-${i}`} className="h-20 border-b border-r border-border/40 bg-muted/10" />
              )}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dp  = dayPosts(day);
                const isToday = day===now.getDate() && viewMonth===now.getMonth() && viewYear===now.getFullYear();
                return (
                  <div key={day}
                    onClick={() => { 
                      const d = new Date(viewYear, viewMonth, day);
                      router.push(`/automation/schedule-v2?platform=${platform}&date=${d.toISOString()}`);
                    }}
                    className="h-20 border-b border-r border-border/40 p-1.5 cursor-pointer hover:bg-muted/20 transition-colors"
                  >
                    <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-medium mb-1 ${isToday ? "bg-amber-400 text-black" : "text-muted-foreground"}`}>
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {dp.slice(0,2).map(p => (
                        <div key={p.id} className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium truncate ${PLATFORM_COLORS[p.platform] || ""}`}>
                          <span className={`w-1 h-1 rounded-full ${STATUS_CFG[p.status].dot}`} />
                          <span className="truncate">{p.content_type}</span>
                        </div>
                      ))}
                      {dp.length > 2 && <p className="text-[9px] text-muted-foreground">+{dp.length-2}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Queue sidebar */}
          <div className="space-y-4 overflow-y-auto max-h-[650px] pr-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Upcoming</h3>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{upcoming.length}</span>
            </div>

            {upcoming.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
                <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No posts scheduled</p>
                <button onClick={() => setShowModal(true)} className="text-xs text-amber-500 mt-1 hover:underline">
                  + Schedule now
                </button>
              </div>
            ) : upcoming.map(post => {
              const PIcon = post.platform === "instagram" ? Camera : Share2;
              const d = new Date(post.scheduled_at);
              const s = STATUS_CFG[post.status];
              return (
                <div key={post.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${PLATFORM_COLORS[post.platform]}`}>
                      <PIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold capitalize">{post.platform} · {post.content_type}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {d.getDate()} {MONTHS[d.getMonth()]} · {d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-medium">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>

                  {post.media_url && (
                    <div className="w-full h-14 rounded-lg overflow-hidden bg-muted/30">
                      {/\.(mp4|mov)$/i.test(post.media_url)
                        ? <video src={post.media_url} className="w-full h-full object-cover" />
                        : <img src={post.media_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground line-clamp-2">{post.caption}</p>

                  {post.audio_name && (
                    <p className="text-[10px] text-violet-400 flex items-center gap-1">
                      <Music className="w-3 h-3" /> {post.audio_name}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => publishById(post.id)} disabled={publishingId === post.id}
                      className="flex-1 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-bold hover:bg-amber-500 transition disabled:opacity-50 flex items-center justify-center gap-1">
                      {publishingId === post.id
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Publishing...</>
                        : <><Zap className="w-3 h-3" /> Publish Now</>}
                    </button>
                    <button onClick={() => deletePost(post.id)} disabled={deletingId === post.id}
                      className="px-2.5 py-1.5 rounded-lg border border-border hover:text-red-500 hover:border-red-500/30 transition">
                      {deletingId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Drafts */}
            {drafts.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Drafts ({drafts.length})</h3>
                {drafts.map(p => (
                  <div key={p.id} className="p-3 rounded-xl border border-dashed border-border bg-muted/10 flex items-center gap-2">
                    <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${PLATFORM_COLORS[p.platform]}`}>
                      {p.platform === "instagram" ? "📸" : "📘"}
                    </div>
                    <p className="text-xs flex-1 truncate text-muted-foreground">{p.caption.slice(0,60)}</p>
                    <button onClick={() => publishById(p.id)} disabled={publishingId===p.id}
                      className="text-[10px] text-amber-500 font-bold hover:underline">Publish</button>
                    <button onClick={() => deletePost(p.id)} className="text-muted-foreground/50 hover:text-red-500 flex-shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Published summary */}
            {published.length > 0 && (
              <button onClick={() => setActiveTab("history")}
                className="w-full p-3 rounded-xl border border-green-500/20 bg-green-500/5 hover:bg-green-500/10 transition text-left">
                <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {published.length} posts published
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Click to view full history →</p>
              </button>
            )}

            {/* Failed */}
            {failed.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-xs text-red-500 uppercase tracking-wider">Failed ({failed.length})</h3>
                {failed.map(p => (
                  <div key={p.id} className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.caption}</p>
                    {p.error_message && <p className="text-[10px] text-red-400">{p.error_message}</p>}
                    <div className="flex gap-1.5">
                      <button onClick={() => publishById(p.id)} disabled={publishingId===p.id}
                        className="flex-1 py-1 rounded-lg bg-amber-400 text-black text-xs font-bold disabled:opacity-50">
                        {publishingId===p.id ? "Retrying..." : "Retry"}
                      </button>
                      <button onClick={() => deletePost(p.id)}
                        className="px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-red-500">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <PostModal
          onClose={() => setShowModal(false)}
          onSave={save}
          onPublishNow={publishNow}
          defaultDate={selectedDate}
          automationRules={automationRules}
          connectedAccounts={connectedAccounts}
        />
      )}
    </div>
  );
}
