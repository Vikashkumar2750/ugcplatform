"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Share2, RefreshCw,
  Loader2, AlertCircle, Heart, MessageCircle, Users, Eye
} from "lucide-react";

interface FBInsightsData {
  connected: boolean;
  pageName: string;
  fans: number;
  followers: number;
  category: string;
  totalReach: number;
  totalImpressions: number;
  totalViews: number;
  totalEngaged: number;
  engagementRate: number;
  postsCount: number;
  topPosts: { id: string; message: string; type: string; likes: number; comments: number; shares: number; created: string }[];
  fanGrowthChart: { date: string; fans: number }[] | null;
}

function StatCard({ label, value, subLabel, trend }: { label: string; value: string; subLabel?: string; trend?: number }) {
  return (
    <div className="p-5 rounded-2xl border border-border bg-card">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
      <p className="font-heading text-2xl font-bold">{value}</p>
      {subLabel && (
        <p className={`text-xs mt-1 flex items-center gap-1 ${trend && trend > 0 ? "text-green-500" : trend && trend < 0 ? "text-red-500" : "text-muted-foreground"}`}>
          {trend && trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend && trend < 0 ? <TrendingDown className="w-3 h-3" /> : null}
          {subLabel}
        </p>
      )}
    </div>
  );
}

function SimpleBarChart({ data }: { data: { date: string; fans: number }[] }) {
  const max = Math.max(...data.map(d => d.fans)) || 1;
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t amber-gradient opacity-80"
            style={{ height: `${(d.fans / max) * 88}px` }}
          />
        </div>
      ))}
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
}

export default function FacebookInsightsPage() {
  const [data, setData] = useState<FBInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);

  const fetchInsights = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/facebook");
      const json = await res.json();
      if (res.status === 404 && json.error === "not_connected") {
        setNotConnected(true);
      } else if (!res.ok) {
        setError(json.error || "Failed to load Facebook insights");
      } else {
        setData(json);
        setNotConnected(false);
      }
    } catch {
      setError("Network error — please retry");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchInsights(); }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mt-16 text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-500" />
          <p className="text-muted-foreground text-sm">Facebook se real data fetch ho raha hai...</p>
        </div>
      </div>
    );
  }

  if (notConnected) {
    return (
      <div className="p-6 max-w-4xl mx-auto mt-12 text-center space-y-4">
        <Share2 className="w-14 h-14 mx-auto text-muted-foreground/30" />
        <h2 className="font-heading text-xl font-bold">Connect Facebook to see Page insights</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Connect your Facebook Business Page to see reach, engagement, post performance, and audience data.
        </p>
        <Link href="/connect" className="btn-amber px-6 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2">
          <Share2 className="w-4 h-4" /> Connect Facebook Page
        </Link>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto mt-12 text-center space-y-4">
        <AlertCircle className="w-12 h-12 mx-auto text-amber-500/50" />
        <h2 className="font-heading text-lg font-bold">Insights load nahi hue</h2>
        <p className="text-muted-foreground text-sm">{error}</p>
        <button onClick={() => { setLoading(true); fetchInsights(); }}
          className="btn-amber px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const chartData = data.fanGrowthChart || [
    { date: "Week 1", fans: Math.round(data.fans * 0.95) },
    { date: "Week 2", fans: Math.round(data.fans * 0.97) },
    { date: "Week 3", fans: Math.round(data.fans * 0.99) },
    { date: "Now", fans: data.fans },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Facebook Page Insights</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {data.pageName} · {data.category} · Last 30 days
          </p>
        </div>
        <button onClick={() => fetchInsights(true)} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted/60 transition">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Page Fans" value={fmt(data.fans)} subLabel={`${data.postsCount} posts found`} />
        <StatCard label="30-Day Reach" value={data.totalReach > 0 ? fmt(data.totalReach) : "—"}
          subLabel={data.totalReach > 0 ? "unique people" : "requires page role"} />
        <StatCard label="Engaged Users" value={data.totalEngaged > 0 ? fmt(data.totalEngaged) : "—"}
          subLabel={data.totalEngaged > 0 ? "last 30 days" : "requires page insights"} />
        <StatCard label="Page Views" value={data.totalViews > 0 ? fmt(data.totalViews) : "—"}
          subLabel={data.totalViews > 0 ? "last 30 days" : "requires page insights"} />
      </div>

      {/* Secondary stats */}
      {data.totalImpressions > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total Impressions" value={fmt(data.totalImpressions)} subLabel="last 30 days" />
          <StatCard label="Engagement Rate" value={`${data.engagementRate}%`}
            subLabel={data.engagementRate >= 1 ? "good for a Page" : "below average"}
            trend={data.engagementRate >= 1 ? 1 : -1} />
          <StatCard label="Followers" value={fmt(data.followers)} subLabel="current" />
        </div>
      )}

      {/* Fan growth chart */}
      <div className="p-5 rounded-2xl border border-border bg-card">
        <p className="text-sm font-semibold mb-1">Fan Growth</p>
        <p className="text-xs text-muted-foreground mb-4">
          {data.fanGrowthChart ? "Real data from Facebook API" : "Estimated trend"}
        </p>
        <SimpleBarChart data={chartData} />
        <div className="flex justify-between text-xs text-muted-foreground mt-3">
          {chartData.map(d => <span key={d.date}>{d.date}</span>)}
        </div>
      </div>

      {/* Top posts */}
      {data.topPosts.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="font-semibold text-sm">Recent Posts (by Engagement)</p>
          </div>
          <div className="divide-y divide-border">
            {data.topPosts.map((post, i) => (
              <div key={post.id} className="px-5 py-4 flex items-center gap-4">
                <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{post.message || "Post"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{post.type?.replace(/_/g, " ")}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{fmt(post.likes)}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{post.comments}</span>
                  <span className="flex items-center gap-1"><Share2 className="w-3 h-3" />{post.shares}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-2xl border border-border bg-card text-center">
          <p className="text-sm text-muted-foreground">Koi recent posts nahi mili. Page pe kuch post karo!</p>
        </div>
      )}

      {/* Info note — only show if insights metrics are ALL missing */}
      {data.totalReach === 0 && data.totalEngaged === 0 && data.topPosts.length === 0 && (
        <div className="p-4 rounded-xl border border-border bg-muted/30 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">No data found:</span>{" "}
            Page se koi bhi data nahi aa raha. Facebook se reconnect karo ya check karo ki page admin role theek hai.
          </p>
        </div>
      )}
      {/* Soft note when posts loaded but reach metrics are 0 */}
      {data.totalReach === 0 && data.topPosts.length > 0 && (
        <div className="p-3 rounded-xl border border-border bg-muted/20 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Reach & Impressions metrics ke liye Meta App Review approval required hai. Posts aur fans data available hai ✓
          </p>
        </div>
      )}
    </div>
  );
}
