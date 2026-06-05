"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Eye, EyeOff, CheckCircle2, XCircle, Loader2, ExternalLink,
  Shield, Globe, User, ChevronDown, ChevronUp,
  AlertCircle, Zap, RefreshCw, Lock
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://content-engineer-api.onrender.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || "";
}

// ── Types ──────────────────────────────────────────────────────────
type TestStatus = "idle" | "ok" | "error";

const LLM_PROVIDERS = [
  { id: "gemini",    name: "Google Gemini",    label: "Gemini API Key",    helpUrl: "https://aistudio.google.com/app/apikey",    placeholder: "AIza..." },
  { id: "anthropic", name: "Claude (Anthropic)",label: "Anthropic API Key", helpUrl: "https://console.anthropic.com",             placeholder: "sk-ant-..." },
  { id: "openai",    name: "OpenAI (ChatGPT)", label: "OpenAI API Key",    helpUrl: "https://platform.openai.com/api-keys",      placeholder: "sk-..." },
  { id: "bedrock",   name: "AWS Bedrock",      label: "Bedrock Bearer Token", helpUrl: "https://aws.amazon.com/bedrock",         placeholder: "ABSK..." },
];

const SCRAPER_PROVIDERS = [
  { id: "apify",    name: "Apify",    label: "Apify API Token",  helpUrl: "https://apify.com/account/integrations", placeholder: "apify_api_..." },
  { id: "rapidapi", name: "RapidAPI", label: "RapidAPI Key",     helpUrl: "https://rapidapi.com/developer/apps",    placeholder: "RapidAPI key..." },
];

const ALL_PROVIDERS = [...LLM_PROVIDERS, ...SCRAPER_PROVIDERS];

