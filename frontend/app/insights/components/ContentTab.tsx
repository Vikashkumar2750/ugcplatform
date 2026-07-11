import { AlertCircle } from "lucide-react";

export default function ContentTab({ timeRange }: { timeRange: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500 text-white">All Content</button>
        <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-400">Reels</button>
        <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-400">Posts</button>
        <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-400">Stories</button>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden min-h-[400px]">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Post</th>
              <th className="px-4 py-3 font-medium">Reach</th>
              <th className="px-4 py-3 font-medium">Plays/Views</th>
              <th className="px-4 py-3 font-medium">Likes</th>
              <th className="px-4 py-3 font-medium">Comments</th>
              <th className="px-4 py-3 font-medium">Saves</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="text-center py-12 text-zinc-500">
                Content Table Placeholder
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Empty State / API Limitation Indicator */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex gap-3 text-zinc-400 text-sm">
        <AlertCircle className="w-5 h-5 text-zinc-500 flex-shrink-0" />
        <p><strong>Note on Watch Time:</strong> Metrics like "Average Watch Time", "Retention Curves", and "Followers Generated" are natively restricted by the Meta Graph API and cannot be displayed for third-party platforms.</p>
      </div>
    </div>
  );
}
