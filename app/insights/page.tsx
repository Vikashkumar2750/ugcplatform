"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Heart, MessageCircle,
  Eye, Clock, Camera, BarChart3, RefreshCw, Loader2, AlertCircle
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
interface InsightsData {
  connected: boolean;
  handle: string;
  name: string;
  followers: number;
  followersGrowth: number;
  followersGrowthPct: number;
  mediaCount: number;
  avgReach: number;
  avgImpressions: number;
  engagementRate: number;
  profileVisits: number;
  avgLikes: number;
  avgComments: number;
  postsAnalyzed: number;
  followerGrowthChart: { date: string; followers: number }[] | null;
  audienceDemographics: {
    ageRanges: { range: string; pct: number }[];
    topLocations: string[];
    genderSplit: { male: number; female: number };
  };
  topPosts: { id: number; type: string; caption: string; likes: number; comments: number; reach: number; er: string }[];
  accountType: string;
}

// ── StatCard ───────────────────────────────────────────────────────
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

// ── SimpleLineChart ────────────────────────────────────────────────
function SimpleLineChart({ data }: { data: { date: string; followers: number }[] }) {
  const min = Math.min(...data.map(d => d.followers));
  const max = Math.max(...data.map(d => d.followers));
  const range = max - min || 1;
  const W = 100, H = 60;
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((d.followers - min) / range) * H * 0.85 - H * 0.075,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${W} ${H} L 0 ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#chartGrad)" />
      <path d={pathD} stroke="#f59e0b" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill="#f59e0b" />)}
    </svg>
  );
}

// ── Format number ──────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
}

