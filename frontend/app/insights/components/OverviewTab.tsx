import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Info, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function OverviewTab({ timeRange, accountId, platform = "instagram" }: { timeRange: string, accountId?: string, platform?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch from the backend overview endpoint
        // NOTE: If using Next.js proxy, this might change. Assuming Express backend is at /api or we use the data passed.
        // For now, we simulate fetching since we are building UI scaffolding and waiting for full integration
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
        
        // Mock data for UI layout
        setTimeout(() => {
          setData({
            reach: 124500,
            impressions: 250000,
            profileViews: 15400,
            netFollowers: 320,
            chartData: Array.from({ length: 28 }).map((_, i) => ({
              date: new Date(Date.now() - (27 - i) * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              reach: Math.floor(Math.random() * 5000) + 1000,
              impressions: Math.floor(Math.random() * 10000) + 2000
            }))
          });
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

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Account Reach" value={data.reach.toLocaleString()} trend="+12.5%" isUp={true} />
        <StatCard title="Impressions" value={data.impressions.toLocaleString()} trend="+5.2%" isUp={true} />
        <StatCard title="Profile Views" value={data.profileViews.toLocaleString()} trend="-2.1%" isUp={false} />
        <StatCard title="Net Followers" value={data.netFollowers.toLocaleString()} trend="+40" isUp={true} />
      </div>
      
      {/* Reach Chart */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
            Reach Over Time <Info className="w-4 h-4 text-zinc-500" />
          </h3>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#e4e4e7' }}
              />
              <Line type="monotone" dataKey="reach" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="Reach" />
              <Line type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={2} dot={false} name="Impressions" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, isUp }: { title: string, value: string, trend: string, isUp: boolean }) {
  return (
    <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400 font-medium">{title}</p>
        <Info className="w-4 h-4 text-zinc-600" />
      </div>
      <p className="text-2xl font-bold text-zinc-100 mt-2">{value}</p>
      <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${isUp ? 'text-green-500' : 'text-red-400'}`}>
        {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        <span>{trend} vs prev period</span>
      </div>
    </div>
  );
}
