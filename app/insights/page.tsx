"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Heart, MessageCircle, Bookmark,
  Share2, Eye, Users, Clock, Camera, BarChart3, RefreshCw,
  Loader2, AlertCircle, CheckCircle2, ArrowUpRight, ExternalLink,
  ThumbsUp, ThumbsDown, Globe
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
interface InsightsData {
  connected: boolean;
  handle: string;
  name: string;
  followers: number;
  following: number;
  followersGrowth: number;
  followersGrowthPct: number;
  mediaCount: number;
  avgReach: number;
  avgImpressions: number;
  engagementRate: number;
  profileVisits: number;
  avgLikes: number;
  avgComments: number;
  avgSaves: number;
  postsAnalyzed: number;
  followerGrowthChart: { date: string; followers: number }[] | null;
  audienceDemographics: {
    ageRanges: { range: string; pct: number }[];
    topLocations: string[];
    genderSplit: { male: number; female: number };
  };
  topPosts: {
    id: number; postId: string; type: string; caption: string;
    thumbnail: string; permalink: string;
    likes: number; comments: number; saves: number; shares: number;
    reach: number; er: string;
  }[];
  accountType: string;
  connectedAt: string;
}

function fmt(n: number) {
  if (!n || isNaN(n)) return "—";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
}

// ── Stat Card ──────────────────────────────────────────────────────
function StatCard({
  label, value, subLabel, trend, icon: Icon, highlight
}: {
  label: string; value: string; subLabel?: string;
  trend?: "up" | "down" | "neutral"; icon?: any; highlight?: boolean;
}) {
  return (
    <div className={`p-5 rounded-2xl border bg-card flex flex-col gap-2 ${highlight ? "border-amber-400/40 bg-amber-400/5" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        {Icon && <Icon className={`w-4 h-4 ${highlight ? "text-amber-500" : "text-muted-foreground/50"}`} />}
      </div>
      <p className="font-heading text-2xl font-bold tracking-tight">{value}</p>
      {subLabel && (
        <p className={`text-xs flex items-center gap-1 ${
          trend === "up" ? "text-green-500" :
          trend === "down" ? "text-red-400" : "text-muted-foreground"}`}>
          {trend === "up" && <TrendingUp className="w-3 h-3" />}
          {trend === "down" && <TrendingDown className="w-3 h-3" />}
          {subLabel}
        </p>
      )}
    </div>
  );
}

// ── Mini Line Chart ────────────────────────────────────────────────
function LineChart({ data }: { data: { date: string; followers: number }[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data.map(d => d.followers));
  const max = Math.max(...data.map(d => d.followers));
  const range = max - min || 1;
  const W = 100; const H = 60;
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((d.followers - min) / range) * H * 0.85 - H * 0.075,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${W} ${H} L 0 ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
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

// ── Insight Tag (positives/negatives) ─────────────────────────────
function InsightTag({ type, text }: { type: "positive" | "negative" | "tip"; text: string }) {
  if (type === "positive") return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-green-500/8 border border-green-500/20">
      <ThumbsUp className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-green-600 dark:text-green-400">{text}</p>
    </div>
  );
  if (type === "negative") return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/8 border border-red-500/20">
      <ThumbsDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-red-500 dark:text-red-400">{text}</p>
    </div>
  );
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
      <TrendingUp className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-600 dark:text-amber-400">{text}</p>
    </div>
  );
}

// ── Generate Insights from data ───────────────────────────────────
function generateInsights(data: InsightsData) {
  const positives: string[] = [];
  const negatives: string[] = [];
  const tips: string[] = [];

  const er = data.engagementRate;
  if (er >= 6) positives.push(`Engagement rate ${er}% bahut strong hai — industry average 3-6% se kaafi upar! 🔥`);
  else if (er >= 3) positives.push(`Engagement rate ${er}% healthy range mein hai (3-6% good maana jaata hai) ✓`);
  else negatives.push(`Engagement rate ${er}% low hai. Target: 3%+. Captions mein strong CTA add karo.`);

  if (data.avgSaves > data.avgLikes * 0.1) positives.push(`Saves ratio good hai — content valuable & saveable hai. Log dobara dekhte hain.`);
  else if (data.avgSaves === 0) tips.push("Posts mein 'Save this!' CTA add karo — saves algorithm mein bahut important hain.");

  if (data.followers > 1000) positives.push(`${fmt(data.followers)} followers ke saath decent audience base hai ✓`);
  if (data.followers < 500) tips.push("Follower count badhane ke liye daily Stories + weekly Reels strategy follow karo.");

  if (data.postsAnalyzed < 10) negatives.push(`Sirf ${data.postsAnalyzed} posts analyzed — zyada posts karo taaki algorithm push mile.`);
  else positives.push(`${data.postsAnalyzed} recent posts analyzed — consistency achhi hai ✓`);

  if (data.avgReach > 0 && data.avgReach < data.followers * 0.1)
    negatives.push("Reach followers ka 10% se kam hai — more hashtags + collaborations try karo.");

  if (data.avgComments < 2) tips.push("Comments badhane ke liye post end mein question zaroor poocho.");

  return { positives, negatives, tips };
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
    else setLoading(true);
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

  if (loading) return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mt-20 text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin mx-auto text-amber-500" />
        <p className="text-muted-foreground text-sm">Instagram se real data fetch ho raha hai...</p>
        <p className="text-xs text-muted-foreground">Pehli baar 10-15 seconds lag sakte hain</p>
      </div>
    </div>
  );

  if (notConnected) return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mt-12 text-center space-y-4">
        <Camera className="w-14 h-14 mx-auto text-muted-foreground/30" />
        <h2 className="font-heading text-xl font-bold">Instagram Connect nahi hai</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Instagram Business ya Creator account connect karo real insights dekhne ke liye.
        </p>
        <Link href="/connect" className="btn-amber px-6 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2">
          <Camera className="w-4 h-4" /> Connect Instagram
        </Link>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mt-12 text-center space-y-4">
        <AlertCircle className="w-12 h-12 mx-auto text-amber-500/50" />
        <h2 className="font-heading text-lg font-bold">Insights load nahi hue</h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">{error || "Unknown error"}</p>
        <button onClick={() => fetchInsights(true)}
          className="btn-amber px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  );

  const chartData = data.followerGrowthChart || [
    { date: "Week 1", followers: Math.round(data.followers * 0.94) },
    { date: "Week 2", followers: Math.round(data.followers * 0.97) },
    { date: "Week 3", followers: Math.round(data.followers * 0.99) },
    { date: "Now", followers: data.followers },
  ];

  const { positives, negatives, tips } = generateInsights(data);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Instagram Insights</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {data.handle} · {data.accountType || "CREATOR"} · {data.postsAnalyzed} posts analyzed
          </p>
        </div>
        <button onClick={() => fetchInsights(true)} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted/60 transition flex-shrink-0">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Followers" value={fmt(data.followers)} icon={Users}
          subLabel={data.following > 0 ? `Following ${fmt(data.following)}` : `${data.postsAnalyzed} posts`} />
        <StatCard label="Engagement Rate" value={`${data.engagementRate}%`} icon={BarChart3}
          subLabel={data.engagementRate >= 3 ? "3%+ = good ✓" : "Below average — needs work"} highlight={data.engagementRate >= 3}
          trend={data.engagementRate >= 3 ? "up" : "down"} />
        <StatCard label="Avg Likes" value={fmt(data.avgLikes)} icon={Heart} subLabel="per post" />
        <StatCard label="Avg Comments" value={fmt(data.avgComments)} icon={MessageCircle} subLabel="per post" />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Avg Saves" value={data.avgSaves > 0 ? fmt(data.avgSaves) : "—"} icon={Bookmark}
          subLabel={data.avgSaves > 0 ? "per post" : "Track saves carefully"} />
        <StatCard label="Avg Reach" value={data.avgReach > 0 ? fmt(data.avgReach) : "—"} icon={Eye}
          subLabel={data.avgReach > 0 ? "per post (API)" : "Limited by API"} />
        <StatCard label="Profile Visits" value={data.profileVisits > 0 ? fmt(data.profileVisits) : "—"} icon={ArrowUpRight}
          subLabel={data.profileVisits > 0 ? "last 30 days" : "From account insights"} />
        <StatCard label="Total Posts" value={fmt(data.mediaCount)} icon={Camera} subLabel="on your profile" />
      </div>

      {/* Growth Chart */}
      <div className="p-5 rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold">Follower Growth</p>
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
            {data.followerGrowthChart ? "Live API data" : "Estimated trend"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {data.followerGrowthChart ? "Real follower count changes" : "Estimated based on current followers"}
        </p>
        <LineChart data={chartData} />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
          {chartData.map(d => <span key={d.date}>{d.date}</span>)}
        </div>
      </div>

      {/* Positives / Negatives */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-500" />
          <p className="font-semibold text-sm">Account Analysis</p>
        </div>
        <p className="text-xs text-muted-foreground">Tere account ki strengths aur improvements based on current data</p>

        {positives.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-green-500 uppercase tracking-wider">✅ Kya Achha Chal Raha Hai</p>
            {positives.map((t, i) => <InsightTag key={i} type="positive" text={t} />)}
          </div>
        )}
        {negatives.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider mt-3">⚠️ Improve Karna Chahiye</p>
            {negatives.map((t, i) => <InsightTag key={i} type="negative" text={t} />)}
          </div>
        )}
        {tips.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mt-3">💡 Pro Tips</p>
            {tips.map((t, i) => <InsightTag key={i} type="tip" text={t} />)}
          </div>
        )}
      </div>

      {/* Top Posts */}
      {data.topPosts.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="font-semibold text-sm">Top Performing Posts</p>
            <p className="text-xs text-muted-foreground mt-0.5">Likes + Comments + Saves se sort kiya gaya</p>
          </div>
          <div className="divide-y divide-border">
            {data.topPosts.map((post, i) => (
              <div key={post.id} className="px-5 py-4 flex items-center gap-4 hover:bg-muted/20 transition">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </span>
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {post.thumbnail ? (
                    <img src={post.thumbnail} alt="" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-4 h-4 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{post.caption || `${post.type} post`}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{post.type}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{fmt(post.likes)}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{fmt(post.comments)}</span>
                  {post.saves > 0 && <span className="flex items-center gap-1"><Bookmark className="w-3 h-3" />{fmt(post.saves)}</span>}
                  {post.reach > 0 && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{fmt(post.reach)}</span>}
                  <span className="font-bold text-amber-600 dark:text-amber-400">{post.er}%</span>
                  {post.permalink && (
                    <a href={post.permalink} target="_blank" rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audience + Best Times */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Demographics */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
          <p className="font-semibold text-sm">Audience Demographics</p>

          {data.audienceDemographics.ageRanges.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Age Ranges</p>
              {data.audienceDemographics.ageRanges.map(a => (
                <div key={a.range} className="flex items-center gap-3 mb-2 text-xs">
                  <span className="w-12 text-muted-foreground">{a.range}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full amber-gradient" style={{ width: `${a.pct}%` }} />
                  </div>
                  <span className="font-medium w-8 text-right">{a.pct}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg">
              Audience demographics abhi available nahi hain — account insights se aayenge jab account 100+ followers ka ho.
            </p>
          )}

          <div>
            <p className="text-xs text-muted-foreground mb-2">Gender Split</p>
            <div className="h-3 rounded-full bg-muted overflow-hidden flex">
              <div className="h-full bg-blue-400 transition-all" style={{ width: `${data.audienceDemographics.genderSplit.male}%` }} />
              <div className="h-full bg-pink-400" style={{ width: `${data.audienceDemographics.genderSplit.female}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
              <span>♂ Male {data.audienceDemographics.genderSplit.male}%</span>
              <span>♀ Female {data.audienceDemographics.genderSplit.female}%</span>
            </div>
          </div>

          {data.audienceDemographics.topLocations.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Top Locations</p>
              <div className="flex flex-wrap gap-1.5">
                {data.audienceDemographics.topLocations.map((loc, i) => (
                  <span key={loc} className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    i === 0 ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}>
                    {loc}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Best Times */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="font-semibold text-sm">Best Times to Post</p>
          </div>
          <p className="text-xs text-muted-foreground">Indian creators ke liye recommended (IST)</p>
          <div className="space-y-2">
            {[
              { day: "Mon", time: "7–9 PM", label: "Best for B2B & Tech", rank: 1 },
              { day: "Wed", time: "7–9 PM", label: "Mid-week peak", rank: 2 },
              { day: "Fri", time: "8–10 PM", label: "Weekend vibe", rank: 3 },
              { day: "Sun", time: "6–8 PM", label: "High leisure time", rank: 4 },
            ].map((item, i) => (
              <div key={item.day} className={`flex items-center gap-3 p-3 rounded-xl text-sm ${
                i === 0 ? "border border-amber-400/30 bg-amber-400/5" : "bg-muted/30"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}>
                  {item.rank}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{item.day} {item.time} IST</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
                {i === 0 && <span className="text-xs text-amber-500 font-bold">Best ⭐</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
