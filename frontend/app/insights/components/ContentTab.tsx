import { useState, useEffect } from "react";
import { AlertCircle, PlayCircle, Image as ImageIcon, Loader2, X, AlertTriangle } from "lucide-react";
import { fetchWithCache } from "../lib/fetchWithCache";

export default function ContentTab({ timeRange, accountId, platform = "instagram" }: { timeRange: string, accountId?: string, platform?: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [selectedPost, setSelectedPost] = useState<any>(null);

  useEffect(() => {
    if (!accountId) return;
    
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const json = await fetchWithCache(`/api/insights/proxy/${platform}/${accountId}/media?limit=30`);
        setData(json.data || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [timeRange, accountId, platform]);

  if (!accountId) {
    return (
      <div className="p-12 text-center border border-border rounded-2xl bg-card">
        <p className="text-muted-foreground">Please select an account to view insights.</p>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  const filteredData = data.filter(p => {
    if (filter === "reels") return p.media_type === "VIDEO";
    if (filter === "posts") return p.media_type === "IMAGE" || p.media_type === "CAROUSEL_ALBUM";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => setFilter("all")} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === 'all' ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>All Content</button>
        <button onClick={() => setFilter("reels")} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === 'reels' ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Reels</button>
        <button onClick={() => setFilter("posts")} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === 'posts' ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Posts</button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden min-h-[400px]">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-5 py-4">Post</th>
              <th className="px-5 py-4 text-right">Reach</th>
              <th className="px-5 py-4 text-right">Views</th>
              <th className="px-5 py-4 text-right">Likes</th>
              <th className="px-5 py-4 text-right">Comments</th>
              <th className="px-5 py-4 text-right">Saves</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredData.map((post) => (
              <tr key={post.id} className="hover:bg-muted/30 transition-colors cursor-pointer group" onClick={() => setSelectedPost(post)}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden relative flex-shrink-0 border border-border group-hover:border-primary/50 transition-colors">
                      <img src={post.thumbnail_url || post.media_url} alt="thumbnail" className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 bg-black/60 rounded p-0.5 backdrop-blur-sm">
                        {post.media_type === "VIDEO" ? <PlayCircle className="w-3 h-3 text-white" /> : <ImageIcon className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <div>
                      <p className="text-foreground text-xs font-medium line-clamp-1 max-w-[200px]">{post.caption || "No caption"}</p>
                      <p className="text-muted-foreground text-[10px] mt-1">{new Date(post.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-right font-medium text-foreground">{post.insights?.reach?.toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-medium text-foreground">{post.insights?.impressions?.toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-medium text-foreground">{post.like_count?.toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-medium text-foreground">{post.comments_count?.toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-medium text-foreground">{post.insights?.saved?.toLocaleString()}</td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-muted-foreground">No media found for this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 rounded-xl bg-muted/50 border border-border flex gap-3 text-muted-foreground text-sm items-start">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed"><strong>Note on Advanced Metrics:</strong> Metrics like "Average Watch Time", "Retention Curves", and "Followers Generated" are natively restricted by the Meta Graph API. Third-party platforms claiming to provide these are estimating or fabricating data.</p>
      </div>

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="font-bold text-foreground">Post Insights</h3>
              <button onClick={() => setSelectedPost(null)} className="p-2 bg-muted hover:bg-muted/80 rounded-full transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="flex gap-6">
                <div className="w-32 h-40 rounded-xl overflow-hidden border border-border flex-shrink-0">
                   <img src={selectedPost.thumbnail_url || selectedPost.media_url} className="w-full h-full object-cover" alt="Post" />
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-sm text-foreground">{selectedPost.caption}</p>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-muted border border-border rounded text-xs text-muted-foreground font-medium">{selectedPost.media_type}</span>
                    <span className="px-2 py-1 bg-muted border border-border rounded text-xs text-muted-foreground font-medium">{new Date(selectedPost.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Reach</p>
                  <p className="text-xl font-bold text-foreground">{selectedPost.insights?.reach?.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Impressions</p>
                  <p className="text-xl font-bold text-foreground">{selectedPost.insights?.impressions?.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Engagement (Likes+Comments)</p>
                  <p className="text-xl font-bold text-foreground">{((selectedPost.like_count || 0) + (selectedPost.comments_count || 0)).toLocaleString()}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Saves</p>
                  <p className="text-xl font-bold text-foreground">{selectedPost.insights?.saved?.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Shares</p>
                  <p className="text-xl font-bold text-foreground">{selectedPost.insights?.shares?.toLocaleString()}</p>
                </div>
              </div>

              {/* Explicit Missing Metrics Section */}
              <div className="border border-amber-500/30 bg-amber-500/10 rounded-2xl p-5 mt-4">
                <h4 className="flex items-center gap-2 text-amber-600 dark:text-amber-500 text-sm font-bold mb-4">
                  <AlertTriangle className="w-4 h-4" /> Not Available via API
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center opacity-70">
                    <div>
                      <p className="text-sm font-medium text-foreground">Average Watch Time</p>
                      <p className="text-xs text-muted-foreground">Restricted to native Instagram App only.</p>
                    </div>
                    <span className="text-sm font-mono bg-muted px-3 py-1 rounded text-muted-foreground">N/A</span>
                  </div>
                  <div className="flex justify-between items-center opacity-70">
                    <div>
                      <p className="text-sm font-medium text-foreground">Audience Retention Curve</p>
                      <p className="text-xs text-muted-foreground">Graph API does not expose video retention data.</p>
                    </div>
                    <span className="text-sm font-mono bg-muted px-3 py-1 rounded text-muted-foreground">N/A</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
