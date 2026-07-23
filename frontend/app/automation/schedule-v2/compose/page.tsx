"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar, Camera, Share2, PlayCircle, Users,
  Upload, X, Loader2, AlertCircle, Plus, Send, RefreshCw,
  Music, Bot, Clock, Sparkles, Settings2, Eye, LayoutTemplate,
  ChevronDown, ChevronUp
} from "lucide-react";
import { useDashboardStore, type ConnectedAccount, type Platform } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

// Types
type ContentType = "post" | "reel" | "story" | "carousel";

interface PlatformTweaks {
  caption?: string;
  firstComment?: string;
  audioName?: string;
  dmAutomationId?: string;
  youtubeTitle?: string;
  youtubeTags?: string;
  youtubeCategory?: string;
}

export default function SchedulerV2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accounts, rules: automationRules, isLoading: loading, load } = useDashboardStore();
  
  useEffect(() => {
    load();
  }, [load]);
  
  // Composer State
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [baseCaption, setBaseCaption] = useState("");
  const [useBaseCaptionForAll, setUseBaseCaptionForAll] = useState(true);
  const [mediaFiles, setMediaFiles] = useState<{ url: string; caption: string }[]>([]);
  const [contentType, setContentType] = useState<ContentType>("post");
  
  // Tweaks State (keyed by platform)
  const [tweaks, setTweaks] = useState<Record<string, PlatformTweaks>>({
    instagram: {}, facebook: {}, youtube: {}, linkedin: {}
  });

  // Scheduled Date
  const [scheduledDate, setScheduledDate] = useState(() => {
    const urlDate = searchParams.get("date");
    if (urlDate) {
      const d = new Date(urlDate);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    const d = new Date();
    d.setHours(19, 0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");


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

  const makePayload = (account: ConnectedAccount) => {
    return {
      platform: account.platform,
      content_type: mediaFiles.length > 1 && contentType === "post" ? "carousel" : contentType,
      caption: useBaseCaptionForAll ? baseCaption : (tweaks[account.platform]?.caption || baseCaption),
      first_comment: account.platform === "instagram" ? tweaks.instagram?.firstComment : undefined,
      media_url: mediaFiles.length > 0 ? mediaFiles[0].url : undefined,
      carousel_urls: mediaFiles.length > 1 ? mediaFiles.map(m => m.url) : undefined,
      image_captions: mediaFiles.length > 1 ? mediaFiles.map(m => m.caption) : undefined,
      audio_name: contentType === "reel" && account.platform === "instagram" ? tweaks.instagram?.audioName : undefined,
      dm_automation_id: account.platform === "instagram" ? tweaks.instagram?.dmAutomationId : undefined,
      youtube_category_id: account.platform === "youtube" ? tweaks.youtube?.youtubeCategory : undefined,
      account_id: account.id,
    };
  };

  const handlePublishNow = async () => {
    if (!baseCaption.trim() && mediaFiles.length === 0) return;
    setPublishing(true); setError("");
    try {
      const selectedAccounts = accounts.filter(a => selectedAccountIds.has(a.id));
      for (const acc of selectedAccounts) {
        // Save as scheduled post with current time — backend picks it up immediately
        const payload = {
          ...makePayload(acc),
          scheduled_at: new Date().toISOString(),
          status: "scheduled"
        };
        const res = await fetch("/api/automation/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Publish failed");
      }

      // Trigger backend to publish immediately (fire-and-forget)
      // This bypasses the 15s cron interval for near-instant publishing
      fetch("/api/automation/schedule/trigger", { method: "POST" }).catch(() => {});

      const hasInstagram = selectedAccounts.some(a => a.platform === "instagram");
      const note = hasInstagram ? "\n\nNote: Videos may take 1-2 minutes to process on Instagram." : "";
      alert(`Publishing to ${selectedAccounts.length} account(s)! Check history for status.${note}`);
      
      // Redirect back to schedule-v2
      router.push("/automation/schedule-v2?platform=" + (searchParams.get("platform") || "instagram"));
    } catch (err: any) {
      setError(err.message || "Publish failed");
    }
    setPublishing(false);
  };

  const handleSchedule = async () => {
    if (!baseCaption.trim() && mediaFiles.length === 0) return;
    if (!scheduledDate) return;
    setSaving(true); setError("");
    try {
      const selectedAccounts = accounts.filter(a => selectedAccountIds.has(a.id));
      for (const acc of selectedAccounts) {
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
      alert(`Successfully scheduled to ${selectedAccounts.length} account(s)!`);
      
      // Redirect back to schedule
      router.push("/automation/schedule?platform=" + (searchParams.get("platform") || "instagram"));
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
            
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts connected.</p>
            ) : (
              <div className="relative z-10 w-full max-w-md">
                <button
                  onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Publish to:</span>
                    <span className="text-muted-foreground">
                      {selectedAccountIds.size === 0 
                        ? "Select accounts" 
                        : `${selectedAccountIds.size} account(s) selected`}
                    </span>
                  </div>
                  {showAccountDropdown ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </button>

                {showAccountDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-card border border-border rounded-xl shadow-lg max-h-[300px] overflow-y-auto">
                    <div className="space-y-4">
                      {(["instagram", "facebook", "youtube", "linkedin"] as Platform[]).map(platform => {
                        const platformAccounts = accounts.filter(acc => acc.platform === platform);
                        if (platformAccounts.length === 0) return null;
                        
                        const PlatformIcon = platform === "instagram" ? Camera :
                                             platform === "facebook" ? Share2 :
                                             platform === "youtube" ? PlayCircle : Users;
                                             
                        const platformColor = platform === "instagram" ? "text-pink-500" :
                                              platform === "facebook" ? "text-blue-500" :
                                              platform === "youtube" ? "text-red-500" : "text-blue-700";
                                              
                        return (
                          <div key={platform} className="space-y-2">
                            <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                              <PlatformIcon className={`w-4 h-4 ${platformColor}`} />
                              <h3 className="text-xs font-semibold capitalize text-muted-foreground">{platform === "youtube" ? "YouTube" : platform === "linkedin" ? "LinkedIn" : platform}</h3>
                            </div>
                            <div className="flex flex-col gap-1">
                              {platformAccounts.map(acc => {
                                const selected = selectedAccountIds.has(acc.id);
                                return (
                                  <label key={acc.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                                    <input 
                                      type="checkbox" 
                                      checked={selected}
                                      onChange={() => toggleAccount(acc.id)}
                                      className="w-4 h-4 rounded border-muted-foreground/30 text-amber-500 focus:ring-amber-500/20"
                                    />
                                    {acc.avatar_url ? (
                                      <img src={acc.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                                    ) : (
                                      <PlatformIcon className="w-5 h-5 opacity-70" />
                                    )}
                                    <span className={`text-sm ${selected ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                                      @{acc.platform_username}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
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

            <div className="space-y-4">
              <label className="text-sm font-medium">Media & Captions</label>
              <MediaUpload 
                mediaFiles={mediaFiles} 
                onFilesChanged={(files: any[]) => {
                  setMediaFiles(files);
                  if (files.length > 0 && files[0].url.match(/\.(mp4|mov)$/i) && contentType === "post") {
                    setContentType("reel");
                  }
                }} 
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
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex justify-between items-center">
                3. Platform Tweaks
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useBaseCaptionForAll}
                    onChange={(e) => setUseBaseCaptionForAll(e.target.checked)}
                    className="rounded border-border text-amber-500 focus:ring-amber-500 bg-background"
                  />
                  Use Base Caption for all platforms
                </label>
              </h2>
              
              <div className="space-y-3">
                {selectedPlatforms.map(platform => (
                  <PlatformTweakCard
                    key={platform}
                    platform={platform as Platform}
                    rules={automationRules}
                    isReel={contentType === "reel"}
                    tweaks={tweaks[platform as Platform] || {}}
                    useBaseCaptionForAll={useBaseCaptionForAll}
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
                  disabled={saving || (!baseCaption.trim() && mediaFiles.length === 0)}
                  className="w-full py-3 rounded-xl border border-amber-400/40 bg-amber-400/10 text-amber-600 dark:text-amber-400 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-amber-400/20 transition"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  Schedule
                </button>

                <button
                  onClick={handlePublishNow}
                  disabled={publishing || (!baseCaption.trim() && mediaFiles.length === 0)}
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
                   mediaFiles={mediaFiles}
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

function PlatformTweakCard({ platform, tweaks, onChange, rules, isReel, useBaseCaptionForAll }: {
  platform: Platform;
  tweaks: PlatformTweaks;
  onChange: (t: Partial<PlatformTweaks>) => void;
  rules: any[];
  isReel: boolean;
  useBaseCaptionForAll?: boolean;
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
          {!useBaseCaptionForAll && (
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
          )}

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
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select 
                  value={tweaks.youtubeCategory || "22"} 
                  onChange={e => onChange({ youtubeCategory: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none transition"
                >
                  <option value="1">Film & Animation</option>
                  <option value="2">Autos & Vehicles</option>
                  <option value="10">Music</option>
                  <option value="15">Pets & Animals</option>
                  <option value="17">Sports</option>
                  <option value="20">Gaming</option>
                  <option value="22">People & Blogs</option>
                  <option value="23">Comedy</option>
                  <option value="24">Entertainment</option>
                  <option value="26">Howto & Style</option>
                  <option value="27">Education</option>
                  <option value="28">Science & Technology</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PostPreview({ platform, account, mediaFiles, caption, contentType }: any) {
  if (!account) return null;
  const firstMedia = mediaFiles?.[0]?.url;
  const isVideo = firstMedia?.match(/\.(mp4|mov)$/i);
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

      <div className="bg-muted aspect-square sm:aspect-auto sm:min-h-[250px] flex items-center justify-center relative overflow-hidden">
        {!firstMedia ? (
          <div className="text-muted-foreground/30 flex flex-col items-center gap-2">
            <Camera className="w-8 h-8" />
            <span className="text-xs font-medium">No media uploaded</span>
          </div>
        ) : isVideo ? (
          <video src={firstMedia} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0">
            <img src={firstMedia} className="absolute inset-0 w-full h-full object-cover" />
            {mediaFiles?.length > 1 && (
              <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-md">
                1/{mediaFiles.length}
              </div>
            )}
          </div>
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

function MediaUpload({ mediaFiles, onFilesChanged, accept }: any) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async (files: FileList) => {
    setUploading(true);
    setProgress(20);
    
    try {
      const newFiles = [...mediaFiles];
      const supabase = createClient();
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          // 1. Get signed upload URL from backend
          const res = await fetch("/api/automation/schedule/get-upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: file.name }),
          });
          
          const { signedUrl, token, path, publicUrl, error: apiError } = await res.json();
          if (apiError || !token) throw new Error(apiError || "Failed to get upload URL");
          
          // 2. Upload file directly to Supabase using the signed token
          const { error: uploadError } = await supabase.storage
            .from("post-media")
            .uploadToSignedUrl(path, token, file);
            
          if (uploadError) throw new Error(uploadError.message);
            
          newFiles.push({ url: publicUrl, caption: "" });
          setProgress(20 + Math.floor(((i + 1) / files.length) * 70));
        } catch (err: any) {
          console.error("Upload failed for file:", file.name, err);
          alert(`Failed to upload ${file.name}: ${err.message}`);
        }
      }
      
      setProgress(100);
      setTimeout(() => { 
        setProgress(0); 
        setUploading(false); 
        onFilesChanged(newFiles); 
        if (inputRef.current) inputRef.current.value = "";
      }, 300);
    } catch (err: any) {
      console.error("Fatal upload error:", err);
      alert(`Initialization error: ${err.message}`);
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    const updated = [...mediaFiles];
    updated.splice(index, 1);
    onFilesChanged(updated);
  };

  const updateCaption = (index: number, caption: string) => {
    const updated = [...mediaFiles];
    updated[index].caption = caption;
    onFilesChanged(updated);
  };

  return (
    <div className="space-y-4">
      {mediaFiles.map((file: any, index: number) => {
        const isVideo = file.url.match(/\.(mp4|mov)$/i);
        return (
          <div key={index} className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-border bg-muted/20">
            <div className="relative w-full sm:w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
              {isVideo ? (
                <video src={file.url} className="w-full h-full object-cover" controls />
              ) : (
                <img src={file.url} className="w-full h-full object-cover" />
              )}
              <button 
                onClick={() => removeFile(index)} 
                className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-black transition"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-grow flex flex-col justify-center">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <LayoutTemplate className="w-3 h-3" /> Image {index + 1} Caption
              </label>
              <textarea
                value={file.caption}
                onChange={(e) => updateCaption(index, e.target.value)}
                placeholder="Optional specific caption for this image..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:border-amber-500/50 resize-none transition"
              />
            </div>
          </div>
        );
      })}

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
            <p className="text-xs text-muted-foreground mt-1">Images or Videos (Select multiple if supported)</p>
          </>
        )}
        <input 
          ref={inputRef} 
          type="file" 
          multiple
          accept={accept} 
          className="hidden" 
          onChange={e => { 
            if(e.target.files && e.target.files.length > 0) {
              upload(e.target.files); 
            }
          }} 
        />
      </div>
    </div>
  );
}
