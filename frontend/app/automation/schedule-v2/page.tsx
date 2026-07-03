"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Calendar, Camera, Share2, PlayCircle, Users,
  Upload, X, Loader2, AlertCircle, Plus, Send, RefreshCw,
  Music, Bot, Clock, Sparkles, Settings2, Eye, LayoutTemplate
} from "lucide-react";

// Types
type Platform = "instagram" | "facebook" | "youtube" | "linkedin";
type ContentType = "post" | "reel" | "story" | "carousel";

interface ConnectedAccount {
  id: string;
  platform: Platform;
  platform_username: string;
  avatar_url?: string;
}

interface PlatformTweaks {
  caption?: string;
  firstComment?: string;
  audioName?: string;
  dmAutomationId?: string;
  youtubeTitle?: string;
  youtubeTags?: string;
}

export default function SchedulerV2Page() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [automationRules, setAutomationRules] = useState<Array<{ id: string; name: string; type: string }>>([]);
  
  // Composer State
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [baseCaption, setBaseCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [contentType, setContentType] = useState<ContentType>("post");
  
  // Tweaks State (keyed by platform)
  const [tweaks, setTweaks] = useState<Record<string, PlatformTweaks>>({
    instagram: {}, facebook: {}, youtube: {}, linkedin: {}
  });

  // Scheduled Date
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    d.setHours(19, 0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, accountsRes] = await Promise.all([
        fetch("/api/automation/rules"),
        fetch("/api/connect/accounts"),
      ]);
      if (rulesRes.ok) {
        const j = await rulesRes.json();
        setAutomationRules(j.rules || []);
      }
      if (accountsRes.ok) {
        const j = await accountsRes.json();
        setAccounts(j.accounts || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleAccount = (id: string) => {
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedPlatforms = Array.from(new Set(
    accounts.filter(a => selectedAccountIds.has(a.id)).map(a => a.platform)
  ));

  const makePayload = (account: ConnectedAccount) => ({
    platform: account.platform,
    content_type: contentType,
    caption: tweaks[account.platform]?.caption || baseCaption,
    first_comment: account.platform === "instagram" ? tweaks.instagram?.firstComment : undefined,
    media_url: mediaUrl || undefined,
    audio_name: contentType === "reel" && account.platform === "instagram" ? tweaks.instagram?.audioName : undefined,
    dm_automation_id: account.platform === "instagram" ? tweaks.instagram?.dmAutomationId : undefined,
    account_id: account.id,
  });

  const handlePublishNow = async () => {
    if (!baseCaption.trim() && !mediaUrl) return;
    setPublishing(true); setError("");
    try {
      for (const acc of accounts.filter(a => selectedAccountIds.has(a.id))) {
        const res = await fetch("/api/automation/schedule/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makePayload(acc)),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Publish failed");
      }
      alert("Successfully published to all selected platforms!");
    } catch (err: any) {
      setError(err.message || "Publish failed");
    }
    setPublishing(false);
  };

  const handleSchedule = async () => {
    if (!baseCaption.trim() && !mediaUrl) return;
    if (!scheduledDate) return;
    setSaving(true); setError("");
    try {
      for (const acc of accounts.filter(a => selectedAccountIds.has(a.id))) {
        const payload = {
          ...makePayload(acc),
          scheduled_at: new Date(scheduledDate).toISOString(),
          status: "scheduled"
        };
        const res = await fetch("/api/automation/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Scheduling failed for " + acc.platform);
      }
      alert("Successfully scheduled to all selected platforms!");
    } catch (err: any) {
      setError(err.message || "Schedule failed");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-background">
      {/* Left Column: Composer */}
      <div className="flex-1 overflow-y-auto border-r border-border scrollbar-none">
        <div className="p-6 max-w-3xl mx-auto space-y-8 pb-32">
          
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              <LayoutTemplate className="w-6 h-6 text-amber-500" /> Multi-Channel Composer
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create once, publish everywhere. Tweak per platform for maximum reach.
            </p>
          </div>

          {/* 1. Select Accounts */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">1. Select Accounts</h2>
            <div className="flex flex-wrap gap-2">
              {accounts.map(acc => {
                const selected = selectedAccountIds.has(acc.id);
                const Icon = acc.platform === "instagram" ? Camera :
                             acc.platform === "facebook" ? Share2 :
                             acc.platform === "youtube" ? PlayCircle : Users;
                return (
                  <button
                    key={acc.id}
                    onClick={() => toggleAccount(acc.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                      selected 
                        ? "border-amber-400 bg-amber-400/10 text-foreground" 
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">@{acc.platform_username}</span>
                  </button>
                );
              })}
              {accounts.length === 0 && (
                <p className="text-sm text-muted-foreground">No accounts connected.</p>
              )}
            </div>
          </section>

          {/* 2. Base Content */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">2. Base Content</h2>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Content Type</label>
              <div className="flex gap-2">
                {(["post", "reel", "story"] as ContentType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setContentType(t)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all capitalize ${
                      contentType === t 
                        ? "border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400" 
                        : "border-border text-muted-foreground hover:border-foreground/20"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Media</label>
              <MediaUpload 
                mediaUrl={mediaUrl} 
                onUploaded={setMediaUrl} 
                onClear={() => setMediaUrl("")} 
                accept={contentType === "reel" ? "video/mp4,video/quicktime" : "image/*,video/*"}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Base Caption</label>
              <textarea
                value={baseCaption}
                onChange={e => setBaseCaption(e.target.value)}
                placeholder="Write your main caption here. You can customize it per platform below..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50 resize-none transition"
              />
            </div>

          </section>

          {/* 3. Platform Tweaks */}
          {selectedPlatforms.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">3. Platform Tweaks</h2>
              
              <div className="space-y-3">
                {selectedPlatforms.map(platform => (
                  <PlatformTweakCard
                    key={platform}
                    platform={platform as Platform}
                    rules={automationRules}
                    isReel={contentType === "reel"}
                    tweaks={tweaks[platform as Platform] || {}}
                    onChange={(updates) => setTweaks(prev => ({
                      ...prev,
                      [platform]: { ...prev[platform], ...updates }
                    }))}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 4. Publish Options */}
          {selectedPlatforms.length > 0 && (
            <section className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">4. Publish Options</h2>
              
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" /> Schedule date & time (IST)
                </label>
                <input 
                  type="datetime-local" 
                  value={scheduledDate} 
                  onChange={e => setScheduledDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50 transition" 
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleSchedule}
                  disabled={saving || (!baseCaption.trim() && !mediaUrl)}
                  className="w-full py-3 rounded-xl border border-amber-400/40 bg-amber-400/10 text-amber-600 dark:text-amber-400 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-amber-400/20 transition"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  Schedule
                </button>

                <button
                  onClick={handlePublishNow}
                  disabled={publishing || (!baseCaption.trim() && !mediaUrl)}
                  className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-amber-400 to-orange-400 text-black hover:from-amber-500 hover:to-orange-500"
                >
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Publish Now
                </button>
              </div>
            </section>
          )}

        </div>
      </div>

      {/* Right Column: Live Preview */}
      <div className="w-full lg:w-[400px] border-l border-border bg-muted/10 hidden lg:flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-2 bg-card">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold">Live Preview</h3>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
           {selectedPlatforms.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground opacity-60">
               <Eye className="w-12 h-12 mb-3 opacity-20" />
               <p className="text-sm">Select accounts to preview your post</p>
             </div>
           ) : (
             <div className="space-y-6">
               {selectedPlatforms.map(platform => (
                 <PostPreview
                   key={platform}
                   platform={platform as Platform}
                   account={accounts.find(a => a.platform === platform && selectedAccountIds.has(a.id))}
                   mediaUrl={mediaUrl}
                   caption={tweaks[platform]?.caption || baseCaption}
                   contentType={contentType}
                 />
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

// ── Components ────────────────────────────────────────────────────────

function PlatformTweakCard({ platform, tweaks, onChange, rules, isReel }: {
  platform: Platform;
  tweaks: PlatformTweaks;
  onChange: (t: Partial<PlatformTweaks>) => void;
  rules: any[];
  isReel: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = platform === "instagram" ? Camera : platform === "facebook" ? Share2 : platform === "youtube" ? PlayCircle : Users;
  
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden transition-all">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold capitalize">{platform} Options</span>
        </div>
        <Settings2 className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4 border-t border-border mt-1">
          <div className="space-y-1.5 mt-3">
            <label className="text-xs font-medium text-muted-foreground">Override Caption (optional)</label>
            <textarea
              value={tweaks.caption || ""}
              onChange={e => onChange({ caption: e.target.value })}
              placeholder="Leave blank to use Base Caption..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50 resize-none transition"
            />
          </div>

          {platform === "instagram" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">First Comment (Hashtags)</label>
                <input
                  value={tweaks.firstComment || ""}
                  onChange={e => onChange({ firstComment: e.target.value })}
                  placeholder="#automation #marketing"
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-violet-400" /> DM Automation
                </label>
                <select 
                  value={tweaks.dmAutomationId || ""} 
                  onChange={e => onChange({ dmAutomationId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:border-violet-500/50 transition"
                >
                  <option value="">No automation</option>
                  {rules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              {isReel && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-violet-400" /> Trending Audio Name
                  </label>
                  <input
                    value={tweaks.audioName || ""}
                    onChange={e => onChange({ audioName: e.target.value })}
                    placeholder="e.g. Original Audio"
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50 transition"
                  />
                </div>
              )}
            </>
          )}

          {platform === "youtube" && (
            <div className="space-y-3">
               <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Video Title</label>
                <input
                  value={tweaks.youtubeTitle || ""}
                  onChange={e => onChange({ youtubeTitle: e.target.value })}
                  placeholder="Catchy title..."
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tags (comma separated)</label>
                <input
                  value={tweaks.youtubeTags || ""}
                  onChange={e => onChange({ youtubeTags: e.target.value })}
                  placeholder="marketing, software, tools"
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none transition"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PostPreview({ platform, account, mediaUrl, caption, contentType }: any) {
  if (!account) return null;
  const isVideo = mediaUrl?.match(/\.(mp4|mov)$/i);
  const Icon = platform === "instagram" ? Camera : platform === "facebook" ? Share2 : platform === "youtube" ? PlayCircle : Users;

  return (
    <div className="bg-background rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
            {account.avatar_url ? <img src={account.avatar_url} className="w-full h-full object-cover"/> : <Icon className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div>
            <p className="text-xs font-bold leading-none">{account.platform_username}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{platform} {contentType}</p>
          </div>
        </div>
        <Icon className="w-4 h-4 text-muted-foreground opacity-50" />
      </div>

      {/* Media */}
      <div className="bg-muted aspect-square sm:aspect-auto sm:min-h-[250px] flex items-center justify-center relative overflow-hidden">
        {!mediaUrl ? (
          <div className="text-muted-foreground/30 flex flex-col items-center gap-2">
            <Camera className="w-8 h-8" />
            <span className="text-xs font-medium">No media uploaded</span>
          </div>
        ) : isVideo ? (
          <video src={mediaUrl} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <img src={mediaUrl} className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      {/* Caption */}
      <div className="p-3 bg-card">
        <p className="text-xs text-foreground/90">
          <span className="font-bold mr-2">{account.platform_username}</span>
          {caption ? (
            <span className="whitespace-pre-wrap">{caption}</span>
          ) : (
            <span className="text-muted-foreground italic">Caption preview...</span>
          )}
        </p>
      </div>
    </div>
  );
}

function MediaUpload({ mediaUrl, onUploaded, onClear, accept }: any) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File) => {
    setUploading(true);
    setProgress(20);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/automation/schedule/upload", { method: "POST", body: formData });
      setProgress(90);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProgress(100);
      setTimeout(() => { setProgress(0); setUploading(false); onUploaded(data.url); }, 300);
    } catch {
      setUploading(false);
      setProgress(0);
    }
  };

  if (mediaUrl) {
    const isVideo = mediaUrl.match(/\.(mp4|mov)$/i);
    return (
      <div className="relative rounded-xl overflow-hidden border border-border bg-muted/20 flex items-center justify-center min-h-[150px]">
        {isVideo ? <video src={mediaUrl} className="w-full max-h-64 object-contain" controls /> : <img src={mediaUrl} className="w-full max-h-64 object-contain" />}
        <button onClick={onClear} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black transition"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-all"
    >
      {uploading ? (
        <div className="space-y-3 max-w-xs mx-auto">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-500" />
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
             <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
             <Upload className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Click to upload media</p>
          <p className="text-xs text-muted-foreground mt-1">Image or Video (max 50MB)</p>
        </>
      )}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f) upload(f); }} />
    </div>
  );
}
