"use client";

import { useState } from "react";
import { CreditCard, IndianRupee, ToggleLeft, ToggleRight, Save, RefreshCw, Plus, Trash2, AlertCircle } from "lucide-react";

const BILLING_MODELS = [
  { id: "lifetime", label: "Lifetime (One-time)", desc: "User pays once, gets access forever. No recurring." },
  { id: "monthly", label: "Monthly Subscription", desc: "Auto-billed every 30 days via Razorpay Subscriptions." },
  { id: "yearly", label: "Yearly Subscription", desc: "Annual billing — better retention and LTV." },
  { id: "freemium", label: "Freemium", desc: "Free tier + paid upgrade for advanced features." },
];

const PROMO_CODES = [
  { code: "LAUNCH50", discount: 50, uses: 23, maxUses: 100, expiry: "31 Dec 2026", active: true },
  { code: "FRIEND25", discount: 25, uses: 8, maxUses: 50, expiry: "30 Jun 2026", active: true },
  { code: "HOLI2025", discount: 100, uses: 45, maxUses: 45, expiry: "15 Mar 2025", active: false },
];

export default function AdminSubscriptionsPage() {
  const [billingModel, setBillingModel] = useState("lifetime");
  const [price, setPrice] = useState("9");
  const [currency, setCurrency] = useState("INR");
  const [signupsEnabled, setSignupsEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const [promos, setPromos] = useState(PROMO_CODES);
  const [newCode, setNewCode] = useState("");
  const [newDiscount, setNewDiscount] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("");

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addPromo = () => {
    if (!newCode || !newDiscount) return;
    setPromos(p => [...p, { code: newCode.toUpperCase(), discount: +newDiscount, uses: 0, maxUses: +newMaxUses || 100, expiry: "31 Dec 2026", active: true }]);
    setNewCode(""); setNewDiscount(""); setNewMaxUses("");
  };

  const togglePromo = (idx: number) => setPromos(p => p.map((x, i) => i === idx ? { ...x, active: !x.active } : x));
  const deletePromo = (idx: number) => setPromos(p => p.filter((_, i) => i !== idx));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-heading text-2xl font-bold text-zinc-100">Subscription Management</h1>
        <p className="text-zinc-500 text-sm">Control pricing model, billing cycle, and access settings</p>
      </div>

      {/* Billing Model */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
        <h2 className="font-semibold text-zinc-100 flex items-center gap-2"><CreditCard className="w-4 h-4 text-amber-400" /> Billing Model</h2>
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

        {billingModel !== "freemium" && (
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-zinc-400 block mb-1.5">
                {billingModel === "lifetime" ? "One-time Price" : billingModel === "monthly" ? "Monthly Price" : "Yearly Price"}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 font-bold">₹</span>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
              </div>
            </div>
            <div className="text-xs text-zinc-500 space-y-1">
              <p>Current: <span className="text-amber-400 font-bold">₹9</span> lifetime</p>
              <p>Revenue: <span className="text-green-400">₹2,016</span> total</p>
            </div>
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
            <AlertCircle className="w-3.5 h-3.5" /> New users will see "Waitlist mode" on the landing page
          </div>
        )}
      </div>

      {/* Promo Codes */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
        <h2 className="font-semibold text-zinc-100 flex items-center gap-2"><IndianRupee className="w-4 h-4 text-green-400" /> Promo Codes</h2>

        <div className="space-y-2">
          {promos.map((p, i) => (
            <div key={p.code} className={`flex items-center gap-3 p-3 rounded-lg border ${p.active ? "border-zinc-800 bg-zinc-900" : "border-zinc-800/50 bg-zinc-900/50 opacity-50"}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-400 text-sm">{p.code}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">{p.discount}% off</span>
                  {!p.active && <span className="text-xs text-zinc-600">Expired/Disabled</span>}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{p.uses}/{p.maxUses} uses · Expires {p.expiry}</p>
              </div>
              <button onClick={() => togglePromo(i)} className="text-xs text-zinc-500 hover:text-zinc-300 transition">
                {p.active ? "Disable" : "Enable"}
              </button>
              <button onClick={() => deletePromo(i)} className="text-red-500 hover:text-red-400 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input placeholder="CODE" value={newCode} onChange={e => setNewCode(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
          <input placeholder="% discount" type="number" value={newDiscount} onChange={e => setNewDiscount(e.target.value)}
            className="w-28 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
          <input placeholder="Max uses" type="number" value={newMaxUses} onChange={e => setNewMaxUses(e.target.value)}
            className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
          <button onClick={addPromo} className="px-4 py-2 rounded-lg bg-amber-500 text-black font-bold text-sm flex items-center gap-1 hover:bg-amber-400 transition">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {/* Save */}
      <button onClick={handleSave} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition ${saved ? "bg-green-500 text-white" : "bg-red-500 text-white hover:bg-red-400"}`}>
        {saved ? <><RefreshCw className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Changes</>}
      </button>
    </div>
  );
}
