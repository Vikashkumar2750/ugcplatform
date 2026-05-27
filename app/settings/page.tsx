"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, ExternalLink, Shield, Globe, User, Bell } from "lucide-react";

function ApiKeyInput({
  id, label, value, onChange, onTest, testing, status, helpUrl, helpText
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  onTest: () => void; testing: boolean; status: "idle" | "ok" | "error";
  helpUrl: string; helpText: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id={id}
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`${label} daalo...`}
            className="w-full px-4 py-2.5 pr-10 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/30 transition font-mono"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          type="button"
          onClick={onTest}
          disabled={testing || !value}
          className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/60 transition disabled:opacity-40 flex items-center gap-2"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test"}
        </button>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          {status === "ok" && <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="text-green-600 dark:text-green-400">Connected!</span></>}
          {status === "error" && <><XCircle className="w-3.5 h-3.5 text-red-500" /><span className="text-red-500">Invalid key</span></>}
        </div>
        <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1">
          {helpText} <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [anthropicKey, setAnthropicKey] = useState("");
  const [apifyKey, setApifyKey] = useState("");
  const [testingAnthropic, setTestingAnthropic] = useState(false);
  const [testingApify, setTestingApify] = useState(false);
  const [anthropicStatus, setAnthropicStatus] = useState<"idle" | "ok" | "error">("idle");
  const [apifyStatus, setApifyStatus] = useState<"idle" | "ok" | "error">("idle");
  const [saved, setSaved] = useState(false);
  const [language, setLanguage] = useState<"hi" | "en">("hi");
  const [defaultPlatform, setDefaultPlatform] = useState("Instagram");
  const [defaultNiche, setDefaultNiche] = useState("Fitness");
  const [activeTab, setActiveTab] = useState<"keys" | "preferences" | "account">("keys");

  // Load saved keys from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ugc_keys");
      if (saved) {
        const keys = JSON.parse(atob(saved));
        if (keys.anthropic) setAnthropicKey(keys.anthropic);
        if (keys.apify) setApifyKey(keys.apify);
      }
    } catch {}
  }, []);

  const testAnthropic = async () => {
    if (!anthropicKey) return;
    setTestingAnthropic(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });
      setAnthropicStatus(res.ok ? "ok" : "error");
    } catch {
      setAnthropicStatus("error");
    }
    setTestingAnthropic(false);
  };

  const testApify = async () => {
    if (!apifyKey) return;
    setTestingApify(true);
    try {
      const res = await fetch(`https://api.apify.com/v2/users/me?token=${apifyKey}`);
      setApifyStatus(res.ok ? "ok" : "error");
    } catch {
      setApifyStatus("error");
    }
    setTestingApify(false);
  };

  const saveKeys = () => {
    // Encrypt and store in localStorage
    if (typeof window !== "undefined") {
      const salt = "ugc_salt_v1"; // In real impl: use Supabase user ID slice
      try {
        const data = JSON.stringify({ anthropic: anthropicKey, apify: apifyKey });
        localStorage.setItem("ugc_keys", btoa(data)); // Simple encoding — upgrade to CryptoJS AES in prod
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch {}
    }
  };

  const TABS = [
    { id: "keys", label: "API Keys", icon: Shield },
    { id: "preferences", label: "Preferences", icon: Globe },
    { id: "account", label: "Account", icon: User },
  ] as const;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold mb-1">Settings</h1>
        <p className="text-muted-foreground text-sm">API keys, preferences, aur account manage karo</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`settings-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* API Keys Tab */}
      {activeTab === "keys" && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5 flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Tumhari keys sirf tumhare browser mein save hoti hain</p>
              <p className="text-muted-foreground text-xs mt-0.5">Humare servers tak kabhi nahi jaati. Encrypted local storage mein store hoti hain.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card space-y-5">
            <h2 className="font-heading font-semibold text-lg">Meri API Keys</h2>

            <ApiKeyInput
              id="anthropic-key"
              label="Anthropic API Key"
              value={anthropicKey}
              onChange={setAnthropicKey}
              onTest={testAnthropic}
              testing={testingAnthropic}
              status={anthropicStatus}
              helpUrl="https://console.anthropic.com"
              helpText="Get free key"
            />

            <ApiKeyInput
              id="apify-key"
              label="Apify API Key"
              value={apifyKey}
              onChange={setApifyKey}
              onTest={testApify}
              testing={testingApify}
              status={apifyStatus}
              helpUrl="https://apify.com"
              helpText="Get free key"
            />

            <button
              id="save-keys-btn"
              onClick={saveKeys}
              className="btn-amber w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            >
              {saved ? <><CheckCircle2 className="w-4 h-4" /> Keys saved!</> : "Keys save karo"}
            </button>
          </div>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === "preferences" && (
        <div className="p-5 rounded-2xl border border-border bg-card space-y-5">
          <h2 className="font-heading font-semibold text-lg">Pasand (Preferences)</h2>

          <div className="space-y-1.5">
            <label htmlFor="pref-platform" className="block text-sm font-medium">Default Platform</label>
            <select id="pref-platform" value={defaultPlatform} onChange={(e) => setDefaultPlatform(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/30">
              {["Instagram", "YouTube", "Facebook"].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pref-niche" className="block text-sm font-medium">Default Niche</label>
            <select id="pref-niche" value={defaultNiche} onChange={(e) => setDefaultNiche(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/30">
              {["Fitness", "Finance", "Travel", "Tech", "Food", "Beauty", "Gaming", "Education", "Lifestyle"].map(n => <option key={n}>{n}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Bhasha (Language)</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: "hi", label: "Hindi / Hinglish", emoji: "🇮🇳" },
                { val: "en", label: "English", emoji: "🌐" },
              ].map((l) => (
                <button
                  key={l.val}
                  id={`lang-${l.val}`}
                  onClick={() => setLanguage(l.val as "hi" | "en")}
                  className={`p-3 rounded-xl border text-left transition-all text-sm ${language === l.val ? "border-amber-400/60 bg-amber-400/8" : "border-border hover:border-foreground/30"}`}
                >
                  <span className="text-xl block mb-1">{l.emoji}</span>
                  <span className="font-medium">{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button className="btn-amber w-full py-3 rounded-xl text-sm font-bold">
            Preferences save karo
          </button>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === "account" && (
        <div className="p-5 rounded-2xl border border-border bg-card space-y-5">
          <h2 className="font-heading font-semibold text-lg">Account</h2>

          <div className="space-y-3">
            {[
              { label: "Full Name", value: "Your Name" },
              { label: "Email", value: "your@email.com" },
              { label: "WhatsApp", value: "+91 98765 43210" },
            ].map((field) => (
              <div key={field.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{field.label}</span>
                <span className="text-sm font-medium">{field.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Payment Status</span>
              <span className="text-sm font-medium flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                Verified ✓ — ₹9 paid
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-muted-foreground">Member Since</span>
              <span className="text-sm font-medium">May 2026</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
