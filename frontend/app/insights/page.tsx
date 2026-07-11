"use client";

import { useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import OverviewTab from "./components/OverviewTab";
import AudienceTab from "./components/AudienceTab";
import ContentTab from "./components/ContentTab";
import AIInsightsTab from "./components/AIInsightsTab";

type TabType = "overview" | "audience" | "content" | "ai";
type TimeRange = "7d" | "14d" | "28d" | "30d" | "90d";

export default function InsightsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [timeRange, setTimeRange] = useState<TimeRange>("28d");

  // Stub function for future data fetching
  const refreshData = useCallback(async () => {
    // API logic will go here
  }, [timeRange]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Global Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 font-heading">Insights</h1>
          <p className="text-sm text-zinc-400">Authentic Meta Graph API Metrics</p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          {(["7d", "14d", "28d", "30d", "90d"] as TimeRange[]).map(t => (
            <button 
              key={t}
              onClick={() => setTimeRange(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                timeRange === t ? "bg-zinc-800 text-zinc-200 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t}
            </button>
          ))}
          <button onClick={refreshData} className="ml-2 p-1.5 text-zinc-500 hover:text-zinc-300 border-l border-zinc-800" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-6 border-b border-zinc-800">
        {(["overview", "audience", "content", "ai"] as TabType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium capitalize border-b-2 transition-all ${
              activeTab === tab ? "border-red-500 text-zinc-200" : "border-transparent text-zinc-500 hover:text-zinc-400"
            }`}
          >
            {tab === "ai" ? "AI Insights" : tab}
          </button>
        ))}
      </div>

      {/* Tab Content Areas */}
      <div className="mt-6">
        {activeTab === "overview" && <OverviewTab timeRange={timeRange} />}
        {activeTab === "audience" && <AudienceTab />}
        {activeTab === "content" && <ContentTab timeRange={timeRange} />}
        {activeTab === "ai" && <AIInsightsTab />}
      </div>
    </div>
  );
}
