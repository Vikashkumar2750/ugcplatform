"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Users, Heart, MessageCircle,
  Eye, Clock, Camera, AlertCircle, BarChart3, RefreshCw
} from "lucide-react";

// Mock data — replaced by real Graph API data once connected
const MOCK_INSIGHTS = {
  connected: false,
  handle: "@your_account",
  followers: 12400,
  followersGrowth: +234,
  followersGrowthPct: 1.9,
  avgReach: 8200,
  avgImpressions: 14500,
  engagementRate: 3.8,
  profileVisits: 1240,
  websiteClicks: 89,
  bestTimes: ["Mon 7–9 PM", "Wed 7–9 PM", "Fri 8–10 PM", "Sun 6–8 PM"],
  audienceDemographics: {
    ageRanges: [
      { range: "18–24", pct: 28 },
      { range: "25–34", pct: 42 },
      { range: "35–44", pct: 18 },
      { range: "45+", pct: 12 },
    ],
    topLocations: ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Pune"],
    genderSplit: { male: 62, female: 38 },
  },
  followerGrowthChart: [
    { date: "May 1", followers: 11900 },
    { date: "May 6", followers: 12050 },
    { date: "May 11", followers: 12180 },
    { date: "May 16", followers: 12250 },
    { date: "May 21", followers: 12320 },
    { date: "May 26", followers: 12400 },
  ],
  topPosts: [
    { id: 1, type: "Reel", caption: "Yeh ek cheez hai jo main chahta tha ki...", likes: 892, comments: 67, reach: 12400, er: 7.8 },
    { id: 2, type: "Carousel", caption: "5 mistakes sabhi Indian creators karte hain...", likes: 643, comments: 89, reach: 9800, er: 7.5 },
    { id: 3, type: "Reel", caption: "Maine ₹0 se shuru kiya tha — aaj yeh hai...", likes: 521, comments: 43, reach: 8100, er: 6.9 },
  ],
};

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
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2" fill="#f59e0b" />
      ))}
    </svg>
  );
}

export default function InstagramInsightsPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [igConnected, setIgConnected] = useState<boolean | null>(null); // null = loading
  const [connectedAccount, setConnectedAccount] = useState<{platform_username: string} | null>(null);
  const data = MOCK_INSIGHTS;

  useEffect(() => {
    fetch("/api/connect/accounts")
      .then(r => r.json())
      .then(d => {
        const accounts: any[] = d.accounts || [];
        const ig = accounts.find(a => a.platform === "instagram");
        setIgConnected(!!ig);
        if (ig) setConnectedAccount(ig);
      })
      .catch(() => setIgConnected(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1500));
    setRefreshing(false);
  };

  // Loading state
  if (igConnected === null) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mt-12 text-center space-y-4 animate-pulse">
          <div className="w-14 h-14 rounded-full bg-muted mx-auto" />
          <div className="h-4 w-48 bg-muted rounded mx-auto" />
          <div className="h-3 w-64 bg-muted rounded mx-auto" />
        </div>
      </div>
    );
  }

  if (!igConnected) {
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

          {/* Preview of what they'll see */}
          <div className="mt-10 text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-center mb-6">Preview — what you'll see after connecting</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 opacity-40 pointer-events-none blur-sm">
              <StatCard label="Followers" value="12,400" subLabel="+234 this week" trend={1} />
              <StatCard label="Avg Reach" value="8,200" subLabel="per post" />
              <StatCard label="Engagement Rate" value="3.8%" subLabel="+0.4% vs last month" trend={1} />
              <StatCard label="Profile Visits" value="1,240" subLabel="this week" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Instagram Insights</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{data.handle} · Last 30 days</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted/60 transition">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Followers" value={data.followers.toLocaleString("en-IN")} subLabel={`+${data.followersGrowth} this week`} trend={1} />
        <StatCard label="Avg Reach" value={data.avgReach.toLocaleString("en-IN")} subLabel="per post" />
        <StatCard label="Engagement Rate" value={`${data.engagementRate}%`} subLabel="above 3% is good" trend={1} />
        <StatCard label="Profile Visits" value={data.profileVisits.toLocaleString("en-IN")} subLabel="this week" />
      </div>

      {/* Follower growth chart */}
      <div className="p-5 rounded-2xl border border-border bg-card">
        <p className="text-sm font-semibold mb-1">Follower Growth</p>
        <p className="text-xs text-muted-foreground mb-4">Last 30 days</p>
        <SimpleLineChart data={data.followerGrowthChart} />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          {data.followerGrowthChart.map(d => <span key={d.date}>{d.date}</span>)}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Audience demographics */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
          <p className="font-semibold text-sm">Audience Demographics</p>

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
        </div>

        {/* Best times */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
          <p className="font-semibold text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Best Times to Post
          </p>
          <p className="text-xs text-muted-foreground">Based on when your audience is most active on Instagram</p>
          <div className="space-y-2">
            {data.bestTimes.map((time, i) => (
              <div key={time} className={`flex items-center gap-3 p-3 rounded-xl text-sm ${i === 0 ? "border border-amber-400/30 bg-amber-400/5" : "bg-muted/30"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <span className="font-medium">{time}</span>
                {i === 0 && <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 font-medium">Best ⭐</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top posts */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="font-semibold text-sm">Top Performing Posts (Last 30 Days)</p>
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
                <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{post.likes.toLocaleString()}</span>
                <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{post.comments}</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.reach.toLocaleString()}</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{post.er}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
