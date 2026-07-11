import { useState, useEffect } from "react";
import { Loader2, Users, MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

export default function AudienceTab({ accountId, platform = "instagram" }: { accountId?: string, platform?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    
    async function fetchData() {
      setLoading(true);
      try {
        // Mock data for UI layout
        setTimeout(() => {
          setData({
            ageGender: [
              { age: "13-17", male: 2.5, female: 4.2 },
              { age: "18-24", male: 15.1, female: 25.8 },
              { age: "25-34", male: 12.3, female: 18.5 },
              { age: "35-44", male: 5.2, female: 7.1 },
              { age: "45-54", male: 2.1, female: 3.4 },
              { age: "55+", male: 1.2, female: 2.6 },
            ],
            topLocations: [
              { name: "New York, USA", value: 4500 },
              { name: "London, UK", value: 3200 },
              { name: "Los Angeles, USA", value: 2800 },
              { name: "Toronto, CA", value: 1900 },
              { name: "Sydney, AU", value: 1200 },
            ]
          });
          setLoading(false);
        }, 800);
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

  const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Age and Gender */}
        <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm">
          <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2 mb-6">
            <Users className="w-4 h-4 text-zinc-500" /> Age & Gender Distribution
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
                  formatter={(value: number) => [`${value}%`]}
                />
                <Bar dataKey="female" name="Female" fill="#ec4899" radius={[0, 4, 4, 0]} stackId="a" />
                <Bar dataKey="male" name="Male" fill="#3b82f6" radius={[0, 4, 4, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Locations */}
        <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm">
          <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2 mb-6">
            <MapPin className="w-4 h-4 text-zinc-500" /> Top Locations (Cities)
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
