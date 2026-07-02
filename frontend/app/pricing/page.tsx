"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2, Zap, Star, Shield, Clock, ArrowRight,
  IndianRupee, Loader2, X, CreditCard, Smartphone, Copy, CheckCheck, QrCode
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const RAZORPAY_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

const PLANS = [
  {
    id: "lifetime",
    razorpayPlan: "lifetime",
    label: "Lifetime Access",
    price: 9,
    period: " one-time",
    desc: "Pay once, use forever. Limited launch offer.",
    badge: "Limited ⚡",
    color: "border-amber-400 ring-2 ring-amber-400/20",
    btnClass: "btn-amber",
    category: "basic" as const,
    features: [
      "Unlimited AI content analyses",
      "Competitor research & tracking",
      "Trend discovery (India 2025)",
      "30-day content pipeline",
      "1 account per platform",
      "All future basic features",
      "No recurring charges ever",
    ],
  },
  {
    id: "pro_monthly",
    razorpayPlan: "monthly",
    label: "Pro Monthly",
    price: 59,
    period: "/month",
    desc: "Connect up to 5 accounts per platform. Cancel anytime.",
    badge: "PRO",
    color: "border-violet-500 ring-2 ring-violet-500/20",
    btnClass: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700",
    category: "pro" as const,
    features: [
      "Everything in Lifetime, plus:",
      "5× Instagram accounts",
      "5× Facebook pages",
      "5× YouTube channels",
      "5× LinkedIn profiles",
      "Publish & automate all at once",
      "Priority support",
    ],
  },
  {
    id: "pro_6month",
    razorpayPlan: "lifetime",
    label: "Pro 6-Month",
    price: 299,
    period: " for 6 months",
    desc: "Save 15% — best for growing agencies.",
    badge: "SAVE 15%",
    color: "border-violet-500 ring-2 ring-violet-500/20",
    btnClass: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700",
    category: "pro" as const,
    features: [
      "Everything in Lifetime, plus:",
      "5× Instagram accounts",
      "5× Facebook pages",
      "5× YouTube channels",
      "5× LinkedIn profiles",
      "Publish & automate all at once",
      "Priority support",
    ],
  },
  {
    id: "pro_yearly",
    razorpayPlan: "yearly",
    label: "Pro Yearly",
    price: 599,
    period: "/year",
    desc: "Save 50% — best value for serious creators.",
    badge: "BEST VALUE 🏆",
    color: "border-emerald-500 ring-2 ring-emerald-500/20",
    btnClass: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700",
    category: "pro" as const,
    features: [
      "Everything in Lifetime, plus:",
      "5× Instagram accounts",
      "5× Facebook pages",
      "5× YouTube channels",
      "5× LinkedIn profiles",
      "Publish & automate all at once",
      "Priority support",
      "Early access to new features",
    ],
  },
];

declare global {
  interface Window { Razorpay: any; }
}

