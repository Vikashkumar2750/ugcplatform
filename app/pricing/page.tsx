"use client";

import { useState } from "react";
import { CheckCircle2, Zap, Star, Shield, Clock, ArrowRight, IndianRupee } from "lucide-react";

declare global { interface Window { Razorpay: any; } }

const PLANS = [
  {
    id: "monthly",
    label: "Monthly",
    price: 49,
    period: "/month",
    desc: "Auto-renews every month. Cancel anytime.",
    badge: null,
    color: "border-zinc-200 dark:border-zinc-700",
    btnClass: "btn-amber",
    features: [
      "Unlimited AI analyses",
      "7-day script generation",
      "Competitor research",
      "Trend tracking",
      "Hook library",
      "Instagram + Facebook + YouTube",
      "Cancel anytime",
    ],
  },
  {
    id: "yearly",
    label: "Yearly",
    price: 399,
    period: "/year",
    desc: "Best value — save ₹189 vs monthly.",
    badge: "Best Value 🔥",
    color: "border-amber-400 ring-2 ring-amber-400/20",
    btnClass: "btn-amber",
    features: [
      "Everything in Monthly",
      "Save ₹189 per year",
      "Priority support",
      "Early access to new features",
      "Unlimited API usage",
      "Advanced insights",
    ],
  },
  {
    id: "lifetime",
    label: "Lifetime",
    price: 9,
    period: " one-time",
    desc: "Pay once, use forever. Limited offer.",
    badge: "Limited ⚡",
    color: "border-zinc-200 dark:border-zinc-700",
    btnClass: "bg-zinc-900 text-white hover:bg-zinc-800",
    features: [
      "Everything in Yearly",
      "Lifetime access",
      "All future features included",
      "No recurring charges",
    ],
  },
];

const RAZORPAY_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    setLoading(planId);
    try {
      // Load Razorpay script
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      const res = await fetch("/api/payments/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: planId, userEmail: "user@example.com", userName: "User" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const plan = PLANS.find(p => p.id === planId)!;
      const opts: any = {
        key: RAZORPAY_KEY,
        name: "ContentIQ",
        description: `ContentIQ ${plan.label} Plan`,
        image: "/favicon.ico",
        prefill: { name: "", email: "", contact: "" },
        theme: { color: "#F59E0B" },
        handler: async (response: any) => {
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, planType: planId }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            window.location.href = "/dashboard?payment=success&plan=" + planId;
          }
        },
      };

      if (data.type === "order") {
        opts.amount = data.amount;
        opts.currency = data.currency;
        opts.order_id = data.orderId;
      } else {
        opts.subscription_id = data.subscriptionId;
        opts.recurring = 1;
      }

      const rz = new window.Razorpay(opts);
      rz.on("payment.failed", (err: any) => console.error("Payment failed:", err));
      rz.open();
    } catch (err: any) {
      alert("Payment error: " + err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Zap className="w-3 h-3" /> Transparent Pricing
          </div>
          <h1 className="font-heading text-4xl font-black mb-3">
            Ek plan chuno, <span className="text-gradient">grow karo</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Har plan mein unlimited AI analyses, competitor research, aur script generation included hai.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {PLANS.map(plan => (
            <div key={plan.id} className={`relative rounded-2xl border ${plan.color} bg-card p-6 flex flex-col`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-400 text-black text-xs font-bold whitespace-nowrap">
                  {plan.badge}
                </div>
              )}
              <div className="mb-4">
                <h2 className="font-heading font-bold text-lg">{plan.label}</h2>
                <div className="flex items-end gap-1 mt-2">
                  <span className="font-heading text-4xl font-black">₹{plan.price}</span>
                  <span className="text-muted-foreground text-sm mb-1">{plan.period}</span>
                </div>
                <p className="text-muted-foreground text-xs mt-1">{plan.desc}</p>
              </div>

              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                id={`subscribe-${plan.id}-btn`}
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading === plan.id}
                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${plan.btnClass} disabled:opacity-60`}
              >
                {loading === plan.id ? (
                  "Opening payment..."
                ) : (
                  <>Get {plan.label} <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          {[
            { icon: Shield, label: "Secure payment via Razorpay" },
            { icon: Clock, label: "Cancel anytime (Monthly/Yearly)" },
            { icon: Star, label: "Used by 247+ creators" },
            { icon: IndianRupee, label: "INR pricing, no hidden charges" },
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
