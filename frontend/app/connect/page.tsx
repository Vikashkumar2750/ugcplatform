"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2, AlertCircle, ExternalLink, RefreshCw,
  Unlink, Shield, Camera, PlayCircle, Share2, Zap, Plus,
  Users, BarChart3, MessageSquare, Calendar, Loader2, X
} from "lucide-react";

// LinkedIn icon (not in this lucide-react version)
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

interface ConnectedAccount {
  id: string;
  platform: "instagram" | "facebook" | "youtube" | "linkedin";
  platform_username: string;
  platform_name: string;
  avatar_url?: string;
  account_type?: string;
  permissions: string[];
  connected_at: string;
  token_expires_at?: string;
  page_name?: string;
}

const PLATFORM_CONFIG = {
  instagram: {
    name: "Instagram",
    color: "from-purple-500 to-pink-500",
    borderColor: "border-pink-400/30",
    bgColor: "bg-pink-400/5",
    icon: Camera,
    description: "Connect your Instagram Business or Creator account",
    permissions: [
      { key: "instagram_basic", label: "Profile & Posts", required: true },
      { key: "instagram_manage_insights", label: "Full Analytics & Insights", required: true },
      { key: "instagram_content_publish", label: "Post Scheduling", required: false, grantedWhenConnected: true },
      { key: "instagram_manage_messages", label: "DM Automation", required: false, grantedWhenConnected: true },
      { key: "instagram_manage_comments", label: "Comment Automation", required: false, grantedWhenConnected: true },
    ],
    requirements: "Requires Business or Creator account (not personal)",
    oauthUrl: "/api/auth/instagram",
  },
  facebook: {
    name: "Facebook Page",
    color: "from-blue-600 to-blue-400",
    borderColor: "border-blue-400/30",
    bgColor: "bg-blue-400/5",
    icon: Share2,
    description: "Connect your Facebook Business Page",
    permissions: [
      { key: "pages_show_list", label: "List Your Pages", required: true },
      { key: "pages_read_engagement", label: "Page Analytics", required: true },
      { key: "pages_manage_posts", label: "Post Scheduling", required: false, grantedWhenConnected: true },
      { key: "pages_messaging", label: "Messenger Automation", required: false, grantedWhenConnected: true },
    ],
    requirements: "Requires admin access to a Facebook Page",
    oauthUrl: "/api/auth/facebook",
  },
  youtube: {
    name: "YouTube",
    color: "from-red-600 to-red-400",
    borderColor: "border-red-400/30",
    bgColor: "bg-red-400/5",
    icon: PlayCircle,
    description: "Connect your YouTube channel for analytics & scheduling",
    permissions: [
      { key: "youtube.readonly", label: "Channel Analytics", required: true },
      { key: "youtube.upload", label: "Video Scheduling", required: false },
      { key: "youtubepartner", label: "Revenue Analytics", required: false },
    ],
    requirements: "Works with any YouTube channel",
    oauthUrl: "/api/auth/youtube",
  },
  linkedin: {
    name: "LinkedIn",
    color: "from-blue-700 to-blue-500",
    borderColor: "border-blue-600/30",
    bgColor: "bg-blue-600/5",
    icon: LinkedinIcon,
    description: "Connect your LinkedIn profile or company page for analytics",
    permissions: [
      { key: "r_liteprofile", label: "Profile Access", required: true },
      { key: "r_emailaddress", label: "Email Address", required: true },
      { key: "w_member_social", label: "Post Scheduling", required: false, grantedWhenConnected: true },
      { key: "rw_organization_admin", label: "Company Page Analytics", required: false },
    ],
    requirements: "Connect your personal profile or company page",
    oauthUrl: "/api/auth/linkedin",
  },
};

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm transition-all ${
      type === "success" ? "bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700" : "bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-700"
    }`}>
      {type === "success" ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
      <p className={`text-sm font-medium flex-1 ${type === "success" ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}>{message}</p>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground flex-shrink-0"><X className="w-4 h-4" /></button>
    </div>
  );
}

