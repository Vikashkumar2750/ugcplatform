import { useState, useEffect } from "react";
import { Loader2, Sparkles, TrendingUp, AlertTriangle, Clock, Lightbulb, Target, CheckCircle2, FileText, PlayCircle, Users, Star } from "lucide-react";
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
    const isPermissionError = error.includes("pages_read_engagement") || error.includes("Page Public Content Access");
    
    return (
      <div className="p-12 text-center border border-red-500/30 rounded-2xl bg-red-500/5 flex flex-col items-center gap-4">
        <div className="bg-red-500/10 p-3 rounded-full">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-red-500 mb-2">
            {isPermissionError ? "Meta App Configuration Required" : "Failed to load insights"}
          </h3>
          <p className="text-red-500/80 max-w-lg mx-auto text-sm">
            {isPermissionError 
              ? "Your Meta Developer App is blocking access to page posts. Even if you granted the permission during login, Meta requires your app to either be in 'Development Mode' or have the 'Page Public Content Access' feature approved in App Review to read posts via the API."
              : error}
          </p>
        </div>
        {isPermissionError && (
          <div className="flex gap-4 mt-2">
            <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="px-6 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors">
              Go to Meta Dashboard
            </a>
            <a href="/connect" className="px-6 py-2 bg-card text-foreground border border-border font-medium rounded-lg hover:bg-muted transition-colors">
              Try Reconnecting
            </a>
          </div>
        )}
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
                <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                  {post.analysis ? (
                    <p>{post.analysis}</p>
                  ) : (
                    <>
                      <p><strong className="text-foreground">Hook:</strong> {post.hookAnalysis}</p>
                      <p><strong className="text-foreground">Body:</strong> {post.bodyAnalysis}</p>
                      <p><strong className="text-foreground">CTA:</strong> {post.ctaAnalysis}</p>
                    </>
                  )}
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
            {typeof data.bestPostingTime === "string" ? (
              <div className="p-4 bg-muted/30 rounded-xl border border-border text-sm text-foreground">
                {data.bestPostingTime}
              </div>
            ) : data.bestPostingTime?.days?.map((day: string, i: number) => (
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

      {/* 10 Hooks & Trending Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {data.attentionHooks && (
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
              <Lightbulb className="w-4 h-4 text-yellow-500" /> 10 Attention Grabbing Hooks
            </h3>
            <ul className="space-y-2 list-disc list-inside text-xs text-muted-foreground">
              {data.attentionHooks.map((hook: string, i: number) => (
                <li key={i} className="leading-relaxed">{hook}</li>
              ))}
            </ul>
          </div>
        )}
        {data.trendingTopics && (
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-green-500" /> 10 Trending Topics in Niche
            </h3>
            <ul className="space-y-2 list-disc list-inside text-xs text-muted-foreground">
              {data.trendingTopics.map((topic: string, i: number) => (
                <li key={i} className="leading-relaxed">{topic}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 5 Reel Scripts */}
      {data.reelScripts && data.reelScripts.length > 0 && (
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm mt-6">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-purple-500" /> 5 Ready-To-Shoot Reel Scripts (Face Included)
          </h3>
          <div className="space-y-6">
            {data.reelScripts.map((script: any, i: number) => (
              <div key={i} className="p-5 bg-muted/20 rounded-2xl border border-border">
                <h4 className="text-sm font-bold mb-3 text-foreground">Script {i + 1}: {script.topic}</h4>
                <div className="space-y-3 text-xs">
                  <div>
                    <strong className="text-amber-500">Hooks (Choose 1):</strong>
                    <ul className="list-disc list-inside text-muted-foreground mt-1 ml-1 space-y-1">
                      {script.hooks?.map((h: string, j: number) => <li key={j}>{h}</li>)}
                    </ul>
                  </div>
                  <div>
                    <strong className="text-blue-500">Body / Script:</strong>
                    <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{script.body}</p>
                  </div>
                  <div>
                    <strong className="text-green-500">Call to Action:</strong>
                    <p className="text-muted-foreground mt-1">{script.cta}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Optimization & Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {data.profileOptimization && (
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-indigo-500" /> Full Profile Optimization
            </h3>
            <div className="space-y-4 text-xs text-muted-foreground">
              <div className="p-3 bg-muted/30 rounded-xl border border-border">
                <strong className="text-foreground block mb-1">Name (SEO):</strong> {data.profileOptimization.name}
              </div>
              <div className="p-3 bg-muted/30 rounded-xl border border-border">
                <strong className="text-foreground block mb-1">Bio:</strong> {data.profileOptimization.bio}
              </div>
              <div className="p-3 bg-muted/30 rounded-xl border border-border">
                <strong className="text-foreground block mb-1">Links Strategy (AI Lead Gen):</strong> {data.profileOptimization.links}
              </div>
              <div className="p-3 bg-muted/30 rounded-xl border border-border">
                <strong className="text-foreground block mb-1">Details:</strong> {data.profileOptimization.details}
              </div>
            </div>
          </div>
        )}

        {data.accountHighlights && (
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-amber-500" /> Account Highlights Strategy
            </h3>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {data.accountHighlights}
            </p>
          </div>
        )}
      </div>

      {/* Guides & Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {data.viralChecklist && (
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Post-Reel Viral Checklist
            </h3>
            <ul className="space-y-2 list-none text-xs text-muted-foreground">
              {data.viralChecklist.map((task: string, i: number) => (
                <li key={i} className="flex gap-2">
                  <div className="w-4 h-4 rounded-full border border-border flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{task}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-6">
          {data.captionGuide && (
            <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-orange-500" /> Caption & Hashtag Guide
              </h3>
              <div className="space-y-3 text-xs text-muted-foreground">
                <p><strong>How to write:</strong> {data.captionGuide.howToWrite}</p>
                <p><strong>Hashtags Count:</strong> {data.captionGuide.hashtagsCount}</p>
                <p><strong>What to use:</strong> {data.captionGuide.hashtagsToUse}</p>
                <p><strong>How to find:</strong> {data.captionGuide.howToFind}</p>
              </div>
            </div>
          )}

          {data.trialReelGuide && (
            <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
                <PlayCircle className="w-4 h-4 text-pink-500" /> Trial Reel Usage
              </h3>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {data.trialReelGuide}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Suitability & Current Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {data.contentSuitability && (
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-cyan-500" /> Content Suitability
            </h3>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {data.contentSuitability}
            </p>
          </div>
        )}
        {data.currentTrendingTopics && (
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-rose-500" /> 5 Current Trending Topics
            </h3>
            <ul className="space-y-2 list-disc list-inside text-xs text-muted-foreground">
              {data.currentTrendingTopics.map((topic: string, i: number) => (
                <li key={i} className="leading-relaxed">{topic}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

    </div>
  );
}
