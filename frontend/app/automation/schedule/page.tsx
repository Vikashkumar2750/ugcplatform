"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Clock, Camera,
  Share2, Trash2, X, RefreshCw, Loader2, Upload, CheckCircle2,
  AlertCircle, Zap, Send
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
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "text-pink-500 bg-pink-500/10",
  facebook:  "text-blue-500 bg-blue-500/10",
};

const STATUS_CFG: Record<PostStatus, { label: string; dot: string }> = {
  draft:      { label: "Draft",      dot: "bg-muted-foreground" },
  scheduled:  { label: "Scheduled",  dot: "bg-amber-500" },
  publishing: { label: "Publishing", dot: "bg-blue-500 animate-pulse" },
  published:  { label: "Published",  dot: "bg-green-500" },
  failed:     { label: "Failed",     dot: "bg-red-500" },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

// ── Media Upload (uses upload API, no supabase client) ────────────
function MediaUpload({ mediaUrl, onUploaded, onClear }: {
  mediaUrl: string;
  onUploaded: (url: string) => void;
  onClear: () => void;
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
      const res = await fetch("/api/automation/schedule/upload", {
        method: "POST",
        body: formData,
      });
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
            ? <video src={mediaUrl} className="w-full max-h-44 object-cover" controls />
            : <img src={mediaUrl} alt="preview" className="w-full max-h-44 object-cover" />}
          <button onClick={onClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">Media</label>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) upload(f);
        }}
        className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/2 transition-colors"
      >
        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="w-7 h-7 mx-auto animate-spin text-amber-500" />
            <p className="text-sm text-muted-foreground">Uploading... {progress}%</p>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div className="h-full bg-amber-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <>
            <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm font-medium">Click to upload or drag & drop</p>
            <p className="text-xs text-muted-foreground mt-1">
              Images: JPG, PNG, WebP (max 20MB) &nbsp;·&nbsp; Videos: MP4, MOV (max 100MB)
            </p>
          </>
        )}
      </div>
      {uploadError && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{uploadError}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }}
      />
    </div>
  );
}

// ── Post Modal ────────────────────────────────────────────────────
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

