"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw, Users, Eye, Video, PlayCircle, ThumbsUp, MessageCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// ── Types ──────────────────────────────────────────────────────────
interface YTVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
}

interface YTInsightsData {
  connected: boolean;
  accountId?: string;
  channelId: string;
  channelName: string;
  avatar: string | null;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  recentVideos: YTVideo[];
  connectedAt: string;
  availableAccounts?: { id: string; name: string; handle: string }[];
}

function fmt(n: number) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
}

// ── Stat Card ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, highlight }: {
  label: string; value: string; sub?: string; icon?: any; highlight?: boolean;
}) {
  return (
    <div className={`p-4 rounded-2xl border bg-card flex flex-col gap-2 ${highlight ? "border-red-500/50 bg-red-500/5" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        {Icon && <Icon className={`w-3.5 h-3.5 ${highlight ? "text-red-500" : "text-muted-foreground/40"}`} />}
      </div>
      <div>
        <p className={`text-2xl font-black font-heading ${highlight ? "text-red-500" : ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Helper to access sessionStorage safely ──
const getSessionCache = (key: string) => {
  if (typeof window === "undefined") return null;
  try {
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    // Valid for 24 hours
    if (Date.now() - parsed.fetchedAt > 24 * 60 * 60 * 1000) return null;
    return parsed.data;
  } catch { return null; }
};
const setSessionCache = (key: string, data: any) => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify({ data, fetchedAt: Date.now() }));
};

// ── Main Page ──────────────────────────────────────────────────────
export default function YouTubeInsightsPage() {
  const [data, setData] = useState<YTInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const fetchAll = useCallback(async (isRefresh = false, accId?: string | null) => {
    const targetAccountId = accId || selectedAccountId;

    // Check client-side sessionStorage cache first if not refreshing
    if (!isRefresh) {
      const cacheKey = targetAccountId ? `yt_insights_${targetAccountId}` : "yt_insights_default";
      const cached = getSessionCache(cacheKey);
      if (cached && cached.accountId) {
        setData(cached);
        if (loading) setLoading(false);
        return;
      }
    }

    if (isRefresh || data !== null) setRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      let url = "/api/insights/youtube";
      const params = new URLSearchParams();
      if (isRefresh) params.append("force", "true");
      if (targetAccountId) params.append("accountId", targetAccountId);
      if (params.toString()) url += "?" + params.toString();

      const insRes = await fetch(url);
      const insJson = await insRes.json();
      
      if (insRes.status === 404 && insJson.error === "not_connected") { setNotConnected(true); return; }
      if (!insRes.ok) { setError(insJson.error || "Failed to load"); return; }
      
      setData(insJson);

      // Save to sessionStorage
      const idToCache = targetAccountId || insJson.availableAccounts?.[0]?.id;
      if (idToCache) {
        setSessionCache(`yt_insights_${idToCache}`, insJson);
        setSessionCache("yt_insights_default", insJson);
      }

    } catch { setError("Network error — please retry"); }
    finally { setLoading(false); setRefreshing(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  useEffect(() => { fetchAll(false, selectedAccountId); }, [fetchAll, selectedAccountId]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-red-500" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading YouTube Analytics...</p>
      </div>
    </div>
  );

  if (notConnected) return (
    <div className="p-6 max-w-4xl mx-auto mt-12 text-center space-y-4">
      <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-6">
        <PlayCircle className="w-10 h-10 text-red-500" />
      </div>
      <h2 className="font-heading text-2xl font-bold">Connect YouTube</h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto">
        Connect your YouTube channel to unlock channel analytics, recent video performance, and audience insights.
      </p>
      <Link href="/connect" className="btn-amber px-6 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2 mt-4 hover:scale-105 transition-transform">
        <PlayCircle className="w-4 h-4" /> Connect YouTube Channel
      </Link>
    </div>
  );

  if (error || !data) return (
    <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500/50" />
        <h2 className="font-heading text-lg font-bold">Load Failed</h2>
        <p className="text-muted-foreground text-sm max-w-sm">{error}</p>
        <button onClick={() => fetchAll(true, selectedAccountId)} className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold inline-flex items-center gap-2 hover:bg-red-600 transition">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-6 rounded-3xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-4">
          {data.avatar ? (
            <Image src={data.avatar} alt="Avatar" width={56} height={56} className="rounded-full ring-2 ring-red-500/20 object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
              <PlayCircle className="w-6 h-6 text-red-500" />
            </div>
          )}
          <div>
            <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
              {data.channelName}
              <span className="bg-red-500/10 text-red-500 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">
                YouTube
              </span>
            </h1>
            <p className="text-muted-foreground text-xs mt-1 font-medium">{fmt(data.videoCount)} total videos uploaded</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {data.availableAccounts && data.availableAccounts.length > 1 && (
            <select
              value={selectedAccountId || data.accountId || data.availableAccounts[0].id}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-muted/50 border border-border text-sm rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/50 max-w-[200px] truncate font-medium cursor-pointer hover:bg-muted/80 transition"
            >
              {data.availableAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          )}

          <button onClick={() => fetchAll(true, selectedAccountId)} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted/60 transition shadow-sm bg-background">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-red-500" : "text-muted-foreground"}`} />
            <span className="hidden sm:inline">{refreshing ? "Syncing..." : "Sync"}</span>
          </button>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Subscribers" value={fmt(data.subscribers)} icon={Users} highlight />
        <StatCard label="Total Views" value={fmt(data.totalViews)} icon={Eye} />
        <StatCard label="Videos" value={fmt(data.videoCount)} icon={Video} />
      </div>

      {/* ── Recent Videos ── */}
      <div className="space-y-4">
        <h3 className="font-heading text-lg font-bold flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-red-500" /> Recent Uploads
        </h3>
        
        {data.recentVideos.length === 0 ? (
          <div className="p-8 text-center bg-card rounded-3xl border border-border border-dashed">
            <p className="text-muted-foreground text-sm">No recent videos found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.recentVideos.map((video) => (
              <a 
                key={video.id} 
                href={`https://youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noreferrer"
                className="group p-4 bg-card rounded-2xl border border-border hover:border-red-500/30 transition-all hover:shadow-md flex flex-col gap-3 cursor-pointer"
              >
                <div className="aspect-video relative rounded-xl overflow-hidden bg-muted">
                  {video.thumbnail && (
                    <Image 
                      src={video.thumbnail} 
                      alt={video.title} 
                      fill 
                      className="object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                </div>
                
                <h4 className="font-semibold text-sm line-clamp-2 leading-snug group-hover:text-red-500 transition-colors">
                  {video.title}
                </h4>
                
                <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground font-medium">
                  <div className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {fmt(video.views)}</div>
                  <div className="flex items-center gap-1.5"><ThumbsUp className="w-3.5 h-3.5" /> {fmt(video.likes)}</div>
                  <div className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> {fmt(video.comments)}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
