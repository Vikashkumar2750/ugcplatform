"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Clock, Camera,
  Share2, Trash2, X, RefreshCw, Loader2, Upload, CheckCircle2,
  AlertCircle, Zap, Image, Video, FileText, Eye, Send
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

const PLATFORM_ICONS  = { instagram: Camera, facebook: Share2 };
const PLATFORM_COLORS = { instagram: "text-pink-500 bg-pink-500/10 border-pink-500/20", facebook: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
const STATUS_META: Record<PostStatus, { label: string; color: string; icon: any }> = {
  draft:      { label: "Draft",      color: "text-muted-foreground bg-muted/60",        icon: FileText },
  scheduled:  { label: "Scheduled",  color: "text-amber-600 bg-amber-500/10",           icon: Clock },
  publishing: { label: "Publishing", color: "text-blue-500 bg-blue-500/10 animate-pulse",icon: Loader2 },
  published:  { label: "Published",  color: "text-green-500 bg-green-500/10",           icon: CheckCircle2 },
  failed:     { label: "Failed",     color: "text-red-500 bg-red-500/10",               icon: AlertCircle },
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

// ── Upload + Preview ──────────────────────────────────────────────
function MediaUpload({ onUpload, mediaUrl, onClear }: {
  onUpload: (url: string) => void;
  mediaUrl?: string;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const supabase = createClient();

  const handleFile = async (file: File) => {
    if (!file) return;
    const maxMB = file.type.startsWith("video") ? 100 : 20;
    if (file.size > maxMB * 1024 * 1024) { setError(`Max size: ${maxMB}MB`); return; }

    setUploading(true); setError(""); setProgress(10);
    const ext  = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error: upErr } = await supabase.storage
      .from("post-media")
      .upload(path, file, { contentType: file.type, upsert: false });

    setProgress(90);
    if (upErr) { setError(upErr.message); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from("post-media").getPublicUrl(data.path);
    setProgress(100);
    setTimeout(() => { setUploading(false); setProgress(0); onUpload(publicUrl); }, 400);
  };

  const isVideo = mediaUrl && /\.(mp4|mov)$/i.test(mediaUrl);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Media</label>
      {mediaUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30">
          {isVideo
            ? <video src={mediaUrl} className="w-full max-h-48 object-cover" controls />
            : <img src={mediaUrl} alt="" className="w-full max-h-48 object-cover" />}
          <button onClick={onClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 px-3 pb-2">
            <p className="text-[10px] text-white/80 truncate">{mediaUrl.split("/").pop()}</p>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-amber-500/40 hover:bg-amber-500/2 transition-colors">
          {uploading ? (
            <div className="space-y-2">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-500" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-amber-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Click or drag & drop</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                <Image className="w-3 h-3 inline mr-1" />JPG, PNG, WebP (20MB)
                &nbsp;·&nbsp;
                <Video className="w-3 h-3 inline mr-1" />MP4, MOV (100MB)
              </p>
            </>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*,video/mp4,video/quicktime" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// ── New Post Modal ────────────────────────────────────────────────
function NewPostModal({ onClose, onSave, onPublishNow, defaultDate }: {
  onClose: () => void;
  onSave: (post: any) => Promise<void>;
  onPublishNow: (post: any) => Promise<void>;
  defaultDate?: Date;
}) {
  const [platform, setPlatform] = useState<"instagram" | "facebook">("instagram");
  const [contentType, setContentType] = useState("reel");
  const [caption, setCaption] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduledDate, setScheduledDate] = useState(
    defaultDate
      ? new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");

  const contentTypes: Record<string, { key: string; label: string; icon: any; needsMedia: boolean }[]> = {
    instagram: [
      { key: "reel",     label: "Reel",     icon: Video,    needsMedia: true },
      { key: "post",     label: "Post",     icon: Image,    needsMedia: true },
      { key: "story",    label: "Story",    icon: Eye,      needsMedia: true },
      { key: "carousel", label: "Carousel", icon: FileText, needsMedia: true },
    ],
    facebook: [
      { key: "post",  label: "Post",  icon: FileText, needsMedia: false },
      { key: "reel",  label: "Reel",  icon: Video,    needsMedia: true },
      { key: "story", label: "Story", icon: Eye,      needsMedia: true },
    ],
  };

  const selectedType = contentTypes[platform].find(t => t.key === contentType);

  const handleSave = async (draft = false) => {
    if (!caption.trim()) return;
    setSaving(true);
    await onSave({
      platform, content_type: contentType, caption, first_comment: firstComment || undefined,
      media_url: mediaUrl || undefined,
      scheduled_at: scheduledDate ? new Date(scheduledDate).toISOString() : new Date(Date.now() + 3600000).toISOString(),
      status: draft ? "draft" : "scheduled",
    });
    setSaving(false);
    onClose();
  };

  const handlePublishNow = async () => {
    if (!caption.trim()) return;
    setPublishing(true); setPublishError("");
    try {
      await onPublishNow({
        platform, content_type: contentType, caption, first_comment: firstComment || undefined,
        media_url: mediaUrl || undefined,
      });
      onClose();
    } catch (err: any) {
      setPublishError(err.message || "Publish failed");
    }
    setPublishing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg">New Post</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        {/* Platform */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Platform</label>
          <div className="grid grid-cols-2 gap-2">
            {(["instagram", "facebook"] as const).map(p => {
              const Icon = PLATFORM_ICONS[p];
              return (
                <button key={p} onClick={() => { setPlatform(p); setContentType(contentTypes[p][0].key); }}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-center gap-2 text-sm font-medium capitalize
                    ${platform === p ? "border-amber-400/60 bg-amber-400/8 text-amber-600 dark:text-amber-400" : "border-border hover:border-foreground/20 text-muted-foreground"}`}>
                  <Icon className="w-4 h-4" />{p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Content type</label>
          <div className="grid grid-cols-4 gap-2">
            {contentTypes[platform].map(type => {
              const Icon = type.icon;
              return (
                <button key={type.key} onClick={() => setContentType(type.key)}
                  className={`py-2 px-1.5 rounded-xl border transition-all flex flex-col items-center gap-1 text-xs font-medium
                    ${contentType === type.key ? "border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400" : "border-border text-muted-foreground hover:border-foreground/20"}`}>
                  <Icon className="w-4 h-4" />{type.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Media upload */}
        <MediaUpload mediaUrl={mediaUrl} onUpload={setMediaUrl} onClear={() => setMediaUrl("")} />

        {/* Caption */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Caption</label>
            <span className="text-xs text-muted-foreground">{caption.length} chars</span>
          </div>
          <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={4}
            placeholder={platform === "instagram"
              ? "Yaar, yeh ek cheez hai jo main chahta tha ki mujhe 2 saal pehle koi batata... 👇"
              : "Aaj ka post — kuch naya share kar raha hoon..."}
            className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none focus:border-amber-500/50" />
        </div>

        {/* First comment */}
        {platform === "instagram" && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              First comment <span className="text-xs">(hashtags here — best practice)</span>
            </label>
            <input value={firstComment} onChange={e => setFirstComment(e.target.value)}
              placeholder="#ContentCreator #UGCIndia #InstagramReels #IndianCreator"
              className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50" />
          </div>
        )}

        {/* Schedule time */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Schedule date & time (IST)</label>
          <input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50" />
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "Today 7PM", hoursOffset: 0, hour: 19 },
              { label: "Mon 7PM",   hoursOffset: 1, hour: 19 },
              { label: "Wed 8PM",   hoursOffset: 3, hour: 20 },
              { label: "Fri 9PM",   hoursOffset: 5, hour: 21 },
            ].map(t => (
              <button key={t.label} onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + t.hoursOffset);
                d.setHours(t.hour, 0, 0, 0);
                setScheduledDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
              }} className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-600 dark:text-amber-400 hover:bg-amber-400/20 transition">
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {publishError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-500">{publishError}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2">
          {/* Publish Now */}
          <button onClick={handlePublishNow} disabled={publishing || !caption.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-black font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 hover:from-amber-500 hover:to-orange-500 transition">
            {publishing ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</>
              : <><Zap className="w-4 h-4" /> Publish Now</>}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleSave(true)} disabled={saving || !caption.trim()}
              className="py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/60 disabled:opacity-40">
              Save as Draft
            </button>
            <button onClick={() => handleSave(false)} disabled={saving || !caption.trim() || !scheduledDate}
              className="py-2.5 rounded-xl border border-amber-400/40 bg-amber-400/8 text-amber-600 dark:text-amber-400 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-1.5">
              <Send className="w-3.5 h-3.5" /> Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function SchedulerPage() {
  const now = new Date();
  const [viewYear, setViewYear]   = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [posts, setPosts]         = useState<ScheduledPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [publishing, setPublishing]     = useState<string | null>(null);
  const [deleting, setDeleting]         = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/automation/schedule");
    if (res.ok) { const { posts: d } = await res.json(); setPosts(d || []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleSave = async (post: any) => {
    await fetch("/api/automation/schedule", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    });
    await fetchPosts();
  };

  const handlePublishNow = async (post: any) => {
    const res = await fetch("/api/automation/schedule/publish", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Publish failed");
    await fetchPosts();
  };

  const handlePublishById = async (id: string) => {
    setPublishing(id);
    const res = await fetch("/api/automation/schedule/publish", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: id }),
    });
    await fetchPosts();
    setPublishing(null);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await fetch("/api/automation/schedule", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchPosts();
    setDeleting(null);
  };

  const prevMonth = () => { if (viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1); };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay    = getFirstDay(viewYear, viewMonth);
  const getPostsForDay = (day: number) =>
    posts.filter(p => { const d = new Date(p.scheduled_at); return d.getFullYear()===viewYear&&d.getMonth()===viewMonth&&d.getDate()===day; });

  const scheduled  = posts.filter(p => p.status === "scheduled");
  const drafts     = posts.filter(p => p.status === "draft");
  const published  = posts.filter(p => p.status === "published");
  const failed     = posts.filter(p => p.status === "failed");
  const upcoming   = scheduled.filter(p => new Date(p.scheduled_at) >= now)
    .sort((a,b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-500" /> Post Scheduler
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Instagram & Facebook — posts saved in database, auto-publish via cron
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchPosts} className="p-2 rounded-xl border border-border hover:bg-muted/60 transition">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => { setSelectedDate(undefined); setShowModal(true); }}
            className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Post
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Scheduled", value: scheduled.length, color: "text-amber-500" },
          { label: "Drafts",    value: drafts.length,    color: "text-muted-foreground" },
          { label: "Published", value: published.length, color: "text-green-500" },
          { label: "Failed",    value: failed.length,    color: failed.length>0?"text-red-500":"text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-border bg-card text-center">
            <p className={`font-heading text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500/60" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted/60"><ChevronLeft className="w-4 h-4" /></button>
              <h2 className="font-heading font-bold">{MONTHS[viewMonth]} {viewYear}</h2>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted/60"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-7 border-b border-border">
              {DAYS.map(d => <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({length:firstDay}).map((_,i)=>
                <div key={`e-${i}`} className="h-20 border-b border-r border-border/50 bg-muted/10"/>)}
              {Array.from({length:daysInMonth}).map((_,i)=>{
                const day=i+1; const dayPosts=getPostsForDay(day);
                const isToday=day===now.getDate()&&viewMonth===now.getMonth()&&viewYear===now.getFullYear();
                return (
                  <div key={day} onClick={()=>{setSelectedDate(new Date(viewYear,viewMonth,day));setShowModal(true);}}
                    className="h-20 border-b border-r border-border/50 p-1.5 cursor-pointer hover:bg-muted/20 transition-colors">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${isToday?"bg-amber-400 text-black":"text-muted-foreground"}`}>{day}</div>
                    <div className="space-y-0.5">
                      {dayPosts.slice(0,2).map(post=>{
                        const Icon=PLATFORM_ICONS[post.platform];
                        return (<div key={post.id} className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium truncate ${post.platform==="instagram"?"text-pink-500 bg-pink-500/10":"text-blue-500 bg-blue-500/10"}`}>
                          <Icon className="w-2.5 h-2.5 flex-shrink-0"/><span className="truncate">{post.content_type}</span>
                        </div>);
                      })}
                      {dayPosts.length>2&&<p className="text-[9px] text-muted-foreground pl-1">+{dayPosts.length-2}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Queue */}
          <div className="space-y-4 overflow-y-auto max-h-[600px]">
            <h3 className="font-semibold text-sm sticky top-0 bg-background py-1">Upcoming ({upcoming.length})</h3>
            {upcoming.length===0?(
              <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
                <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30"/>
                <p className="text-sm text-muted-foreground">No posts scheduled</p>
                <button onClick={()=>setShowModal(true)} className="text-xs text-amber-500 mt-1 hover:underline">+ Schedule now</button>
              </div>
            ):upcoming.map(post=>{
              const Icon=PLATFORM_ICONS[post.platform];
              const d=new Date(post.scheduled_at);
              const sm=STATUS_META[post.status];
              return (
                <div key={post.id} className="p-4 rounded-xl border border-border bg-card space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${post.platform==="instagram"?"text-pink-500 bg-pink-500/10":"text-blue-500 bg-blue-500/10"}`}>
                      <Icon className="w-4 h-4"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold capitalize">{post.platform} · {post.content_type}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {d.toLocaleDateString("en-IN",{day:"numeric",month:"short"})} · {d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}
                      </p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sm.color}`}>{sm.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{post.caption}</p>
                  {post.media_url&&(
                    <div className="w-full h-16 rounded-lg overflow-hidden bg-muted/30">
                      {/\.(mp4|mov)$/i.test(post.media_url)
                        ?<video src={post.media_url} className="w-full h-full object-cover"/>
                        :<img src={post.media_url} alt="" className="w-full h-full object-cover"/>}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button onClick={()=>handlePublishById(post.id)} disabled={publishing===post.id}
                      className="flex-1 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-bold hover:bg-amber-500 transition flex items-center justify-center gap-1 disabled:opacity-50">
                      {publishing===post.id?<><Loader2 className="w-3 h-3 animate-spin"/>Publishing...</>:<><Zap className="w-3 h-3"/>Publish Now</>}
                    </button>
                    <button onClick={()=>handleDelete(post.id)} disabled={deleting===post.id}
                      className="p-1.5 rounded-lg border border-border hover:text-red-500 hover:border-red-500/30 transition">
                      {deleting===post.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Trash2 className="w-3.5 h-3.5"/>}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Drafts */}
            {drafts.length>0&&(<>
              <h3 className="font-semibold text-sm text-muted-foreground">Drafts ({drafts.length})</h3>
              {drafts.map(post=>{
                const Icon=PLATFORM_ICONS[post.platform];
                return (
                  <div key={post.id} className="p-3 rounded-xl border border-dashed border-border bg-muted/10 flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${post.platform==="instagram"?"text-pink-500":"text-blue-500"}`}/>
                    <p className="text-xs flex-1 truncate text-muted-foreground">{post.caption}</p>
                    <button onClick={()=>handleDelete(post.id)} className="text-muted-foreground hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                );
              })}
            </>)}

            {/* Failed */}
            {failed.length>0&&(<>
              <h3 className="font-semibold text-sm text-red-500">Failed ({failed.length})</h3>
              {failed.map(post=>(
                <div key={post.id} className="p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                  <p className="text-xs font-medium text-red-500 truncate">{post.caption.slice(0,60)}</p>
                  {post.error_message&&<p className="text-[10px] text-muted-foreground mt-1">{post.error_message}</p>}
                  <div className="flex gap-2 mt-2">
                    <button onClick={()=>handlePublishById(post.id)} disabled={publishing===post.id}
                      className="flex-1 py-1 rounded-lg bg-amber-400 text-black text-xs font-bold">
                      Retry
                    </button>
                    <button onClick={()=>handleDelete(post.id)} className="px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </>)}
          </div>
        </div>
      )}

      {showModal&&(
        <NewPostModal
          onClose={()=>setShowModal(false)}
          onSave={handleSave}
          onPublishNow={handlePublishNow}
          defaultDate={selectedDate}
        />
      )}
    </div>
  );
}