type PayStep = "plan" | "upi_pay" | "upi_utr" | "success";

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
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<PayStep>("plan");
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[number] | null>(null);
  // UPI state
  const [upiData, setUpiData] = useState<UPIData | null>(null);
  const [utr, setUtr] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      setScriptLoaded(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => setScriptLoaded(true);
    document.head.appendChild(s);
  }, []);

  const getUser = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  };

  // ── Razorpay Checkout ──
  const handleRazorpay = async (plan: typeof PLANS[number]) => {
    setError("");
    setLoadingPlan(plan.id);
    try {
      const user = await getUser();
      if (!user) {
        window.location.href = `/login?next=/pricing&plan=${plan.id}`;
        return;
      }

      const res = await fetch("/api/payments/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planType: plan.id === "pro_monthly" ? "monthly" : plan.id === "pro_yearly" ? "yearly" : plan.id,
          userEmail: user.email,
          userName: user.user_metadata?.full_name || user.email,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Payment init failed");

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Payment gateway loading... please try again.");
      }

      const options: any = {
        key: RAZORPAY_KEY,
        name: "Content Engineer",
        description: `${plan.label} — ₹${plan.price}${plan.period}`,
        image: "/icon.png",
        prefill: { email: user.email, name: user.user_metadata?.full_name || "" },
        theme: { color: "#f59e0b" },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id || null,
                razorpay_subscription_id: response.razorpay_subscription_id || null,
                razorpay_signature: response.razorpay_signature,
                planType: plan.id === "pro_monthly" ? "monthly" : plan.id === "pro_yearly" ? "yearly" : plan.id,
                userId: user.id,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || verifyData.error) setError(verifyData.error || "Verification failed");
            else setStep("success");
          } catch (e: any) { setError(e.message); }
        },
        modal: { ondismiss: () => setLoadingPlan(null) },
      };

      if (data.type === "order") {
        options.order_id = data.orderId;
        options.amount = data.amount;
        options.currency = data.currency;
      } else {
        options.subscription_id = data.subscriptionId;
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) { setError(err.message); }
    setLoadingPlan(null);
  };

  // ── UPI Direct ──
  const handleUPI = async (plan: typeof PLANS[number]) => {
    setError("");
    setLoadingPlan(plan.id);
    try {
      const user = await getUser();
      if (!user) {
        window.location.href = `/login?next=/pricing&plan=${plan.id}`;
        return;
      }

      const res = await fetch("/api/payments/upi-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, userEmail: user.email }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "UPI init failed");

      setUpiData(data);
      setSelectedPlan(plan);
      setStep("upi_pay");
    } catch (err: any) { setError(err.message); }
    setLoadingPlan(null);
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
      const user = await getUser();
      const res = await fetch("/api/payments/upi-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txnId: upiData.txnId, utr: utr.trim(), userId: user?.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Verification failed");
      setStep("success");
    } catch (err: any) { setError(err.message); }
    setSubmitLoading(false);
  };

  // ── SUCCESS SCREEN ──
  if (step === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="p-8 rounded-2xl border border-green-400/30 bg-green-400/5">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="font-heading font-bold text-2xl mb-2">Payment Successful! 🎉</h2>
            <p className="text-muted-foreground text-sm">
              Your plan is now active. Start connecting accounts and creating content!
            </p>
          </div>
          <a href="/dashboard" className="btn-amber block w-full py-3 rounded-xl font-bold text-sm text-center">
            Go to Dashboard →
          </a>
        </div>
      </div>
    );
  }

  // ── UPI PAY SCREEN ──
  if (step === "upi_pay" && upiData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-5">
          <div className="p-6 rounded-2xl border border-border bg-card text-center space-y-4">
            <h2 className="font-heading font-bold text-xl">₹{upiData.amountInr} Pay Karo</h2>
            <p className="text-sm text-muted-foreground">Kisi bhi UPI app se pay karo — {selectedPlan?.label}</p>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border">
              <span className="flex-1 text-sm font-mono font-medium">{upiData.upiId}</span>
              <button onClick={copyUPI} className="p-1.5 rounded-lg hover:bg-muted transition">
                {copied ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <a href={upiData.gpayLink} className="flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition text-sm font-medium">
                <Smartphone className="w-4 h-4 text-green-500" /> Google Pay
              </a>
              <a href={upiData.phonepeLink} className="flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition text-sm font-medium">
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

            <button onClick={() => setStep("upi_utr")}
              className="btn-amber w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
              Payment ho gayi — UTR Enter Karo <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => { setStep("plan"); setUpiData(null); }} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
            ← Back to Plans
          </button>
        </div>
      </div>
    );
  }

  // ── UTR ENTRY SCREEN ──
  if (step === "upi_utr" && upiData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
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

            <button onClick={submitUTR} disabled={submitLoading || !utr.trim()}
              className="btn-amber w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Submit UTR <ArrowRight className="w-4 h-4" /></>}
            </button>

            <button onClick={() => setStep("upi_pay")} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition py-2">
              ← Wapas QR par jao
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PLAN SELECTION SCREEN ──
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-16">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Zap className="w-3 h-3" /> Choose Your Plan
          </div>
          <h1 className="font-heading text-4xl font-black mb-3">
            Start with <span className="text-gradient">₹9</span> — Scale with <span className="bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">Pro</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Pay via Razorpay (cards, net banking, wallets) or UPI direct (GPay, PhonePe, BHIM).
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="max-w-lg mx-auto mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            <X className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Plan Cards — 2 per row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {PLANS.map(plan => (
            <div key={plan.id} className={`relative rounded-2xl border ${plan.color} bg-card p-6 flex flex-col`}>
              {plan.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                  plan.id === "pro_yearly" ? "bg-emerald-500 text-white"
                  : plan.category === "pro" ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white"
                  : "bg-amber-400 text-black"
                }`}>
                  {plan.badge}
                </div>
              )}
              <div className="mb-4 text-center">
                <h2 className="font-heading font-bold text-lg">{plan.label}</h2>
                <div className="flex items-end gap-1 mt-2 justify-center">
                  <span className="font-heading text-4xl font-black">₹{plan.price}</span>
                  <span className="text-muted-foreground text-xs mb-1">{plan.period}</span>
                </div>
                <p className="text-muted-foreground text-xs mt-1">{plan.desc}</p>
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                      plan.category === "pro" ? "text-violet-500" : "text-amber-500"
                    }`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {/* Two payment buttons */}
              <div className="space-y-2">
                <button
                  id={`pay-razorpay-${plan.id}`}
                  onClick={() => handleRazorpay(plan)}
                  disabled={loadingPlan !== null}
                  className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${plan.btnClass} disabled:opacity-60`}>
                  {loadingPlan === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><CreditCard className="w-4 h-4" /> Pay ₹{plan.price}</>
                  )}
                </button>
                <button
                  id={`pay-upi-${plan.id}`}
                  onClick={() => handleUPI(plan)}
                  disabled={loadingPlan !== null}
                  className="w-full py-2.5 rounded-xl border border-border text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted/50 transition text-muted-foreground hover:text-foreground disabled:opacity-60">
                  <IndianRupee className="w-3.5 h-3.5" /> Pay via UPI Direct
                </button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground mt-2">
                Cards · Net Banking · UPI · GPay · PhonePe
              </p>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground mt-12">
          {[
            { icon: Shield, label: "Razorpay secured" },
            { icon: Clock, label: "Instant access" },
            { icon: Star, label: "247+ creators use this" },
            { icon: IndianRupee, label: "No hidden charges" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <Icon className="w-4 h-4 text-amber-500" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
