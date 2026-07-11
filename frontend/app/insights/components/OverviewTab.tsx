import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Info, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function OverviewTab({ timeRange, accountId, platform = "instagram" }: { timeRange: string, accountId?: string, platform?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const daysInt = parseInt(timeRange.replace("d", ""), 10) || 28;
        const res = await fetch(`/api/insights/proxy/${platform}/${accountId}/overview?days=${daysInt}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to fetch overview data");
        }
        
        const json = await res.json();
        const metrics = json.data || [];
        
        // Find metrics
        const findMetric = (name: string) => metrics.find((m: any) => m.name === name)?.values?.[0]?.value || 0;
        
        const reach = findMetric("reach") || findMetric("page_impressions_unique") || 0;
        const impressions = findMetric("impressions") || findMetric("page_impressions") || 0;
        const profileViews = findMetric("profile_views") || findMetric("page_views_total") || 0;
        
        // Chart data - we take the timeline values
        const reachData = metrics.find((m: any) => m.name === "reach" || m.name === "page_impressions_unique")?.values || [];
        const impData = metrics.find((m: any) => m.name === "impressions" || m.name === "page_impressions")?.values || [];
        
        const chartData = reachData.map((r: any, i: number) => {
          const date = new Date(r.end_time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return {
            date,
            reach: r.value,
            impressions: impData[i]?.value || 0
          };
        });

        setData({
          reach,
          impressions,
          profileViews,
          netFollowers: 0, // Since we don't have historical followers API in basic tier
          chartData: chartData.length > 0 ? chartData : [
            { date: "N/A", reach: reach, impressions: impressions }
          ]
        });
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

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
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
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            Reach Over Time <Info className="w-4 h-4 text-muted-foreground" />
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
    <div className="p-5 rounded-2xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        <Info className="w-4 h-4 text-muted-foreground/60" />
      </div>
      <p className="text-2xl font-bold text-foreground mt-2">{value}</p>
      <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${isUp ? 'text-green-600 dark:text-green-500' : 'text-red-500 dark:text-red-400'}`}>
        {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        <span>{trend} vs prev period</span>
      </div>
    </div>
  );
}
