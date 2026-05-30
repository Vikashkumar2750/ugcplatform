"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Clock, Camera,
  PlayCircle, Share2, Trash2, CheckCircle2, AlertCircle,
  X, Sparkles, RefreshCw, Loader2
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

const PLATFORM_ICONS = {
  instagram: Camera,
  facebook: Share2,
};
const PLATFORM_COLORS = {
  instagram: "text-pink-500 bg-pink-500/10",
  facebook: "text-blue-500 bg-blue-500/10",
};
const STATUS_COLORS: Record<PostStatus, string> = {
  draft:      "text-muted-foreground bg-muted",
  scheduled:  "text-amber-600 bg-amber-500/10",
  publishing: "text-blue-500 bg-blue-500/10",
  published:  "text-green-500 bg-green-500/10",
  failed:     "text-red-500 bg-red-500/10",
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

// ── New Post Modal ────────────────────────────────────────────────
function NewPostModal({ onClose, onSave, defaultDate }: {
  onClose: () => void;
  onSave: (post: Omit<ScheduledPost, "id" | "created_at" | "published_at" | "error_message">) => Promise<void>;
  defaultDate?: Date;
}) {
  const [platform, setPlatform] = useState<"instagram" | "facebook">("instagram");
  const [contentType, setContentType] = useState("reel");
  const [caption, setCaption] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [scheduledDate, setScheduledDate] = useState(
    defaultDate
      ? new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [saveAsDraft, setSaveAsDraft] = useState(false);

  const contentTypes: Record<string, string[]> = {
    instagram: ["reel", "feed", "story", "carousel"],
    facebook:  ["post", "reel", "story"],
  };

  const handleSave = async (draft = false) => {
    if (!caption.trim() || (!draft && !scheduledDate)) return;
    setSaving(true);
    setSaveAsDraft(draft);
    await onSave({
      platform,
      content_type: contentType,
      caption,
      first_comment: firstComment || undefined,
      scheduled_at: scheduledDate ? new Date(scheduledDate).toISOString() : new Date(Date.now() + 3600000).toISOString(),
      status: draft ? "draft" : "scheduled",
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg">Schedule New Post</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {/* Platform */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Platform</label>
          <div className="grid grid-cols-2 gap-2">
            {(["instagram", "facebook"] as const).map(p => {
              const Icon = PLATFORM_ICONS[p];
              return (
                <button key={p} onClick={() => { setPlatform(p); setContentType(contentTypes[p][0]); }}
                  className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 text-xs font-medium capitalize ${platform === p ? "border-amber-400/60 bg-amber-400/8" : "border-border hover:border-foreground/20"}`}>
                  <Icon className={`w-5 h-5 ${platform === p ? "text-amber-500" : "text-muted-foreground"}`} />
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Content type</label>
          <div className="flex gap-2 flex-wrap">
            {contentTypes[platform].map(type => (
              <button key={type} onClick={() => setContentType(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${contentType === type ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Caption */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Caption</label>
            <span className="text-xs text-muted-foreground">{caption.length} chars</span>
          </div>
          <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={5}
            placeholder="Yaar, yeh ek cheez hai jo main chahta tha ki mujhe 2 saal pehle koi batata... 👇"
            className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none focus:border-amber-500/50" />
        </div>

        {/* First comment */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            First comment <span className="text-muted-foreground font-normal text-xs">(hashtags here — best practice)</span>
          </label>
          <input value={firstComment} onChange={e => setFirstComment(e.target.value)}
            placeholder="#ContentCreator #UGCIndia #InstagramReels"
            className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50" />
        </div>

        {/* Schedule time */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Schedule date & time (IST)</label>
          <input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50" />
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "Mon 7 PM", offset: 1 * 86400000 },
              { label: "Wed 8 PM", offset: 3 * 86400000 },
              { label: "Fri 9 PM", offset: 5 * 86400000 },
            ].map(t => (
              <button key={t.label} onClick={() => {
                const d = new Date(Date.now() + t.offset);
                d.setHours(19, 0, 0, 0);
                setScheduledDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
              }}
                className="text-xs px-2 py-0.5 rounded bg-amber-400/10 text-amber-600 dark:text-amber-400 hover:bg-amber-400/20 transition">
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => handleSave(true)} disabled={saving || !caption.trim()}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/60 disabled:opacity-40">
            {saving && saveAsDraft ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save as Draft"}
          </button>
          <button onClick={() => handleSave(false)} disabled={saving || !caption.trim() || !scheduledDate}
            className="flex-1 py-2.5 rounded-xl btn-amber text-sm font-bold disabled:opacity-40">
            {saving && !saveAsDraft ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Schedule Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Scheduler Page ───────────────────────────────────────────
export default function SchedulerPage() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/automation/schedule");
    if (res.ok) {
      const { posts: data } = await res.json();
      setPosts(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleSave = async (post: Omit<ScheduledPost, "id" | "created_at" | "published_at" | "error_message">) => {
    const res = await fetch("/api/automation/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    });
    if (res.ok) await fetchPosts();
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await fetch("/api/automation/schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchPosts();
    setDeleting(null);
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay    = getFirstDay(viewYear, viewMonth);

  const getPostsForDay = (day: number) =>
    posts.filter(p => {
      const d = new Date(p.scheduled_at);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day;
    });

  const scheduledCount = posts.filter(p => p.status === "scheduled").length;
  const publishedCount = posts.filter(p => p.status === "published").length;
  const draftCount     = posts.filter(p => p.status === "draft").length;
  const upcoming = posts
    .filter(p => p.status === "scheduled" && new Date(p.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 pb-16">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-500" />
            Post Scheduler
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Instagram & Facebook — real scheduling from database</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchPosts} className="p-2 rounded-xl border border-border hover:bg-muted/60 transition">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => { setSelectedDate(undefined); setShowModal(true); }}
            className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Schedule Post
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Scheduled", value: scheduledCount, color: "text-amber-500" },
          { label: "Drafts",    value: draftCount,     color: "text-muted-foreground" },
          { label: "Published", value: publishedCount, color: "text-green-500" },
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
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`e-${i}`} className="h-24 border-b border-r border-border/50 bg-muted/10" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayPosts = getPostsForDay(day);
                const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
                return (
                  <div key={day} onClick={() => { setSelectedDate(new Date(viewYear, viewMonth, day)); setShowModal(true); }}
                    className="h-24 border-b border-r border-border/50 p-1.5 cursor-pointer hover:bg-muted/20 transition-colors">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${isToday ? "bg-amber-400 text-black" : "text-muted-foreground"}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayPosts.slice(0, 3).map(post => {
                        const Icon = PLATFORM_ICONS[post.platform];
                        return (
                          <div key={post.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${PLATFORM_COLORS[post.platform]}`}>
                            <Icon className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="truncate">{post.content_type}</span>
                          </div>
                        );
                      })}
                      {dayPosts.length > 3 && <p className="text-[10px] text-muted-foreground pl-1">+{dayPosts.length - 3}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Post queue */}
          <div className="space-y-4">
            <h3 className="font-heading font-semibold text-sm">Upcoming Posts</h3>
            {upcoming.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No posts scheduled</p>
                <button onClick={() => setShowModal(true)} className="text-xs text-amber-500 mt-1 hover:underline">
                  + Schedule one now
                </button>
              </div>
            ) : (
              upcoming.map(post => {
                const Icon = PLATFORM_ICONS[post.platform];
                const d = new Date(post.scheduled_at);
                return (
                  <div key={post.id} className="p-4 rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${PLATFORM_COLORS[post.platform]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold capitalize">{post.platform} {post.content_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[post.status]}`}>
                        {post.status}
                      </span>
                      <button onClick={() => handleDelete(post.id)} disabled={deleting === post.id}
                        className="text-muted-foreground hover:text-red-500 transition">
                        {deleting === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{post.caption}</p>
                    {post.first_comment && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1 truncate">💬 {post.first_comment}</p>
                    )}
                  </div>
                );
              })
            )}

            {/* Drafts */}
            {posts.filter(p => p.status === "draft").length > 0 && (
              <div>
                <h3 className="font-heading font-semibold text-sm text-muted-foreground">Drafts</h3>
                {posts.filter(p => p.status === "draft").map(post => {
                  const Icon = PLATFORM_ICONS[post.platform];
                  return (
                    <div key={post.id} className="p-3 rounded-xl border border-dashed border-border bg-muted/20 mt-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${post.platform === "instagram" ? "text-pink-500" : "text-blue-500"}`} />
                        <p className="text-xs font-medium flex-1 truncate">{post.caption}</p>
                        <button onClick={() => handleDelete(post.id)} className="text-muted-foreground hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <NewPostModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          defaultDate={selectedDate}
        />
      )}
    </div>
  );
}
