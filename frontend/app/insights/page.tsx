"use client";

import { useState, useCallback, useEffect } from "react";
import { RefreshCw, ChevronDown, Instagram, Facebook } from "lucide-react";
import OverviewTab from "./components/OverviewTab";
import AudienceTab from "./components/AudienceTab";
import ContentTab from "./components/ContentTab";
import AIInsightsTab from "./components/AIInsightsTab";

type TabType = "overview" | "audience" | "content" | "ai";
type TimeRange = "7d" | "14d" | "28d" | "30d" | "90d";

export default function InsightsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [timeRange, setTimeRange] = useState<TimeRange>("28d");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("/api/connect/accounts");
        const data = await res.json();
        if (data.accounts && data.accounts.length > 0) {
          setAccounts(data.accounts);
          setSelectedAccountId(data.accounts[0].id);
        }
      } catch (err) {
        console.error("Failed to load accounts", err);
      } finally {
        setLoadingAccounts(false);
      }
    }
    fetchAccounts();
  }, []);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  // Stub function for future data fetching
  const refreshData = useCallback(async () => {
    // API logic will go here
  }, [timeRange]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Global Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 font-heading">Insights</h1>
            <p className="text-sm text-zinc-400">Authentic Meta Graph API Metrics</p>
          </div>
          
          {!loadingAccounts && accounts.length > 0 && (
            <div className="relative border-l border-zinc-800 pl-4 ml-2">
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                {selectedAccount?.platform === "instagram" ? <Instagram className="w-4 h-4 text-pink-500" /> : <Facebook className="w-4 h-4 text-blue-500" />}
                <span className="text-sm font-medium text-zinc-200">{selectedAccount?.platform_username || selectedAccount?.platform_name || "Select Account"}</span>
                <ChevronDown className="w-4 h-4 text-zinc-500 ml-1" />
              </button>
              
              {dropdownOpen && (
                <div className="absolute top-full left-4 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => { setSelectedAccountId(acc.id); setDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-800 transition-colors ${selectedAccountId === acc.id ? 'bg-zinc-800/50' : ''}`}
                    >
                      {acc.platform === "instagram" ? <Instagram className="w-4 h-4 text-pink-500" /> : <Facebook className="w-4 h-4 text-blue-500" />}
                      <span className="text-sm font-medium text-zinc-200">{acc.platform_username || acc.platform_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
        {activeTab === "overview" && <OverviewTab timeRange={timeRange} accountId={selectedAccountId} platform={selectedAccount?.platform} />}
        {activeTab === "audience" && <AudienceTab accountId={selectedAccountId} platform={selectedAccount?.platform} />}
        {activeTab === "content" && <ContentTab timeRange={timeRange} accountId={selectedAccountId} platform={selectedAccount?.platform} />}
        {activeTab === "ai" && <AIInsightsTab accountId={selectedAccountId} platform={selectedAccount?.platform} />}
      </div>
    </div>
  );
}