function PlatformCard({
  platformKey, config, connectedAccounts, onDisconnect, onShowUpgrade,
}: {
  platformKey: keyof typeof PLATFORM_CONFIG;
  config: typeof PLATFORM_CONFIG["instagram"];
  connectedAccounts: ConnectedAccount[];
  onDisconnect: () => void;
  onShowUpgrade: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const Icon = config.icon;
  const hasAny = connectedAccounts.length > 0;

  const handleConnect = async (urlSuffix: string = "") => {
    // Check limit before redirecting
    try {
      const res = await fetch(`/api/connect/check-limit?platform=${platformKey}`, { cache: "no-store" });
      const limit = await res.json();
      if (!limit.allowed) {
        onShowUpgrade();
        return;
      }
    } catch { /* allow on error */ }
    setConnecting(true);
    window.location.href = config.oauthUrl + urlSuffix;
  };

  const handleDisconnect = async (accountId: string, username: string) => {
    if (!confirm(`Disconnect @${username}? Automation rules for this account will be paused.`)) return;
    setDisconnecting(accountId);
    try {
      await fetch(`/api/connect/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platformKey, accountId }),
      });
      
      // Invalidate frontend sessionStorage cache for this platform
      try {
        sessionStorage.removeItem("connect_accounts_v1");
        if (platformKey === "instagram") {
          sessionStorage.removeItem("ig_insights_v3_default");
          if (accountId) sessionStorage.removeItem(`ig_insights_v3_${accountId}`);
        } else if (platformKey === "facebook") {
          sessionStorage.removeItem("fb_insights_v3_default");
          if (accountId) sessionStorage.removeItem(`fb_insights_v3_${accountId}`);
        } else if (platformKey === "youtube") {
          sessionStorage.removeItem("yt_insights_v3_default");
          if (accountId) sessionStorage.removeItem(`yt_insights_v3_${accountId}`);
        }
      } catch (e) {}

      onDisconnect();
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <div className={`rounded-2xl border ${hasAny ? config.borderColor : "border-border"} ${hasAny ? config.bgColor : "bg-card"} overflow-hidden transition-all`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-heading font-bold">{config.name}</h3>
              <p className="text-xs text-muted-foreground">{config.requirements}</p>
            </div>
          </div>
          <div className="flex-shrink-0">
            {hasAny ? (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> {connectedAccounts.length} connected
              </span>
            ) : (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">Not connected</span>
            )}
          </div>
        </div>

        {/* Connected accounts list */}
        {connectedAccounts.map(acc => {
          const connectedAt = new Date(acc.connected_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
          return (
            <div key={acc.id} className="mb-3 p-3 rounded-xl bg-background/60 border border-border flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
                {acc.avatar_url ? (
                  <img src={acc.avatar_url} alt={acc.platform_username} className="w-full h-full object-cover" />
                ) : (
                  (acc.platform_username || "?")[0]?.toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">@{acc.platform_username || acc.platform_name}</p>
                <p className="text-xs text-muted-foreground">{acc.account_type} · {connectedAt}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => { setConnecting(true); window.location.href = config.oauthUrl + (acc.account_type === "PAGE" ? "?type=page" : "?type=profile"); }}
                  className="p-1.5 rounded-lg hover:bg-muted/60 transition text-muted-foreground hover:text-foreground" title="Reconnect">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDisconnect(acc.id, acc.platform_username)}
                  disabled={disconnecting === acc.id}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 transition text-muted-foreground hover:text-red-500" title="Disconnect">
                  {disconnecting === acc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          );
        })}

        {!hasAny && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Permissions</p>
            {config.permissions.map(perm => (
              <div key={perm.key} className="flex items-center gap-2 text-xs">
                {perm.required ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-border flex-shrink-0" />
                )}
                <span className="text-muted-foreground">{perm.label}</span>
                {perm.required && <span className="ml-auto text-[10px] text-muted-foreground">required</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border px-5 py-3">
        {platformKey === "linkedin" ? (
          <div className="flex flex-col gap-2">
            <button id={`connect-linkedin-profile-btn`} onClick={() => handleConnect("?type=profile")} disabled={connecting}
              className="btn-amber w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
              {connecting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Redirecting...</> : <><Zap className="w-4 h-4" /> Connect LinkedIn Profile</>}
            </button>
            <button id={`connect-linkedin-page-btn`} onClick={() => handleConnect("?type=page")} disabled={connecting}
              className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-blue-500 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
              {connecting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Redirecting...</> : <><Plus className="w-4 h-4" /> Connect Company Page</>}
            </button>
          </div>
        ) : (
          <button id={`connect-${platformKey}-btn`} onClick={() => handleConnect()} disabled={connecting}
            className="btn-amber w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
            {connecting ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Redirecting...</>
            ) : hasAny ? (
              <><Plus className="w-4 h-4" /> Connect Another {config.name}</>
            ) : (
              <><Zap className="w-4 h-4" /> Connect {config.name}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function ConnectContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("connect_accounts_v1");
      if (cached) return JSON.parse(cached);
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      return !sessionStorage.getItem("connect_accounts_v1");
    }
    return true;
  });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchAccounts = async (force = false) => {
    if (!force && typeof window !== "undefined" && sessionStorage.getItem("connect_accounts_v1")) {
      setLoading(false);
      return;
    }
    if (force) setLoading(true);
    try {
      const res = await fetch("/api/connect/accounts");
      const data = await res.json();
      setAccounts(data.accounts || []);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("connect_accounts_v1", JSON.stringify(data.accounts || []));
      }
    } catch {
      // Supabase not configured yet — show empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();

    // Show toast based on OAuth callback result
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      const platformNames: Record<string, string> = {
        instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", linkedin: "LinkedIn"
      };
      setToast({ message: `${platformNames[success] || success} connected successfully! ✓`, type: "success" });
      // Re-fetch after a short delay to ensure DB write is committed
      setTimeout(() => fetchAccounts(true), 1500);
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "You declined the permission request.",
        no_ig_business_account: "No Instagram Business or Creator account found. Make sure your Instagram account is a Business or Creator account linked to a Facebook Page.",
      };
      setToast({ message: errorMessages[error] || `Connection failed: ${error}`, type: "error" });
    }
  }, [searchParams]);

  // Group accounts by platform (support multiple per platform)
  const accountsByPlatform: Record<string, ConnectedAccount[]> = {};
  accounts.forEach(a => {
    if (!accountsByPlatform[a.platform]) accountsByPlatform[a.platform] = [];
    accountsByPlatform[a.platform].push(a);
  });
  const connectedCount = accounts.length;
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            Connect Accounts
            {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" style={{ animation: "fadeIn 0.5s ease-out 0.2s forwards", opacity: 0 }} />}
          </h1>
          <button
            onClick={() => { fetchAccounts(true); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition hover:border-amber-400/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your social accounts for real analytics, DM automation, and post scheduling.
          Your own Apify key is only needed for competitor analysis.
        </p>
      </div>

      {!loading && connectedCount === 0 && (
        <div className="p-5 rounded-2xl border border-amber-400/20 bg-amber-400/5">
          <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-3">
            🔗 Why connect? Get actual data instead of estimates
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: BarChart3, text: "Real Insights (not scraped)" },
              { icon: Calendar, text: "Post Scheduling" },
              { icon: MessageSquare, text: "DM Automation" },
              { icon: Users, text: "Audience Demographics" },
            ].map(b => (
              <div key={b.text} className="flex items-center gap-2 text-xs text-muted-foreground">
                <b.icon className="w-4 h-4 text-amber-500 flex-shrink-0" />
                {b.text}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {(Object.entries(PLATFORM_CONFIG) as [keyof typeof PLATFORM_CONFIG, typeof PLATFORM_CONFIG["instagram"]][]).map(
          ([key, config]) => (
            <PlatformCard
              key={key}
              platformKey={key}
              config={config}
              connectedAccounts={accountsByPlatform[key] || []}
              onDisconnect={fetchAccounts}
              onShowUpgrade={() => setShowUpgrade(true)}
            />
          )
        )}
      </div>

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowUpgrade(false)} />
          <div className="relative bg-card rounded-2xl border border-border w-full max-w-md p-6 shadow-2xl space-y-4">
            <button onClick={() => setShowUpgrade(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl btn-amber mx-auto mb-3 flex items-center justify-center">
                <Zap className="w-7 h-7 text-black" />
              </div>
              <h3 className="font-heading text-xl font-bold">Upgrade to Pro</h3>
              <p className="text-sm text-muted-foreground mt-1">Connect up to 5 accounts per platform</p>
            </div>
            <div className="space-y-2">
              {[
                { plan: "Monthly", price: "₹59/mo", save: "" },
                { plan: "6-Month", price: "₹299", save: "Save 15%" },
                { plan: "Yearly", price: "₹599/yr", save: "Save 50%" },
              ].map(p => (
                <button key={p.plan} onClick={() => window.location.href = "/pricing"}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:border-amber-400/50 hover:bg-amber-400/5 transition">
                  <div>
                    <p className="text-sm font-semibold">{p.plan}</p>
                    {p.save && <p className="text-xs text-green-500">{p.save}</p>}
                  </div>
                  <span className="text-sm font-bold text-amber-500">{p.price}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground">5× Instagram, 5× Facebook, 5× YouTube, 5× LinkedIn</p>
          </div>
        </div>
      )}

      {/* Apify status */}
      <div className="p-5 rounded-2xl border border-border bg-card">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Apify API Key</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {connectedCount > 0
                ? "Your Apify key is optional now — it's only used for deep competitor analysis (profiles you don't own)."
                : "Without a connected account, Apify is used to scrape your profile. Connect an account above for more accurate data."}
            </p>
            <a href="/settings" className="text-xs text-amber-600 dark:text-amber-400 hover:underline mt-2 inline-block">
              Manage API keys in Settings →
            </a>
          </div>
        </div>
      </div>

    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
      <ConnectContent />
    </Suspense>
  );
}
