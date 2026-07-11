"use client";

import { useState, useCallback, useEffect } from "react";
import { RefreshCw, ChevronDown, Globe } from "lucide-react";
import OverviewTab from "../components/OverviewTab";
import AudienceTab from "../components/AudienceTab";
import ContentTab from "../components/ContentTab";
import AIInsightsTab from "../components/AIInsightsTab";

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
          const fbAccounts = data.accounts.filter((a: any) => a.platform === "facebook");
          setAccounts(fbAccounts);
          if (fbAccounts.length > 0) {
            setSelectedAccountId(fbAccounts[0].id);
          }
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
            <h1 className="text-2xl font-bold text-foreground font-heading">Insights</h1>
            <p className="text-sm text-muted-foreground">Authentic Meta Graph API Metrics</p>
          </div>
          
          {!loadingAccounts && accounts.length > 0 && (
            <div className="relative border-l border-border pl-4 ml-2">
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors"
              >
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{selectedAccount?.platform_username || selectedAccount?.platform_name || "Select Account"}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
              </button>
              
              {dropdownOpen && (
                <div className="absolute top-full left-4 mt-2 w-56 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => { setSelectedAccountId(acc.id); setDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors ${selectedAccountId === acc.id ? 'bg-muted/80' : ''}`}
                    >
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{acc.platform_username || acc.platform_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 bg-card p-1 rounded-xl border border-border">
          {(["7d", "14d", "28d", "30d", "90d"] as TimeRange[]).map(t => (
            <button 
              key={t}
              onClick={() => setTimeRange(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                timeRange === t ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
          <button onClick={refreshData} className="ml-2 p-1.5 text-muted-foreground hover:text-foreground border-l border-border" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-6 border-b border-border">
        {(["overview", "audience", "content", "ai"] as TabType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium capitalize border-b-2 transition-all ${
              activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "ai" ? "AI Insights" : tab}
          </button>
        ))}
      </div>

      {/* Tab Content Areas */}
      <div className="mt-6">
        {activeTab === "overview" && <OverviewTab timeRange={timeRange} accountId={selectedAccount?.platform_user_id} platform="facebook" />}
        {activeTab === "audience" && <AudienceTab timeRange={timeRange} accountId={selectedAccount?.platform_user_id} platform="facebook" />}
        {activeTab === "content" && <ContentTab timeRange={timeRange} accountId={selectedAccount?.platform_user_id} platform="facebook" />}
        {activeTab === "ai" && <AIInsightsTab timeRange={timeRange} accountId={selectedAccount?.platform_user_id} platform="facebook" />}
      </div>
    </div>
  );
}
