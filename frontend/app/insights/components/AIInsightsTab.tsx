import { useState, useEffect } from "react";
import { Loader2, Sparkles, TrendingUp, AlertTriangle, Clock, Lightbulb } from "lucide-react";

export default function AIInsightsTab({ accountId, platform = "instagram" }: { accountId?: string, platform?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    
    async function fetchData() {
      setLoading(true);
      try {
        // Mocking AI response for the UI. In production, this hits /api/insights/generate-ai
        setTimeout(() => {
          setData({
            executiveSummary: "Your reach grew by 12% this week, largely driven by your 3 new Reels. However, static image engagement dropped. Consider doubling down on short-form video hooks in the first 3 seconds.",
            bestPostingTime: {
              days: ["Wednesday", "Friday"],
              hours: ["6:00 PM", "12:00 PM"],
              confidenceScore: 85
            },
            profileHealth: {
              bioOptimization: "Add a clear CTA pointing to your latest offer.",
              ctaQuality: "Your link tree has too many links. Reduce to top 3.",
              completeness: "90%",
              seoOptimization: "Add 'UGC Creator' to your display name."
            },
            topPostsAnalysis: [
              {
                postId: "12345",
                hookAnalysis: "The fast pacing and bold text hook captured attention immediately.",
                bodyAnalysis: "Retention held strong due to quick scene cuts every 2 seconds.",
                ctaAnalysis: "Clear call to 'save for later' resulted in 400 saves."
              }
            ],
            underperformingPostsAnalysis: [
              {
                postId: "67890",
                reason: "Static image with too much text in the caption, people scrolled past.",
                suggestion: "Turn this carousel into a 15-second Reel with a trending audio track."
              }
            ]
          });
          setLoading(false);
        }, 1200);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    }
    fetchData();
  }, [accountId, platform]);

  if (!accountId) {
    return (
      <div className="p-12 text-center border border-zinc-800 rounded-2xl bg-zinc-900/50">
        <p className="text-zinc-500">Please select an account to view AI insights.</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-24 gap-4">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-zinc-400 text-sm animate-pulse">AI is analyzing your metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Executive Summary */}
      <div className="p-6 rounded-3xl border border-amber-500/30 bg-amber-500/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
        <h3 className="font-bold text-amber-500 flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5" /> Executive Summary
        </h3>
        <p className="text-zinc-200 leading-relaxed text-sm">{data.executiveSummary}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Posts Analysis */}
        <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900 shadow-sm">
          <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-green-500" /> What's Working
          </h3>
          <div className="space-y-4">
            {data.topPostsAnalysis.map((post: any, i: number) => (
              <div key={i} className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                <p className="text-xs font-semibold text-zinc-300 mb-2">Post #{i+1}</p>
                <div className="space-y-2 text-xs text-zinc-400">
                  <p><strong className="text-zinc-300">Hook:</strong> {post.hookAnalysis}</p>
                  <p><strong className="text-zinc-300">Body:</strong> {post.bodyAnalysis}</p>
                  <p><strong className="text-zinc-300">CTA:</strong> {post.ctaAnalysis}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Underperforming Posts */}
        <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900 shadow-sm">
          <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Areas for Improvement
          </h3>
          <div className="space-y-4">
            {data.underperformingPostsAnalysis.map((post: any, i: number) => (
              <div key={i} className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 border-l-2 border-l-red-500">
                <p className="text-xs text-zinc-400 mb-2"><strong className="text-zinc-300">Issue:</strong> {post.reason}</p>
                <p className="text-xs text-zinc-400"><strong className="text-amber-500">Suggestion:</strong> {post.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Best Time to Post & Profile Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900 shadow-sm">
          <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-blue-500" /> Optimal Posting Schedule
          </h3>
          <div className="space-y-3">
            {data.bestPostingTime.days.map((day: string, i: number) => (
              <div key={i} className="flex justify-between items-center p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <span className="text-sm font-medium text-zinc-300">{day}</span>
                <span className="text-sm font-bold text-blue-400">{data.bestPostingTime.hours[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900 shadow-sm">
          <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-amber-500" /> Profile Optimization
          </h3>
          <div className="space-y-3 text-xs text-zinc-400">
            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
              <strong className="text-zinc-300 block mb-1">Bio & SEO:</strong>
              {data.profileHealth.bioOptimization} {data.profileHealth.seoOptimization}
            </div>
            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
              <strong className="text-zinc-300 block mb-1">Link in Bio:</strong>
              {data.profileHealth.ctaQuality}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
