"use client";

import { useState, useEffect } from "react";
import { CreditCard, IndianRupee, ToggleLeft, ToggleRight, Save, Plus, Trash2, AlertCircle, Loader2, CheckCircle2, Users } from "lucide-react";

function GrantMultiAccountSection() {
  const [email, setEmail] = useState("");
  const [maxAccounts, setMaxAccounts] = useState("5");
  const [granting, setGranting] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const grantAccess = async () => {
    if (!email.trim()) return;
    setGranting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/grant-multi-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), maxAccountsPerPlatform: parseInt(maxAccounts) || 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult({ success: true, message: data.message || `Granted ${maxAccounts} accounts/platform to ${email}` });
      setEmail("");
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    }
    setGranting(false);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
      <h2 className="font-semibold text-zinc-100 flex items-center gap-2">
        <Users className="w-4 h-4 text-violet-400" /> Grant Multi-Account Access
      </h2>
      <p className="text-xs text-zinc-500">
        Manually upgrade a user to Pro tier. They can connect up to N accounts per platform.
      </p>
      <div className="flex gap-2">
        <input
          placeholder="User email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
        <input
          placeholder="Max accounts"
          type="number"
          min="1"
          max="10"
          value={maxAccounts}
          onChange={e => setMaxAccounts(e.target.value)}
          className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
        <button
          onClick={grantAccess}
          disabled={granting || !email.trim()}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm flex items-center gap-1 hover:from-violet-500 hover:to-indigo-500 transition disabled:opacity-50"
        >
          {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
          Grant Pro
        </button>
      </div>
      {result && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
          result.success ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"
        }`}>
          {result.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {result.message}
        </div>
      )}
    </div>
  );
}

const BILLING_MODELS = [
  { id: "lifetime", label: "Lifetime (One-time)", desc: "User pays once, gets access forever." },
  { id: "monthly", label: "Monthly Subscription", desc: "Auto-billed every 30 days via Razorpay." },
  { id: "yearly", label: "Yearly Subscription", desc: "Annual billing — better retention and LTV." },
  { id: "freemium", label: "Freemium", desc: "Free tier + paid upgrade for advanced features." },
];

interface Promo {
  id: string;
  code: string;
  discount_percent: number;
  uses: number;
  max_uses: number;
  expiry_date: string | null;
  is_active: boolean;
}

export default function AdminSubscriptionsPage() {
  const [billingModel, setBillingModel] = useState("lifetime");
  const [prices, setPrices] = useState({ lifetime: "9", monthly: "99", yearly: "799" });
  const [signupsEnabled, setSignupsEnabled] = useState(true);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDiscount, setNewDiscount] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("");

  // Fetch settings on load
  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(data => {
        if (!data.demo && data.settings) {
          const s = data.settings;
          setBillingModel(s.billing_model || "lifetime");
          setPrices({
            lifetime: s.price_lifetime || "9",
            monthly: s.price_monthly || "99",
            yearly: s.price_yearly || "799",
          });
          setSignupsEnabled(s.signups_enabled !== "false");
        }
        setPromos(data.promos || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            billing_model: billingModel,
            price_lifetime: prices.lifetime,
            price_monthly: prices.monthly,
            price_yearly: prices.yearly,
            signups_enabled: String(signupsEnabled),
          },
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addPromo = async () => {
    if (!newCode || !newDiscount) return;
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promoAction: "add",
        promo: { code: newCode, discount: +newDiscount, maxUses: +newMaxUses || 100 },
      }),
    });
    if (res.ok) {
      setNewCode(""); setNewDiscount(""); setNewMaxUses("");
      // Refresh promos
      const data = await fetch("/api/admin/settings").then(r => r.json());
      setPromos(data.promos || []);
    }
  };

  const togglePromo = async (promo: Promo) => {
    // Optimistic update
    setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, is_active: !p.is_active } : p));
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoAction: "toggle", promo }),
    });
  };

  const deletePromo = async (promo: Promo) => {
    setPromos(prev => prev.filter(p => p.id !== promo.id));
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoAction: "delete", promo }),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-zinc-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading subscription settings...
      </div>
    );
  }

  const currentPrice = prices[billingModel as keyof typeof prices] || "9";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-zinc-100">Subscription Management</h1>
          <p className="text-zinc-500 text-sm">Control pricing model, billing cycle, and access settings</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" /> Saved to database
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Billing Model */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
        <h2 className="font-semibold text-zinc-100 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-amber-400" /> Billing Model
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BILLING_MODELS.map(m => (
            <button key={m.id} onClick={() => setBillingModel(m.id)}
              className={`text-left p-4 rounded-xl border transition ${billingModel === m.id ? "border-amber-500/50 bg-amber-500/5" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded-full border-2 ${billingModel === m.id ? "border-amber-400 bg-amber-400" : "border-zinc-600"}`} />
                <span className="text-sm font-semibold text-zinc-200">{m.label}</span>
              </div>
              <p className="text-xs text-zinc-500 ml-5">{m.desc}</p>
            </button>
          ))}
        </div>

        {/* Price inputs for each model */}
        {billingModel !== "freemium" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { key: "lifetime", label: "Lifetime Price (₹)" },
              { key: "monthly", label: "Monthly Price (₹)" },
              { key: "yearly", label: "Yearly Price (₹)" },
            ].map(p => (
              <div key={p.key} className={`p-4 rounded-xl border ${billingModel === p.key ? "border-amber-500/40 bg-amber-500/5" : "border-zinc-800 bg-zinc-900"}`}>
                <label className="text-xs font-medium text-zinc-400 block mb-1.5">{p.label}</label>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={prices[p.key as keyof typeof prices]}
                    onChange={e => setPrices(prev => ({ ...prev, [p.key]: e.target.value }))}
                    min="0"
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                {billingModel === p.key && (
                  <p className="text-xs text-amber-400 mt-1 font-medium">✓ Active model</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Signups Toggle */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-zinc-100">New Signups</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Disable to stop new users from registering</p>
          </div>
          <button onClick={() => setSignupsEnabled(!signupsEnabled)} className="flex items-center gap-2">
            {signupsEnabled
              ? <><ToggleRight className="w-8 h-8 text-green-400" /><span className="text-sm text-green-400 font-medium">Enabled</span></>
              : <><ToggleLeft className="w-8 h-8 text-zinc-500" /><span className="text-sm text-zinc-500 font-medium">Disabled</span></>
            }
          </button>
        </div>
        {!signupsEnabled && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5" /> New users will see &ldquo;Waitlist mode&rdquo; on the landing page
          </div>
        )}
      </div>

      {/* Promo Codes */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
        <h2 className="font-semibold text-zinc-100 flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-green-400" /> Promo Codes
        </h2>
        <div className="space-y-2">
          {promos.length === 0 && (
            <p className="text-sm text-zinc-600 text-center py-4">No promo codes yet</p>
          )}
          {promos.map(p => (
            <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border ${p.is_active ? "border-zinc-800 bg-zinc-900" : "border-zinc-800/50 bg-zinc-900/50 opacity-50"}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-400 text-sm">{p.code}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">{p.discount_percent}% off</span>
                  {!p.is_active && <span className="text-xs text-zinc-600">Disabled</span>}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {p.uses}/{p.max_uses} uses{p.expiry_date ? ` · Expires ${new Date(p.expiry_date).toLocaleDateString("en-IN")}` : ""}
                </p>
              </div>
              <button onClick={() => togglePromo(p)} className="text-xs text-zinc-500 hover:text-zinc-300 transition">
                {p.is_active ? "Disable" : "Enable"}
              </button>
              <button onClick={() => deletePromo(p)} className="text-red-500 hover:text-red-400 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new promo */}
        <div className="flex gap-2">
          <input placeholder="CODE" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 uppercase" />
          <input placeholder="% off" type="number" value={newDiscount} onChange={e => setNewDiscount(e.target.value)}
            className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
          <input placeholder="Max uses" type="number" value={newMaxUses} onChange={e => setNewMaxUses(e.target.value)}
            className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
          <button onClick={addPromo} className="px-4 py-2 rounded-lg bg-amber-500 text-black font-bold text-sm flex items-center gap-1 hover:bg-amber-400 transition">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {/* Grant Multi-Account Access */}
      <GrantMultiAccountSection />

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition disabled:opacity-60 ${
          saved ? "bg-green-500 text-white" : "bg-red-500 text-white hover:bg-red-400"
        }`}
      >
        {saving ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
        ) : saved ? (
          <><CheckCircle2 className="w-4 h-4" /> Saved!</>
        ) : (
          <><Save className="w-4 h-4" /> Save Changes</>
        )}
      </button>
    </div>
  );
}