// ── ApiKeyInput ────────────────────────────────────────────────────
function ApiKeyInput({ id, label, value, onChange, onSave, onTest, saving, testing, status, helpUrl, placeholder }: {
  id: string; label: string; value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onTest: () => void;
  saving: boolean; testing: boolean; status: TestStatus;
  helpUrl: string; placeholder: string;
}) {
  const [show, setShow] = useState(false);
  const isDirty = value !== "";
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id={id}
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 pr-9 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/30 transition font-mono"
          />
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button type="button" onClick={onSave} disabled={saving || !isDirty}
          className="px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted/60 transition disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
        </button>
        <button type="button" onClick={onTest} disabled={testing}
          className="px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted/60 transition disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap">
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Test"}
        </button>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs">
          {status === "ok"    && <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="text-green-600 dark:text-green-400">Connected & Saved!</span></>}
          {status === "error" && <><XCircle className="w-3.5 h-3.5 text-red-500" /><span className="text-red-500">Invalid key</span></>}
        </div>
        <a href={helpUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1">
          Get key <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

// ── Priority Row ───────────────────────────────────────────────────
function PriorityRow({ index, name, enabled, onToggle, onMoveUp, onMoveDown, isFirst, isLast, hasSavedKey }: {
  index: number; name: string; enabled: boolean; onToggle: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
  isFirst: boolean; isLast: boolean; hasSavedKey: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${enabled && hasSavedKey ? "border-amber-400/30 bg-amber-400/5" : "border-border bg-muted/20"}`}>
      <div className="flex flex-col gap-0.5">
        <button onClick={onMoveUp} disabled={isFirst} className="disabled:opacity-20 hover:text-foreground text-muted-foreground transition">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button onClick={onMoveDown} disabled={isLast} className="disabled:opacity-20 hover:text-foreground text-muted-foreground transition">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{index + 1}</div>
      <div className="flex-1">
        <span className="text-sm font-medium">{name}</span>
        {!hasSavedKey && <span className="text-xs text-muted-foreground ml-2">(not saved)</span>}
      </div>
      <div onClick={onToggle} className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${enabled && hasSavedKey ? "bg-amber-500" : "bg-muted-foreground/30"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${enabled && hasSavedKey ? "left-4" : "left-0.5"}`} />
      </div>
    </div>
  );
}

// ── Main Settings Page ─────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"llm" | "scraper" | "preferences" | "account">("llm");

  // Inputs (what user is typing)
  const [inputKeys, setInputKeys] = useState<Record<string, string>>({});
  // Which providers have a saved key in backend
  const [savedProviders, setSavedProviders] = useState<Set<string>>(new Set());
  // Priority + enabled state (stored in localStorage — not sensitive)
  const [llmPriority, setLlmPriority]       = useState<string[]>(LLM_PROVIDERS.map(p => p.id));
  const [scraperPriority, setScraperPriority] = useState<string[]>(SCRAPER_PROVIDERS.map(p => p.id));
  const [llmEnabled, setLlmEnabled]           = useState<Record<string, boolean>>({});
  const [scraperEnabled, setScraperEnabled]   = useState<Record<string, boolean>>({});

  const [testStatus, setTestStatus]   = useState<Record<string, TestStatus>>({});
  const [saving, setSaving]           = useState<Record<string, boolean>>({});
  const [testing, setTesting]         = useState<Record<string, boolean>>({});
  const [language, setLanguage]       = useState<"hi" | "en">("hi");
  const [defaultPlatform, setDefaultPlatform] = useState("Instagram");
  const [userInfo, setUserInfo]       = useState<{ email: string; name: string } | null>(null);
  const [prefSaved, setPrefSaved]     = useState(false);
  const [loadError, setLoadError]     = useState("");

  // Load saved provider list from backend + preferences from localStorage
  const loadData = useCallback(async () => {
    try {
      // Non-sensitive preferences
      const prefs = localStorage.getItem("ce_prefs");
      if (prefs) {
        const d = JSON.parse(prefs);
        if (d.llmPriority)      setLlmPriority(d.llmPriority);
        if (d.scraperPriority)  setScraperPriority(d.scraperPriority);
        if (d.llmEnabled)       setLlmEnabled(d.llmEnabled);
        if (d.scraperEnabled)   setScraperEnabled(d.scraperEnabled);
        if (d.language)         setLanguage(d.language);
        if (d.defaultPlatform)  setDefaultPlatform(d.defaultPlatform);
      }

      // Get saved provider list from backend
      const token = await getAuthToken();
      if (!token) { setLoadError("Login karke dobara aao"); return; }

      const res = await fetch(`${BACKEND}/api/keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { keys } = await res.json();
        setSavedProviders(new Set((keys || []).map((k: { provider: string }) => k.provider)));
      }

      // User info
      const me = await fetch("/api/auth/me").then(r => r.json()).catch(() => ({}));
      if (me.user) setUserInfo({ email: me.user.email || "", name: me.user.user_metadata?.full_name || me.user.email || "" });
    } catch (err: any) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveKey = async (providerId: string) => {
    const key = inputKeys[providerId];
    if (!key?.trim()) return;
    setSaving(s => ({ ...s, [providerId]: true }));
    try {
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND}/api/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: providerId, key: key.trim(), label: providerId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }
      setSavedProviders(prev => new Set([...prev, providerId]));
      setInputKeys(k => ({ ...k, [providerId]: "" })); // clear input after save
      setTestStatus(s => ({ ...s, [providerId]: "ok" }));
    } catch (err: any) {
      alert(`Error saving key: ${err.message}`);
    }
    setSaving(s => ({ ...s, [providerId]: false }));
  };

  const testKey = async (providerId: string) => {
    setTesting(t => ({ ...t, [providerId]: true }));
    setTestStatus(s => ({ ...s, [providerId]: "idle" }));
    try {
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND}/api/keys/${providerId}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTestStatus(s => ({ ...s, [providerId]: res.ok && data.success ? "ok" : "error" }));
    } catch {
      setTestStatus(s => ({ ...s, [providerId]: "error" }));
    }
    setTesting(t => ({ ...t, [providerId]: false }));
  };

  const deleteKey = async (providerId: string) => {
    if (!confirm(`${providerId} key delete karna chahte ho?`)) return;
    const token = await getAuthToken();
    await fetch(`${BACKEND}/api/keys/${providerId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSavedProviders(prev => { const n = new Set(prev); n.delete(providerId); return n; });
  };

  const savePrefs = () => {
    localStorage.setItem("ce_prefs", JSON.stringify({ llmPriority, scraperPriority, llmEnabled, scraperEnabled, language, defaultPlatform }));
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 2500);
  };

  const movePriority = (list: string[], idx: number, dir: -1 | 1, setter: (v: string[]) => void) => {
    const n = [...list]; [n[idx], n[idx + dir]] = [n[idx + dir], n[idx]]; setter(n);
  };

  const TABS = [
    { id: "llm",         label: "AI Models",   icon: Zap },
    { id: "scraper",     label: "Scraping",    icon: RefreshCw },
    { id: "preferences", label: "Preferences", icon: Globe },
    { id: "account",     label: "Account",     icon: User },
  ] as const;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold mb-1">Settings</h1>
        <p className="text-muted-foreground text-sm">API keys securely encrypted server pe store hoti hain</p>
      </div>

      {loadError && (
        <div className="p-3 rounded-xl border border-red-400/30 bg-red-400/5 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {loadError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl">
        {TABS.map((tab) => (
          <button key={tab.id} id={`settings-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${activeTab === tab.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {/* ── AI Models Tab ── */}
      {activeTab === "llm" && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl border border-green-400/20 bg-green-400/5 flex items-start gap-3">
            <Lock className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Keys encrypted server pe store hoti hain</p>
              <p className="text-muted-foreground text-xs mt-0.5">AES-256-GCM encryption. Browser ya network mein kabhi plain text nahi jaati.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card space-y-5">
            <h2 className="font-heading font-semibold">AI API Keys</h2>
            {LLM_PROVIDERS.map(p => (
              <div key={p.id}>
                <ApiKeyInput id={`llm-${p.id}`} label={p.label}
                  value={inputKeys[p.id] || ""}
                  onChange={v => setInputKeys(k => ({ ...k, [p.id]: v }))}
                  onSave={() => saveKey(p.id)}
                  onTest={() => testKey(p.id)}
                  saving={!!saving[p.id]} testing={!!testing[p.id]}
                  status={testStatus[p.id] || (savedProviders.has(p.id) ? "ok" : "idle")}
                  helpUrl={p.helpUrl} placeholder={p.placeholder} />
                {savedProviders.has(p.id) && !inputKeys[p.id] && (
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Key saved in server
                    </span>
                    <button onClick={() => deleteKey(p.id)} className="text-xs text-red-400 hover:text-red-500 transition">Remove</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
            <div>
              <h2 className="font-heading font-semibold">AI Priority Order</h2>
              <p className="text-xs text-muted-foreground mt-1">Upar wali API pehle use hogi. Limit khatam hone par auto-switch hoga.</p>
            </div>
            <div className="space-y-2">
              {llmPriority.map((id, i) => {
                const p = LLM_PROVIDERS.find(x => x.id === id)!;
                if (!p) return null;
                return (
                  <PriorityRow key={id} index={i} name={p.name}
                    enabled={llmEnabled[id] !== false}
                    hasSavedKey={savedProviders.has(id)}
                    onToggle={() => setLlmEnabled(e => ({ ...e, [id]: e[id] === false ? true : false }))}
                    onMoveUp={() => movePriority(llmPriority, i, -1, setLlmPriority)}
                    onMoveDown={() => movePriority(llmPriority, i, 1, setLlmPriority)}
                    isFirst={i === 0} isLast={i === llmPriority.length - 1} />
                );
              })}
            </div>
          </div>

          <button id="save-prefs-llm-btn" onClick={savePrefs}
            className="btn-amber w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
            {prefSaved ? <><CheckCircle2 className="w-4 h-4" />Saved!</> : "Save Priority Order"}
          </button>
        </div>
      )}

      {/* ── Scraping Tab ── */}
      {activeTab === "scraper" && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl border border-border bg-card space-y-5">
            <h2 className="font-heading font-semibold">Scraping API Keys</h2>
            <p className="text-xs text-muted-foreground">Competitor analysis ke liye. Platform ke default keys already set hain — apni keys add karo to override karein.</p>
            {SCRAPER_PROVIDERS.map(p => (
              <div key={p.id}>
                <ApiKeyInput id={`scraper-${p.id}`} label={p.label}
                  value={inputKeys[p.id] || ""}
                  onChange={v => setInputKeys(k => ({ ...k, [p.id]: v }))}
                  onSave={() => saveKey(p.id)}
                  onTest={() => testKey(p.id)}
                  saving={!!saving[p.id]} testing={!!testing[p.id]}
                  status={testStatus[p.id] || (savedProviders.has(p.id) ? "ok" : "idle")}
                  helpUrl={p.helpUrl} placeholder={p.placeholder} />
                {savedProviders.has(p.id) && !inputKeys[p.id] && (
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Key saved in server
                    </span>
                    <button onClick={() => deleteKey(p.id)} className="text-xs text-red-400 hover:text-red-500 transition">Remove</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
            <div>
              <h2 className="font-heading font-semibold">Scraping Priority Order</h2>
              <p className="text-xs text-muted-foreground mt-1">Apify credits khatam hone par auto RapidAPI par switch hoga.</p>
            </div>
            <div className="space-y-2">
              {scraperPriority.map((id, i) => {
                const p = SCRAPER_PROVIDERS.find(x => x.id === id)!;
                if (!p) return null;
                return (
                  <PriorityRow key={id} index={i} name={p.name}
                    enabled={scraperEnabled[id] !== false}
                    hasSavedKey={savedProviders.has(id)}
                    onToggle={() => setScraperEnabled(e => ({ ...e, [id]: e[id] === false ? true : false }))}
                    onMoveUp={() => movePriority(scraperPriority, i, -1, setScraperPriority)}
                    onMoveDown={() => movePriority(scraperPriority, i, 1, setScraperPriority)}
                    isFirst={i === 0} isLast={i === scraperPriority.length - 1} />
                );
              })}
            </div>
          </div>

          <button id="save-prefs-scraper-btn" onClick={savePrefs}
            className="btn-amber w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
            {prefSaved ? <><CheckCircle2 className="w-4 h-4" />Saved!</> : "Save Priority Order"}
          </button>
        </div>
      )}

      {/* ── Preferences Tab ── */}
      {activeTab === "preferences" && (
        <div className="p-5 rounded-2xl border border-border bg-card space-y-5">
          <h2 className="font-heading font-semibold">Preferences</h2>

          <div className="space-y-1.5">
            <label htmlFor="pref-platform" className="block text-sm font-medium">Default Platform</label>
            <select id="pref-platform" value={defaultPlatform} onChange={(e) => setDefaultPlatform(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/30">
              {["Instagram", "YouTube", "Facebook"].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Content Language</p>
            <div className="grid grid-cols-2 gap-3">
              {[{ val: "hi", label: "Hindi / Hinglish", emoji: "🇮🇳" }, { val: "en", label: "English", emoji: "🌐" }].map((l) => (
                <button key={l.val} id={`lang-${l.val}`} onClick={() => setLanguage(l.val as "hi" | "en")}
                  className={`p-3 rounded-xl border text-left transition-all text-sm ${language === l.val ? "border-amber-400/60 bg-amber-400/8" : "border-border hover:border-foreground/30"}`}>
                  <span className="text-xl block mb-1">{l.emoji}</span>
                  <span className="font-medium">{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button onClick={savePrefs} className="btn-amber w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
            {prefSaved ? <><CheckCircle2 className="w-4 h-4" />Saved!</> : "Save Preferences"}
          </button>
        </div>
      )}

      {/* ── Account Tab ── */}
      {activeTab === "account" && (
        <div className="p-5 rounded-2xl border border-border bg-card space-y-5">
          <h2 className="font-heading font-semibold">Account</h2>
          <div className="space-y-3">
            {[
              { label: "Email",        value: userInfo?.email || "Loading..." },
              { label: "Name",         value: userInfo?.name  || "Loading..." },
            ].map((field) => (
              <div key={field.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{field.label}</span>
                <span className="text-sm font-medium">{field.value}</span>
              </div>
            ))}
          </div>
          <a href="/api/auth/logout" className="block w-full text-center py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition">
            Sign Out
          </a>
        </div>
      )}
    </div>
  );
}