// ── Main Page ──────────────────────────────────────────────────────
export default function InstagramInsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);

  const fetchInsights = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/instagram");
      const json = await res.json();
      if (res.status === 404 && json.error === "not_connected") {
        setNotConnected(true);
      } else if (!res.ok) {
        setError(json.error || "Failed to load insights");
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

  // ── Loading ──
  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mt-16 text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-amber-500" />
          <p className="text-muted-foreground text-sm">Instagram se real data fetch ho raha hai...</p>
        </div>
      </div>
    );
  }

  // ── Not connected ──
  if (notConnected) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mt-12 text-center space-y-4">
          <Camera className="w-14 h-14 mx-auto text-muted-foreground/30" />
          <h2 className="font-heading text-xl font-bold">Connect Instagram to see real insights</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Connect your Instagram Business or Creator account to see actual reach, impressions, audience demographics, and best posting times.
          </p>
          <Link href="/connect" className="btn-amber px-6 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2">
            <Camera className="w-4 h-4" /> Connect Instagram
          </Link>
        </div>
      </div>
    );
  }

  // ── API error ──
  if (error || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mt-12 text-center space-y-4">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500/50" />
          <h2 className="font-heading text-lg font-bold">Insights load nahi hue</h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">{error}</p>
          <button onClick={() => { setLoading(true); fetchInsights(); }}
            className="btn-amber px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
          <p className="text-xs text-muted-foreground">
            Note: Some insights (reach, demographics) require Meta App Review for full access.
            Basic stats (followers, engagement) always work.
          </p>
        </div>
      </div>
    );
  }

  // ── Mock chart fallback if API didn't return growth data ──
  const chartData = data.followerGrowthChart || [
    { date: "Week 1", followers: Math.round(data.followers * 0.94) },
    { date: "Week 2", followers: Math.round(data.followers * 0.96) },
    { date: "Week 3", followers: Math.round(data.followers * 0.98) },
    { date: "Now", followers: data.followers },
  ];

  // ── Real Data View ──
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Instagram Insights</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {data.handle} · {data.accountType || "CREATOR"} · Last 30 days
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
        <StatCard label="Followers" value={fmt(data.followers)}
          subLabel={data.postsAnalyzed > 0 ? `${data.postsAnalyzed} posts analyzed` : undefined} />
        <StatCard label="Avg Likes" value={fmt(data.avgLikes)} subLabel="per post" />
        <StatCard label="Engagement Rate" value={`${data.engagementRate}%`}
          subLabel={data.engagementRate >= 3 ? "above 3% is good" : "below average"}
          trend={data.engagementRate >= 3 ? 1 : -1} />
        <StatCard label="Profile Visits" value={data.profileVisits > 0 ? fmt(data.profileVisits) : "—"}
          subLabel={data.profileVisits > 0 ? "last 30 days" : "requires app review"} />
      </div>

      {/* Secondary stats */}
      {(data.avgReach > 0 || data.avgImpressions > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {data.avgReach > 0 && <StatCard label="Avg Daily Reach" value={fmt(data.avgReach)} subLabel="per day" />}
          {data.avgImpressions > 0 && <StatCard label="Avg Daily Impressions" value={fmt(data.avgImpressions)} subLabel="per day" />}
          <StatCard label="Avg Comments" value={fmt(data.avgComments)} subLabel="per post" />
        </div>
      )}

      {/* Follower growth chart */}
      <div className="p-5 rounded-2xl border border-border bg-card">
        <p className="text-sm font-semibold mb-1">Follower Growth</p>
        <p className="text-xs text-muted-foreground mb-4">
          {data.followerGrowthChart ? "Real data from Instagram API" : "Estimated trend — full growth history requires App Review"}
        </p>
        <SimpleLineChart data={chartData} />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          {chartData.map(d => <span key={d.date}>{d.date}</span>)}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Audience demographics */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
          <p className="font-semibold text-sm">Audience Demographics</p>

          {data.audienceDemographics.ageRanges.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Age ranges</p>
              {data.audienceDemographics.ageRanges.map(a => (
                <div key={a.range} className="flex items-center gap-3 mb-1.5 text-xs">
                  <span className="w-12 text-muted-foreground">{a.range}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full amber-gradient" style={{ width: `${a.pct}%` }} />
                  </div>
                  <span className="font-medium w-8 text-right">{a.pct}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Audience demographics require Meta App Review for access.
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground mb-2">Gender split</p>
            <div className="h-3 rounded-full bg-muted overflow-hidden flex">
              <div className="h-full bg-blue-400 transition-all" style={{ width: `${data.audienceDemographics.genderSplit.male}%` }} />
              <div className="h-full bg-pink-400" style={{ width: `${data.audienceDemographics.genderSplit.female}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>♂ Male {data.audienceDemographics.genderSplit.male}%</span>
              <span>♀ Female {data.audienceDemographics.genderSplit.female}%</span>
            </div>
          </div>

          {data.audienceDemographics.topLocations.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Top locations</p>
              <div className="flex flex-wrap gap-1.5">
                {data.audienceDemographics.topLocations.map((loc, i) => (
                  <span key={loc} className={`px-2.5 py-1 rounded-full text-xs font-medium ${i === 0 ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}>
                    {loc}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Best times */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
          <p className="font-semibold text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Best Times to Post
          </p>
          <p className="text-xs text-muted-foreground">
            Recommended for Indian Instagram creators in your niche
          </p>
          <div className="space-y-2">
            {[
              { time: "Mon 7–9 PM IST", rank: 1 },
              { time: "Wed 7–9 PM IST", rank: 2 },
              { time: "Fri 8–10 PM IST", rank: 3 },
              { time: "Sun 6–8 PM IST", rank: 4 },
            ].map((item, i) => (
              <div key={item.time} className={`flex items-center gap-3 p-3 rounded-xl text-sm ${i === 0 ? "border border-amber-400/30 bg-amber-400/5" : "bg-muted/30"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}>
                  {item.rank}
                </span>
                <span className="font-medium">{item.time}</span>
                {i === 0 && <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 font-medium">Best ⭐</span>}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Personalized best times require audience insights (Meta App Review).
          </p>
        </div>
      </div>

      {/* Top posts */}
      {data.topPosts.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="font-semibold text-sm">Top Performing Posts (by Engagement)</p>
          </div>
          <div className="divide-y divide-border">
            {data.topPosts.map((post, i) => (
              <div key={post.id} className="px-5 py-4 flex items-center gap-4">
                <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{post.caption}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{post.type}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{fmt(post.likes)}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{post.comments}</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{post.er}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
