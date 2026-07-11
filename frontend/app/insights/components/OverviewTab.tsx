import { AlertCircle } from "lucide-react";

export default function OverviewTab({ timeRange }: { timeRange: string }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Placeholders for StatCards */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <p className="text-xs text-zinc-500 font-medium">Account Reach</p>
          <p className="text-2xl font-bold text-zinc-200 mt-1">--</p>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <p className="text-xs text-zinc-500 font-medium">Impressions</p>
          <p className="text-2xl font-bold text-zinc-200 mt-1">--</p>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <p className="text-xs text-zinc-500 font-medium">Profile Views</p>
          <p className="text-2xl font-bold text-zinc-200 mt-1">--</p>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <p className="text-xs text-zinc-500 font-medium">Net Followers</p>
          <p className="text-2xl font-bold text-zinc-200 mt-1">--</p>
        </div>
      </div>
      
      <div className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900 flex items-center justify-center min-h-[300px]">
        <p className="text-zinc-500 text-sm">Reach Chart Placeholder</p>
      </div>
    </div>
  );
}