function PostModal({ onClose, onSave, onPublishNow, defaultDate }: {
  onClose: () => void;
  onSave: (p: any) => Promise<void>;
  onPublishNow: (p: any) => Promise<void>;
  defaultDate?: Date;
}) {
  const [platform, setPlatform]           = useState<"instagram" | "facebook">("instagram");
  const [contentType, setContentType]     = useState<ContentTypeKey>("reel");
  const [caption, setCaption]             = useState("");
  const [firstComment, setFirstComment]   = useState("");
  const [mediaUrl, setMediaUrl]           = useState("");
  const [scheduledDate, setScheduledDate] = useState(() => {
    if (!defaultDate) return "";
    const d = new Date(defaultDate);
    d.setHours(19, 0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [saving, setSaving]       = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pubError, setPubError]   = useState("");

  const types = platform === "instagram" ? IG_TYPES : FB_TYPES;

  const makePayload = () => ({
    platform,
    content_type: contentType,
    caption,
    first_comment: firstComment || undefined,
    media_url: mediaUrl || undefined,
  });

  const handleSchedule = async () => {
    if (!caption.trim() || !scheduledDate) return;
    setSaving(true);
    await onSave({ ...makePayload(), scheduled_at: new Date(scheduledDate).toISOString(), status: "scheduled" });
    setSaving(false);
    onClose();
  };

  const handleDraft = async () => {
    if (!caption.trim()) return;
    setSaving(true);
    await onSave({ ...makePayload(), scheduled_at: new Date(Date.now() + 3600000).toISOString(), status: "draft" });
    setSaving(false);
    onClose();
  };

  const handlePublishNow = async () => {
    if (!caption.trim()) return;
    setPublishing(true); setPubError("");
    try {
      await onPublishNow(makePayload());
      onClose();
    } catch (err: any) {
      setPubError(err.message || "Publish failed — check Meta permissions");
    }
    setPublishing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border w-full max-w-lg max-h-[94vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-heading font-bold text-lg">New Post</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Platform */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Platform</p>
            <div className="grid grid-cols-2 gap-2">
              {(["instagram", "facebook"] as const).map(p => {
                const Icon = p === "instagram" ? Camera : Share2;
                const active = platform === p;
                return (
                  <button key={p} onClick={() => { setPlatform(p); setContentType(p === "instagram" ? "reel" : "post"); }}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium capitalize transition-all
                      ${active ? "border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400" : "border-border text-muted-foreground hover:border-foreground/20"}`}>
                    <Icon className="w-4 h-4" />{p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content type */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Content type</p>
            <div className="flex gap-2 flex-wrap">
              {types.map(t => (
                <button key={t.key} onClick={() => setContentType(t.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border
                    ${contentType === t.key ? "border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400" : "border-border text-muted-foreground hover:border-foreground/20"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Media upload */}
          <MediaUpload mediaUrl={mediaUrl} onUploaded={setMediaUrl} onClear={() => setMediaUrl("")} />

          {/* Caption */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Caption</p>
              <span className="text-xs text-muted-foreground">{caption.length}/2200</span>
            </div>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={4}
              maxLength={2200}
              placeholder={platform === "instagram"
                ? "Yaar, yeh ek cheez hai jo main chahta tha ki mujhe 2 saal pehle koi batata... 👇\n\n#ContentCreator"
                : "Aaj kuch share kar raha hoon..."}
              className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none focus:border-amber-500/50 transition"
            />
          </div>

          {/* First comment (Instagram only) */}
          {platform === "instagram" && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-muted-foreground">
                First comment <span className="text-xs">(put hashtags here — best practice)</span>
              </p>
              <input
                value={firstComment}
                onChange={e => setFirstComment(e.target.value)}
                placeholder="#ContentCreator #UGCIndia #InstagramReels #IndianCreator"
                className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50 transition"
              />
            </div>
          )}

          {/* Schedule date */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Schedule date & time (IST)</p>
            <input
              type="datetime-local"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50 transition"
            />
            <div className="flex gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground self-center">Best times:</span>
              {[
                { label: "Today 7PM", daysAdd: 0, hour: 19 },
                { label: "Mon 7PM",   daysAdd: ((8 - new Date().getDay()) % 7) || 7, hour: 19 },
                { label: "Wed 8PM",   daysAdd: ((10 - new Date().getDay()) % 7) || 7, hour: 20 },
                { label: "Fri 9PM",   daysAdd: ((12 - new Date().getDay()) % 7) || 7, hour: 21 },
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

          {/* Error */}
          {pubError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 leading-relaxed">{pubError}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pb-1">
            <button
              onClick={handlePublishNow}
              disabled={publishing || !caption.trim()}
              className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-all
                bg-gradient-to-r from-amber-400 to-orange-400 text-black hover:from-amber-500 hover:to-orange-500 active:scale-[0.98]"
            >
              {publishing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing to {platform}...</>
                : <><Zap className="w-4 h-4" /> Publish Now</>}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleDraft} disabled={saving || !caption.trim()}
                className="py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/60 disabled:opacity-40 transition">
                Save as Draft
              </button>
              <button onClick={handleSchedule} disabled={saving || !caption.trim() || !scheduledDate}
                className="py-2.5 rounded-xl border border-amber-400/40 bg-amber-400/8 text-amber-600 dark:text-amber-400 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-1.5 hover:bg-amber-400/15 transition">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Schedule</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Scheduler ────────────────────────────────────────────────
export default function SchedulerPage() {
  const now = new Date();
  const [viewYear, setViewYear]   = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [posts, setPosts]         = useState<ScheduledPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/automation/schedule");
    if (res.ok) { const j = await res.json(); setPosts(j.posts || []); }
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
            Instagram & Facebook — auto-publish via cron every 5 minutes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl border border-border hover:bg-muted/60 transition" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => { setSelectedDate(undefined); setShowModal(true); }}
            className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Post
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Scheduled", val: scheduled.length,  color: "text-amber-500" },
          { label: "Drafts",    val: drafts.length,     color: "text-muted-foreground" },
          { label: "Published", val: published.length,  color: "text-green-500" },
          { label: "Failed",    val: failed.length,     color: failed.length > 0 ? "text-red-500" : "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-border bg-card text-center">
            <p className={`font-heading text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500/50" />
        </div>
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
                    onClick={() => { setSelectedDate(new Date(viewYear, viewMonth, day)); setShowModal(true); }}
                    className="h-20 border-b border-r border-border/40 p-1.5 cursor-pointer hover:bg-muted/20 transition-colors"
                  >
                    <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-medium mb-1 ${isToday ? "bg-amber-400 text-black" : "text-muted-foreground"}`}>
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {dp.slice(0,2).map(p => (
                        <div key={p.id} className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium truncate ${PLATFORM_COLORS[p.platform] || ""}`}>
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
            {/* Upcoming */}
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

                  <div className="flex gap-2">
                    <button
                      onClick={() => publishById(post.id)}
                      disabled={publishingId === post.id}
                      className="flex-1 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-bold hover:bg-amber-500 transition disabled:opacity-50 flex items-center justify-center gap-1"
                    >
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
                    <p className="text-xs flex-1 truncate text-muted-foreground">{p.caption.slice(0,70)}</p>
                    <button onClick={() => deletePost(p.id)} className="text-muted-foreground/50 hover:text-red-500 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
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

            {/* Published */}
            {published.length > 0 && (
              <div className="p-3 rounded-xl border border-green-500/20 bg-green-500/5">
                <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {published.length} posts published successfully
                </p>
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
        />
      )}
    </div>
  );
}
