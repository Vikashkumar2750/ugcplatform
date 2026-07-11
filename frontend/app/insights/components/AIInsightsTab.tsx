import { useState, useEffect } from "react";
import { Loader2, Sparkles, TrendingUp, AlertTriangle, Clock, Lightbulb } from "lucide-react";
import { fetchWithCache } from "../lib/fetchWithCache";

export default function AIInsightsTab({ accountId, platform = "instagram" }: { accountId?: string, platform?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (!accountId) return;
    
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch basic stats to feed the AI
        const overviewRes = await fetchWithCache(`/api/insights/proxy/${platform}/${accountId}/overview?days=28`);
        const mediaRes = await fetchWithCache(`/api/insights/proxy/${platform}/${accountId}/media?limit=10`);
        
        let reach = 0, impressions = 0;
        if (overviewRes) {
          const metrics = overviewRes.data || [];
          const findMetric = (name: string) => {
            const m = metrics.find((m: any) => m.name === name);
            return m?.total_value?.value ?? m?.values?.[0]?.value ?? 0;
          };
          reach = findMetric("reach") || findMetric("page_impressions_unique") || 0;
          impressions = findMetric("impressions") || findMetric("page_impressions") || 0;
        }

        let topPosts = [];
        if (mediaRes) {
          const posts = mediaRes.data || [];
          topPosts = posts.slice(0, 3).map((p: any) => ({
            id: p.id,
            type: p.media_type,
            likes: p.like_count || 0,
            comments: p.comments_count || 0,
            reach: p.insights?.reach || 0,
            caption: p.caption ? p.caption.substring(0, 50) : ""
          }));
        }

        const statsData = {
          accountId,
          avgReach: reach / 28,
          avgImpressions: impressions / 28,
          topPosts
        };

        const json = await fetchWithCache("/api/insights/generate-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, statsData })
        });

        if (json.aiData) {
          setData(json.aiData);
        } else {
          throw new Error("No AI data returned");
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [accountId, platform]);

  if (!accountId) {
    return (
      <div className="p-12 text-center border border-border rounded-2xl bg-card">
        <p className="text-muted-foreground">Please select an account to view AI insights.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center border border-red-500/30 rounded-2xl bg-red-500/5">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-24 gap-4">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-muted-foreground text-sm animate-pulse">AI is analyzing your metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Executive Summary */}
      <div className="p-6 rounded-3xl border border-amber-500/30 bg-amber-500/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
        <h3 className="font-bold text-amber-600 dark:text-amber-500 flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5" /> Executive Summary
        </h3>
        <p className="text-foreground leading-relaxed text-sm">{data.executiveSummary}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Posts Analysis */}
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-green-500" /> What's Working
          </h3>
          <div className="space-y-4">
            {data.topPostsAnalysis?.map((post: any, i: number) => (
              <div key={i} className="p-4 bg-muted/30 rounded-2xl border border-border">
                <p className="text-xs font-semibold text-foreground mb-2">Post #{i+1}</p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p><strong className="text-foreground">Hook:</strong> {post.hookAnalysis}</p>
                  <p><strong className="text-foreground">Body:</strong> {post.bodyAnalysis}</p>
                  <p><strong className="text-foreground">CTA:</strong> {post.ctaAnalysis}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Underperforming Posts */}
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Areas for Improvement
          </h3>
          <div className="space-y-4">
            {data.underperformingPostsAnalysis?.map((post: any, i: number) => (
              <div key={i} className="p-4 bg-muted/30 rounded-2xl border border-border border-l-2 border-l-red-500">
                <p className="text-xs text-muted-foreground mb-2"><strong className="text-foreground">Issue:</strong> {post.reason}</p>
                <p className="text-xs text-muted-foreground"><strong className="text-amber-600 dark:text-amber-500">Suggestion:</strong> {post.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Best Time to Post & Profile Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-blue-500" /> Optimal Posting Schedule
          </h3>
          <div className="space-y-3">
            {data.bestPostingTime?.days?.map((day: string, i: number) => (
              <div key={i} className="flex justify-between items-center p-3 bg-muted/30 rounded-xl border border-border">
                <span className="text-sm font-medium text-foreground">{day}</span>
                <span className="text-sm font-bold text-blue-500 dark:text-blue-400">{data.bestPostingTime.hours[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-amber-500" /> Profile Optimization
          </h3>
          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="p-3 bg-muted/30 rounded-xl border border-border">
              <strong className="text-foreground block mb-1">Bio & SEO:</strong>
              {data.profileHealth?.bioOptimization} {data.profileHealth?.seoOptimization}
            </div>
            <div className="p-3 bg-muted/30 rounded-xl border border-border">
              <strong className="text-foreground block mb-1">Link in Bio:</strong>
              {data.profileHealth?.ctaQuality}
            </div>
          </div>
        </div>
      </div>

      {/* Content Improvement Strategy */}
      {data.contentImprovement && (
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-purple-500" /> Content Improvement Strategy
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/30 rounded-2xl border border-border">
              <strong className="text-foreground text-xs block mb-1">Reels & Videos:</strong>
              <p className="text-xs text-muted-foreground leading-relaxed">{data.contentImprovement.reels}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-2xl border border-border">
              <strong className="text-foreground text-xs block mb-1">Static Posts / Carousels:</strong>
              <p className="text-xs text-muted-foreground leading-relaxed">{data.contentImprovement.posts}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-2xl border border-border">
              <strong className="text-foreground text-xs block mb-1">Stories:</strong>
              <p className="text-xs text-muted-foreground leading-relaxed">{data.contentImprovement.stories}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-2xl border border-border">
              <strong className="text-foreground text-xs block mb-1">Profile Highlights:</strong>
              <p className="text-xs text-muted-foreground leading-relaxed">{data.contentImprovement.highlights}</p>
            </div>
          </div>
        </div>
      )}

      {/* Trending Reel Script */}
      {data.trendingReelScript && (
        <div className="p-6 rounded-3xl border border-blue-500/20 bg-blue-500/5 shadow-sm">
          <h3 className="font-semibold text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4" /> AI Generated Trending Script
          </h3>
          <div className="space-y-4">
            <div className="text-sm">
              <strong className="text-foreground">Topic:</strong> <span className="text-muted-foreground">{data.trendingReelScript.topic}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-card rounded-2xl border border-border/50">
                <strong className="text-blue-500 text-xs uppercase tracking-wider block mb-2">1. The Hook (0-3s)</strong>
                <p className="text-xs text-foreground leading-relaxed">"{data.trendingReelScript.hook}"</p>
              </div>
              <div className="p-4 bg-card rounded-2xl border border-border/50">
                <strong className="text-amber-500 text-xs uppercase tracking-wider block mb-2">2. The Body (3-15s)</strong>
                <p className="text-xs text-foreground leading-relaxed">{data.trendingReelScript.body}</p>
              </div>
              <div className="p-4 bg-card rounded-2xl border border-border/50">
                <strong className="text-green-500 text-xs uppercase tracking-wider block mb-2">3. The CTA (15s+)</strong>
                <p className="text-xs text-foreground leading-relaxed">"{data.trendingReelScript.cta}"</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
