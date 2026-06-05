"use client";

import { useState } from "react";
import {
  CheckCircle2, Zap, Star, Shield, Clock, ArrowRight,
  IndianRupee, QrCode, Smartphone, Copy, CheckCheck, Loader2, X
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PLANS = [
  {
    id: "lifetime",
    label: "Lifetime Access",
    price: 9,
    period: " one-time",
    desc: "Pay once, use forever. Limited launch offer.",
    badge: "Limited ⚡",
    color: "border-amber-400 ring-2 ring-amber-400/20",
    btnClass: "btn-amber",
    features: [
      "Unlimited AI content analyses",
      "Competitor research & tracking",
      "Trend discovery (India 2025)",
      "30-day content pipeline",
      "Instagram + Facebook + YouTube",
      "All future features included",
      "No recurring charges ever",
    ],
  },
];

// Payment steps
type Step = "plan" | "qr" | "utr" | "done";

interface UPIData {
  txnId: string;
  upiId: string;
  gpayLink: string;
  phonepeLink: string;
  upiLink: string;
  amountInr: number;
  merchantName: string;
}

export default function PricingPage() {
  const [step, setStep]             = useState<Step>("plan");
  const [loading, setLoading]       = useState(false);
  const [upiData, setUpiData]       = useState<UPIData | null>(null);
  const [utr, setUtr]               = useState("");
  const [copied, setCopied]         = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError]           = useState("");

  const initPayment = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login?next=/pricing";
        return;
      }

      const res = await fetch("/api/payments/upi-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, userEmail: user.email }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Payment init failed");

      setUpiData(data);
      setStep("qr");
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const copyUPI = () => {
    navigator.clipboard.writeText(upiData?.upiId || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submitUTR = async () => {
    if (!utr.trim() || !upiData) return;
    setSubmitLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch("/api/payments/upi-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txnId: upiData.txnId, utr: utr.trim(), userId: user?.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Verification failed");
      setStep("done");
    } catch (err: any) {
      setError(err.message);
    }
    setSubmitLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-16">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Zap className="w-3 h-3" /> Launch Offer — ₹9 Only
          </div>
          <h1 className="font-heading text-4xl font-black mb-3">
            Sirf <span className="text-gradient">₹9</span> mein lifetime access
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            UPI se pay karo — Google Pay, PhonePe, BHIM, Paytm sab supported hain.
          </p>
        </div>

        {/* ── STEP 1: Plan Card ── */}
        {step === "plan" && (
          <div className="max-w-md mx-auto">
            {PLANS.map(plan => (
              <div key={plan.id} className={`relative rounded-2xl border ${plan.color} bg-card p-8 flex flex-col`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-400 text-black text-xs font-bold whitespace-nowrap">
                    {plan.badge}
                  </div>
                )}
                <div className="mb-6 text-center">
                  <h2 className="font-heading font-bold text-xl">{plan.label}</h2>
                  <div className="flex items-end gap-1 mt-3 justify-center">
                    <span className="font-heading text-6xl font-black">₹{plan.price}</span>
                    <span className="text-muted-foreground text-sm mb-2">{plan.period}</span>
                  </div>
                  <p className="text-muted-foreground text-sm mt-2">{plan.desc}</p>
                </div>

                <ul className="space-y-2.5 flex-1 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center gap-2">
                    <X className="w-4 h-4 flex-shrink-0" />{error}
                  </div>
                )}

                <button
                  id="pay-upi-btn"
                  onClick={initPayment}
                  disabled={loading}
                  className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition ${plan.btnClass} disabled:opacity-60`}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><IndianRupee className="w-5 h-5" /> Pay ₹{plan.price} via UPI</>}
                </button>
                <p className="text-center text-xs text-muted-foreground mt-3">Google Pay · PhonePe · BHIM · Paytm</p>
              </div>
            ))}
          </div>
        )}

        {/* ── STEP 2: QR + UPI Links ── */}
        {step === "qr" && upiData && (
          <div className="max-w-md mx-auto space-y-5">
            <div className="p-6 rounded-2xl border border-border bg-card text-center space-y-4">
              <h2 className="font-heading font-bold text-xl">₹{upiData.amountInr} Pay Karo</h2>
              <p className="text-sm text-muted-foreground">Kisi bhi UPI app se pay karo</p>

              {/* UPI ID Copy */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border">
                <span className="flex-1 text-sm font-mono font-medium">{upiData.upiId}</span>
                <button onClick={copyUPI} className="p-1.5 rounded-lg hover:bg-muted transition">
                  {copied ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>

              {/* UPI App Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <a href={upiData.gpayLink}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition text-sm font-medium">
                  <Smartphone className="w-4 h-4 text-green-500" /> Google Pay
                </a>
                <a href={upiData.phonepeLink}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition text-sm font-medium">
                  <Smartphone className="w-4 h-4 text-purple-500" /> PhonePe
                </a>
                <a href={upiData.upiLink} className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition text-sm font-medium">
                  <QrCode className="w-4 h-4 text-amber-500" /> Any UPI App
                </a>
              </div>

              <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-xs text-amber-700 dark:text-amber-300 text-left">
                <p className="font-medium mb-1">Payment ke baad:</p>
                <p>UTR / Transaction ID note karo — next step mein enter karna hoga</p>
              </div>

              <button
                id="paid-done-btn"
                onClick={() => setStep("utr")}
                className="btn-amber w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                Payment ho gayi — UTR Enter Karo <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: UTR Entry ── */}
        {step === "utr" && upiData && (
          <div className="max-w-md mx-auto">
            <div className="p-6 rounded-2xl border border-border bg-card space-y-5">
              <div>
                <h2 className="font-heading font-bold text-xl">UTR Number Enter Karo</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  UPI app mein transaction history → UTR / Reference number milega
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="utr-input" className="text-xs font-medium text-muted-foreground block">
                  UTR / UPI Reference Number
                </label>
                <input
                  id="utr-input"
                  type="text"
                  value={utr}
                  onChange={e => setUtr(e.target.value)}
                  placeholder="e.g. 408621345678"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition"
                />
                <p className="text-xs text-muted-foreground">12-22 digit number hota hai</p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center gap-2">
                  <X className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              <button
                id="submit-utr-btn"
                onClick={submitUTR}
                disabled={submitLoading || !utr.trim()}
                className="btn-amber w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Submit UTR <ArrowRight className="w-4 h-4" /></>}
              </button>

              <button onClick={() => setStep("qr")} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition py-2">
                ← Wapas QR par jao
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Success ── */}
        {step === "done" && (
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="p-8 rounded-2xl border border-green-400/30 bg-green-400/5">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="font-heading font-bold text-2xl mb-2">Payment Submitted! 🎉</h2>
              <p className="text-muted-foreground text-sm">
                Tumhara UTR verify ho raha hai. <strong>24 ghante</strong> mein access mil jayega.
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                Problem? support@techaasvik.in par email karo
              </p>
            </div>
            <a href="/dashboard" className="btn-amber block w-full py-3 rounded-xl font-bold text-sm text-center">
              Dashboard Par Jao →
            </a>
          </div>
        )}

        {/* Trust badges */}
        {step === "plan" && (
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground mt-12">
            {[
              { icon: Shield, label: "UPI secured by NPCI" },
              { icon: Clock, label: "Access in 24 hours" },
              { icon: Star, label: "247+ creators use this" },
              { icon: IndianRupee, label: "No hidden charges" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon className="w-4 h-4 text-amber-500" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
