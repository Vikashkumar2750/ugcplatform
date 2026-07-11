import { useState, useEffect } from "react";
import { AlertCircle, PlayCircle, Image as ImageIcon, Loader2, X, AlertTriangle } from "lucide-react";

export default function ContentTab({ timeRange, accountId, platform = "instagram" }: { timeRange: string, accountId?: string, platform?: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedPost, setSelectedPost] = useState<any>(null);

  useEffect(() => {
    if (!accountId) return;
    
    async function fetchData() {
      setLoading(true);
      try {
        // Mock data for UI layout representing enriched media
        setTimeout(() => {
          const mockPosts = Array.from({ length: 15 }).map((_, i) => ({
            id: `post_${i}`,
            timestamp: new Date(Date.now() - i * 86400000).toISOString(),
            media_type: i % 4 === 0 ? "CAROUSEL_ALBUM" : i % 2 === 0 ? "VIDEO" : "IMAGE",
            thumbnail_url: `https://picsum.photos/seed/${i}/150/150`,
            media_url: `https://picsum.photos/seed/${i}/400/400`,
            caption: `Exciting new post ${i}! #viral #trending...`,
            like_count: Math.floor(Math.random() * 5000),
            comments_count: Math.floor(Math.random() * 500),
            permalink: "#",
            insights: {
              reach: Math.floor(Math.random() * 25000),
              impressions: Math.floor(Math.random() * 30000),
              saved: Math.floor(Math.random() * 1000),
              shares: Math.floor(Math.random() * 500)
            }
          }));
          setData(mockPosts);
          setLoading(false);
        }, 800);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    }
    fetchData();
  }, [timeRange, accountId, platform]);

  if (!accountId) {
    return (
      <div className="p-12 text-center border border-zinc-800 rounded-2xl bg-zinc-900/50">
        <p className="text-zinc-500">Please select an account to view insights.</p>
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
        <button onClick={() => setFilter("all")} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === 'all' ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>All Content</button>
        <button onClick={() => setFilter("reels")} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === 'reels' ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>Reels</button>
        <button onClick={() => setFilter("posts")} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === 'posts' ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>Posts</button>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden min-h-[400px]">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[11px] uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-5 py-4">Post</th>
              <th className="px-5 py-4 text-right">Reach</th>
              <th className="px-5 py-4 text-right">Impressions</th>
              <th className="px-5 py-4 text-right">Likes</th>
              <th className="px-5 py-4 text-right">Comments</th>
              <th className="px-5 py-4 text-right">Saves</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {filteredData.map((post) => (
              <tr key={post.id} className="hover:bg-zinc-900/50 transition-colors cursor-pointer group" onClick={() => setSelectedPost(post)}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden relative flex-shrink-0 border border-zinc-700 group-hover:border-zinc-500 transition-colors">
                      <img src={post.thumbnail_url || post.media_url} alt="thumbnail" className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 bg-black/60 rounded p-0.5 backdrop-blur-sm">
                        {post.media_type === "VIDEO" ? <PlayCircle className="w-3 h-3 text-white" /> : <ImageIcon className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <div>
                      <p className="text-zinc-200 text-xs font-medium line-clamp-1 max-w-[200px]">{post.caption || "No caption"}</p>
                      <p className="text-zinc-500 text-[10px] mt-1">{new Date(post.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-right font-medium text-zinc-300">{post.insights?.reach?.toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-medium text-zinc-300">{post.insights?.impressions?.toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-medium text-zinc-300">{post.like_count?.toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-medium text-zinc-300">{post.comments_count?.toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-medium text-zinc-300">{post.insights?.saved?.toLocaleString()}</td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-zinc-500">No media found for this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex gap-3 text-zinc-400 text-sm items-start">
        <AlertCircle className="w-5 h-5 text-zinc-500 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed"><strong>Note on Advanced Metrics:</strong> Metrics like "Average Watch Time", "Retention Curves", and "Followers Generated" are natively restricted by the Meta Graph API. Third-party platforms claiming to provide these are estimating or fabricating data.</p>
      </div>

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h3 className="font-bold text-zinc-100">Post Insights</h3>
              <button onClick={() => setSelectedPost(null)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors">
                <X className="w-4 h-4 text-zinc-300" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="flex gap-6">
                <div className="w-32 h-40 rounded-xl overflow-hidden border border-zinc-800 flex-shrink-0">
                   <img src={selectedPost.thumbnail_url || selectedPost.media_url} className="w-full h-full object-cover" alt="Post" />
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-sm text-zinc-300">{selectedPost.caption}</p>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-400 font-medium">{selectedPost.media_type}</span>
                    <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-400 font-medium">{new Date(selectedPost.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Reach</p>
                  <p className="text-xl font-bold text-zinc-100">{selectedPost.insights?.reach?.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Impressions</p>
                  <p className="text-xl font-bold text-zinc-100">{selectedPost.insights?.impressions?.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Engagement (Likes+Comments)</p>
                  <p className="text-xl font-bold text-zinc-100">{((selectedPost.like_count || 0) + (selectedPost.comments_count || 0)).toLocaleString()}</p>
                </div>
                <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Saves</p>
                  <p className="text-xl font-bold text-zinc-100">{selectedPost.insights?.saved?.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Shares</p>
                  <p className="text-xl font-bold text-zinc-100">{selectedPost.insights?.shares?.toLocaleString()}</p>
                </div>
              </div>

              {/* Explicit Missing Metrics Section */}
              <div className="border border-amber-900/30 bg-amber-900/10 rounded-2xl p-5 mt-4">
                <h4 className="flex items-center gap-2 text-amber-500 text-sm font-bold mb-4">
                  <AlertTriangle className="w-4 h-4" /> Not Available via API
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center opacity-50">
                    <div>
                      <p className="text-sm font-medium text-zinc-300">Average Watch Time</p>
                      <p className="text-xs text-zinc-500">Restricted to native Instagram App only.</p>
                    </div>
                    <span className="text-sm font-mono bg-zinc-900 px-3 py-1 rounded text-zinc-600">N/A</span>
                  </div>
                  <div className="flex justify-between items-center opacity-50">
                    <div>
                      <p className="text-sm font-medium text-zinc-300">Audience Retention Curve</p>
                      <p className="text-xs text-zinc-500">Graph API does not expose video retention data.</p>
                    </div>
                    <span className="text-sm font-mono bg-zinc-900 px-3 py-1 rounded text-zinc-600">N/A</span>
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
