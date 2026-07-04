import { create } from 'zustand';

export type Platform = 'instagram' | 'facebook' | 'youtube' | 'linkedin';

export interface ConnectedAccount {
  id: string;
  platform: Platform;
  platform_username: string;
  avatar_url?: string;
  [key: string]: any;
}

export interface AutomationRule {
  id: string;
  name: string;
  type: string;
  [key: string]: any;
}

interface DashboardState {
  accounts: ConnectedAccount[];
  rules: AutomationRule[];
  isLoaded: boolean;
  isLoading: boolean;
  load: () => Promise<void>;
  forceRefresh: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  accounts: [],
  rules: [],
  isLoaded: false,
  isLoading: false,

  load: async () => {
    // If already loaded or currently loading, don't refetch
    if (get().isLoaded || get().isLoading) return;

    set({ isLoading: true });
    try {
      const [rulesRes, accountsRes] = await Promise.all([
        fetch("/api/automation/rules"),
        fetch("/api/connect/accounts"),
      ]);
      
      let rules = [];
      let accounts = [];

      if (rulesRes.ok) {
        const j = await rulesRes.json();
        rules = j.rules || [];
      }
      
      if (accountsRes.ok) {
        const j = await accountsRes.json();
        accounts = j.accounts || [];
      }

      set({ rules, accounts, isLoaded: true, isLoading: false });
    } catch (err) {
      console.error("Failed to load dashboard data", err);
      set({ isLoading: false });
    }
  },

  forceRefresh: async () => {
    set({ isLoaded: false });
    await get().load();
  }
}));
