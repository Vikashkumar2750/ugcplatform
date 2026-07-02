"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2, Zap, Star, Shield, Clock, ArrowRight,
  IndianRupee, Loader2, X, CreditCard
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
    razorpayPlan: "lifetime", // one-time payment of ₹299
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
  interface Window {
    Razorpay: any;
  }
}

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

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

  const handleBuy = async (plan: typeof PLANS[number]) => {
    setError("");
    setLoadingPlan(plan.id);

    try {
      // 1. Check if user is logged in
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Save selected plan, redirect to login, then come back
        window.location.href = `/login?next=/pricing&plan=${plan.id}`;
        return;
      }

      // 2. Create order/subscription on backend
      const res = await fetch("/api/payments/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planType: plan.id === "pro_6month" ? "lifetime" : plan.razorpayPlan,
          userEmail: user.email,
          userName: user.user_metadata?.full_name || user.email,
          // For 6-month plan, override the amount
          ...(plan.id === "pro_6month" ? { amountOverride: 29900 } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Payment init failed");

      // 3. Open Razorpay checkout
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Payment gateway loading... try again in a moment.");
      }

      const options: any = {
        key: RAZORPAY_KEY,
        name: "Content Engineer",
        description: `${plan.label} — ₹${plan.price}${plan.period}`,
        image: "/icon.png",
        prefill: {
          email: user.email,
          name: user.user_metadata?.full_name || "",
        },
        theme: { color: "#f59e0b" },
        handler: async (response: any) => {
          // 4. Verify payment on backend
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id || null,
                razorpay_subscription_id: response.razorpay_subscription_id || null,
                razorpay_signature: response.razorpay_signature,
                planType: plan.id === "pro_6month" ? "pro_6month" : plan.razorpayPlan,
                userId: user.id,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || verifyData.error) {
              setError(verifyData.error || "Verification failed");
            } else {
              setSuccess(true);
            }
          } catch (e: any) {
            setError(e.message || "Verification failed");
          }
        },
        modal: {
          ondismiss: () => {
            setLoadingPlan(null);
          },
        },
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
    } catch (err: any) {
      setError(err.message);
    }
    setLoadingPlan(null);
  };

  if (success) {
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
            Secure Razorpay checkout — UPI, cards, net banking, wallets supported.
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

              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                      plan.category === "pro" ? "text-violet-500" : "text-amber-500"
                    }`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                id={`pay-${plan.id}-btn`}
                onClick={() => handleBuy(plan)}
                disabled={loadingPlan !== null}
                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${plan.btnClass} disabled:opacity-60`}>
                {loadingPlan === plan.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" /> Pay ₹{plan.price}
                  </>
                )}
              </button>
              <p className="text-center text-[10px] text-muted-foreground mt-2">
                UPI · Cards · Net Banking · Wallets
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
