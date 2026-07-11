import { useState, useEffect } from "react";
import { Loader2, Users, MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { fetchWithCache } from "../lib/fetchWithCache";

export default function AudienceTab({ accountId, platform = "instagram" }: { accountId?: string, platform?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const json = await fetchWithCache(`/api/insights/proxy/${platform}/${accountId}/audience`);
        const metrics = json.data || [];

        const findMetric = (name: string) => metrics.find((m: any) => m.name === name)?.values?.[0]?.value || {};
        
        // Age & Gender parsing
        const genderAge = findMetric("audience_gender_age") || findMetric("page_fans_gender_age") || {};
        const ageGroups = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
        
        let totalGenderAge = 0;
        Object.values(genderAge).forEach((v: any) => totalGenderAge += v);

        const ageGender = ageGroups.map(age => {
          const male = (genderAge[`M.${age}`] || 0) / (totalGenderAge || 1) * 100;
          const female = (genderAge[`F.${age}`] || 0) / (totalGenderAge || 1) * 100;
          return { age, male: parseFloat(male.toFixed(1)), female: parseFloat(female.toFixed(1)) };
        });

        // Top Locations (City)
        const cityData = findMetric("audience_city") || findMetric("page_fans_city") || {};
        const topLocations = Object.entries(cityData)
          .map(([name, value]: [string, any]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        setData({
          ageGender,
          topLocations: topLocations.length > 0 ? topLocations : [{ name: "No data", value: 1 }]
        });
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
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Age and Gender */}
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-6">
            <Users className="w-4 h-4 text-muted-foreground" /> Age & Gender Distribution
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ageGender} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="age" type="category" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#e4e4e7' }}
                  formatter={(value: any, name: any) => [`${value}%`, name]}
                />
                <Bar dataKey="female" name="Female" fill="#ec4899" radius={[0, 4, 4, 0]} stackId="a" />
                <Bar dataKey="male" name="Male" fill="#3b82f6" radius={[0, 4, 4, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Locations */}
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-6">
            <MapPin className="w-4 h-4 text-muted-foreground" /> Top Locations (Cities)
          </h3>
          <div className="h-[300px] w-full flex">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.topLocations}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {data.topLocations.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#e4e4e7' }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Custom Legend */}
            <div className="flex flex-col justify-center gap-3 pr-4">
              {data.topLocations.map((entry: any, index: number) => (
                <div key={entry.name} className="flex items-center gap-2 text-xs text-zinc-400">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="truncate max-w-[100px]" title={entry.name}>{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
