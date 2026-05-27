"use client";

import { useState } from "react";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Clock, Camera,
  PlayCircle, Share2, Trash2, Edit3, CheckCircle2, AlertCircle,
  Upload, X, Sparkles
} from "lucide-react";

type PostStatus = "draft" | "scheduled" | "published" | "failed";

interface ScheduledPost {
  id: string;
  platform: "instagram" | "facebook" | "youtube";
  contentType: string;
  caption: string;
  scheduledAt: Date;
  status: PostStatus;
  mediaPreview?: string;
}

const PLATFORM_ICONS = {
  instagram: Camera,
  facebook: Share2,
  youtube: PlayCircle,
};

const PLATFORM_COLORS = {
  instagram: "text-pink-500 bg-pink-500/10",
  facebook: "text-blue-500 bg-blue-500/10",
  youtube: "text-red-500 bg-red-500/10",
};

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function NewPostModal({ onClose, onSave, defaultDate }: {
  onClose: () => void;
  onSave: (post: Omit<ScheduledPost, "id" | "status">) => void;
  defaultDate?: Date;
}) {
  const [platform, setPlatform] = useState<"instagram" | "facebook" | "youtube">("instagram");
  const [contentType, setContentType] = useState("reel");
  const [caption, setCaption] = useState("");
  const [scheduledDate, setScheduledDate] = useState(
    defaultDate ? defaultDate.toISOString().slice(0, 16) : ""
  );

  const contentTypes: Record<string, string[]> = {
    instagram: ["reel", "feed", "story", "carousel"],
    facebook: ["post", "reel", "story"],
    youtube: ["video", "shorts"],
  };

  const handleSave = () => {
    if (!caption || !scheduledDate) return;
    onSave({
      platform,
      contentType,
      caption,
      scheduledAt: new Date(scheduledDate),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg">Schedule New Post</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Platform</label>
          <div className="grid grid-cols-3 gap-2">
            {(["instagram", "facebook", "youtube"] as const).map(p => {
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

        {/* Media upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Media</label>
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-foreground/30 transition-colors cursor-pointer">
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Click to upload image or video</p>
            <p className="text-xs text-muted-foreground mt-1">MP4, MOV, JPG, PNG — max 100MB</p>
          </div>
        </div>

        {/* Caption */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Caption</label>
            <button className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 hover:underline">
              <Sparkles className="w-3 h-3" /> Generate with AI
            </button>
          </div>
          <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={5}
            placeholder="Yaar, yeh ek cheez hai jo main chahta tha ki mujhe 2 saal pehle koi batata... 👇&#10;&#10;#ContentCreator #IndianCreator"
            className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none resize-none" />
          <p className="text-xs text-muted-foreground text-right">{caption.length} chars</p>
        </div>

        {/* First comment (hashtag best practice) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">First comment <span className="text-muted-foreground font-normal">(put hashtags here — best practice)</span></label>
          <input placeholder="#ContentCreator #UGCIndia #InstagramReels #IndianCreator"
            className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none" />
        </div>

        {/* Schedule time */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Schedule date & time</label>
          <input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none" />
          <div className="flex gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">Suggested best times:</p>
            {["Mon 7:00 PM", "Wed 8:00 PM", "Fri 9:00 PM", "Sun 6:00 PM"].map(t => (
              <button key={t} className="text-xs px-2 py-0.5 rounded bg-amber-400/10 text-amber-600 dark:text-amber-400 hover:bg-amber-400/20 transition">{t}</button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => { onSave({ platform, contentType, caption, scheduledAt: new Date(scheduledDate) }); onClose(); }}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/60">Save as Draft</button>
          <button onClick={handleSave} disabled={!caption || !scheduledDate}
            className="flex-1 py-2.5 rounded-xl btn-amber text-sm font-bold disabled:opacity-40">Schedule Post</button>
        </div>
      </div>
    </div>
  );
}

export default function SchedulerPage() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [posts, setPosts] = useState<ScheduledPost[]>([
    {
      id: "1", platform: "instagram", contentType: "reel",
      caption: "Yaar, yeh cheez try karke dekho — engagement 3x ho gaya...",
      scheduledAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 19, 0),
      status: "scheduled",
    },
    {
      id: "2", platform: "youtube", contentType: "shorts",
      caption: "5 Instagram mistakes that cost me 10K followers",
      scheduledAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4, 18, 0),
      status: "scheduled",
    },
  ]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const getPostsForDay = (day: number) => {
    return posts.filter(p => {
      const d = p.scheduledAt;
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day;
    });
  };

  const scheduledCount = posts.filter(p => p.status === "scheduled").length;
  const publishedCount = posts.filter(p => p.status === "published").length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-500" />
            Post Scheduler
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Schedule posts for Instagram, Facebook, and YouTube
          </p>
        </div>
        <button onClick={() => { setSelectedDate(undefined); setShowModal(true); }}
          className="btn-amber px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
          <Plus className="w-4 h-4" /> Schedule Post
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Scheduled", value: scheduledCount, color: "text-amber-500" },
          { label: "Published", value: publishedCount, color: "text-green-500" },
          { label: "This Month", value: posts.filter(p => p.scheduledAt.getMonth() === now.getMonth()).length, color: "text-blue-500" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-border bg-card text-center">
            <p className={`font-heading text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
          {/* Calendar header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted/60 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="font-heading font-bold">{MONTHS[viewMonth]} {viewYear}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted/60 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-24 border-b border-r border-border/50 bg-muted/10" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayPosts = getPostsForDay(day);
              const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
              return (
                <div
                  key={day}
                  onClick={() => { setSelectedDate(new Date(viewYear, viewMonth, day)); setShowModal(true); }}
                  className="h-24 border-b border-r border-border/50 p-1.5 cursor-pointer hover:bg-muted/20 transition-colors"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${isToday ? "bg-amber-400 text-black" : "text-muted-foreground"}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map(post => {
                      const Icon = PLATFORM_ICONS[post.platform];
                      return (
                        <div key={post.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${PLATFORM_COLORS[post.platform]}`}>
                          <Icon className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate">{post.contentType}</span>
                        </div>
                      );
                    })}
                    {dayPosts.length > 3 && (
                      <p className="text-[10px] text-muted-foreground pl-1">+{dayPosts.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Post queue */}
        <div className="space-y-4">
          <h3 className="font-heading font-semibold text-sm">Upcoming Posts</h3>
          {posts.filter(p => p.status === "scheduled" && p.scheduledAt >= now)
            .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
            .map(post => {
              const Icon = PLATFORM_ICONS[post.platform];
              return (
                <div key={post.id} className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${PLATFORM_COLORS[post.platform]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold capitalize">{post.platform} {post.contentType}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.scheduledAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·{" "}
                        {post.scheduledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <button onClick={() => setPosts(posts.filter(p => p.id !== post.id))}
                      className="ml-auto text-muted-foreground hover:text-red-500 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{post.caption}</p>
                </div>
              );
            })}
          {posts.filter(p => p.status === "scheduled").length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No posts scheduled</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NewPostModal
          onClose={() => setShowModal(false)}
          onSave={(post) => setPosts([...posts, { ...post, id: Date.now().toString(), status: "scheduled" }])}
          defaultDate={selectedDate}
        />
      )}
    </div>
  );
}
