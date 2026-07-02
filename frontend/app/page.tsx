"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Zap, ArrowRight, Star, Shield, CheckCircle2, TrendingUp,
  BarChart3, FileText, Search, Camera, PlayCircle, Share2,
  Users, Sparkles, Target, BookOpen, Download, ChevronRight,
  Play, Award, Clock, Activity, Brain, Lightbulb
} from "lucide-react";
import { LeadFormModal } from "@/components/lead-form-modal";
import { FAQItem } from "@/components/faq-item";
import { Navbar } from "@/components/navbar";

// Sample report mock data for the modal
const SAMPLE_REPORT = {
  engagement: "2.8%",
  verdict: "Theek hai, but usse better kar sakte ho",
  strengths: ["Consistent posting schedule", "Good use of trending audio", "Relatable content style"],
  weaknesses: ["Hooks first 3 seconds mein weak hain", "No clear CTA in 70% posts", "Hashtag strategy broad hai"],
};

export default function LandingPage() {
  const t = useTranslations();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);

  // Redirect logged-in users to dashboard
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/dashboard");
    });
  }, [router]);

  const openModal = () => setModalOpen(true);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── HERO ─────────────────────────────────── */}
      <section className="relative pt-28 pb-20 px-4 overflow-hidden hero-gradient">
        {/* Background blobs */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-amber-400/5 blur-3xl pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-72 h-72 rounded-full bg-orange-400/5 blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-400/30 bg-amber-400/8 text-amber-600 dark:text-amber-400 text-sm font-medium mb-6 animate-float">
            <Users className="w-4 h-4" />
            {t("hero.badge")}
          </div>

          {/* Headline */}
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            <span className="text-gradient">90 seconds</span> mein jaano ki
            <br className="hidden sm:block" />
            tumhara content kyun nahi{" "}
            <span className="relative">
              grow
              <span className="absolute -bottom-1 left-0 right-0 h-1 rounded-full amber-gradient" />
            </span>{" "}
            kar raha
          </h1>

          {/* Sub */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            {t("hero.sub")}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <button
              id="hero-cta-primary"
              onClick={openModal}
              className="btn-amber px-8 py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 group"
            >
              <Zap className="w-5 h-5" />
              {t("hero.cta.primary")}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              id="hero-cta-sample"
              onClick={() => setSampleOpen(true)}
              className="px-8 py-4 rounded-xl text-base font-semibold border border-border hover:border-foreground/30 hover:bg-muted/50 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {t("hero.cta.secondary")}
            </button>
          </div>

          {/* Social proof strip */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {["RK", "PS", "AM", "NJ", "AK"].map((initials) => (
                  <div
                    key={initials}
                    className="w-7 h-7 rounded-full btn-amber flex items-center justify-center text-[10px] font-bold border-2 border-background"
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <span className="font-medium">2,400+ creators</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
              <span>4.9/5 rating</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <Camera className="w-4 h-4" />
              <PlayCircle className="w-4 h-4" />
              <Share2 className="w-4 h-4" />
              <span>All platforms</span>
            </div>
          </div>
        </div>

        {/* Mock Dashboard Preview */}
        <div className="max-w-5xl mx-auto mt-16 relative">
          <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
                <div className="w-3 h-3 rounded-full bg-green-400/70" />
              </div>
              <div className="flex-1 mx-4 h-6 rounded-md bg-muted text-xs text-muted-foreground flex items-center px-3">
                Content Engineer.app/results/your-analysis
              </div>
            </div>
            {/* Dashboard content mockup */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-background">
              <div className="sm:col-span-1 space-y-3">
                <div className="p-4 rounded-xl border border-border bg-card">
                  <p className="text-xs text-muted-foreground mb-1">Engagement Rate</p>
                  <p className="text-3xl font-heading font-bold text-gradient">2.8%</p>
                  <p className="text-xs text-muted-foreground mt-1">↑ Theek hai, but better kar sakte ho</p>
                </div>
                <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Top Issue Found
                  </p>
                  <p className="text-sm font-medium">Hooks first 3 seconds mein weak hain</p>
                  <p className="text-xs text-muted-foreground mt-1">70% posts mein clear CTA nahi</p>
                </div>
              </div>
              <div className="sm:col-span-2 space-y-3">
                <div className="p-4 rounded-xl border border-border bg-card">
                  <p className="text-xs font-medium text-muted-foreground mb-3">COMPETITOR COMPARISON</p>
                  <div className="space-y-2">
                    {[
                      { name: "Your Account", er: 2.8, color: "bg-muted", posts: 48 },
                      { name: "Competitor A", er: 6.2, color: "amber-gradient", posts: 89 },
                      { name: "Competitor B", er: 4.8, color: "bg-orange-400/50", posts: 71 },
                    ].map((row) => (
                      <div key={row.name} className="flex items-center gap-3 text-xs">
                        <span className="w-28 text-muted-foreground truncate">{row.name}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.name === "Your Account" ? "bg-muted-foreground/50" : row.name === "Competitor A" ? "amber-gradient" : "bg-orange-400/60"}`}
                            style={{ width: `${(row.er / 8) * 100}%` }}
                          />
                        </div>
                        <span className="font-bold w-10 text-right">{row.er}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card">
                  <p className="text-xs font-medium text-muted-foreground mb-3">HOOK EXAMPLE (Ready to use)</p>
                  <p className="text-sm italic text-foreground leading-relaxed">
                    "Yaar, main bhi exactly yahi sochta tha — jab tak maine yeh try nahi kiya... 👀"
                  </p>
                  <div className="mt-2 flex gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-600 dark:text-amber-400 text-xs">Curiosity</span>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-xs">#Fitness</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Glow effect under preview */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-12 blur-2xl amber-gradient opacity-20 rounded-full" />
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────── */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">{t("how.title")}</span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mt-2">
              Sirf 4 steps — <span className="text-gradient">90 seconds</span> mein sab kuch
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Camera, step: "01", title: t("how.step1.title"), desc: t("how.step1.desc") },
              { icon: Zap, step: "02", title: t("how.step2.title"), desc: t("how.step2.desc") },
              { icon: Activity, step: "03", title: t("how.step3.title"), desc: t("how.step3.desc") },
              { icon: CheckCircle2, step: "04", title: t("how.step4.title"), desc: t("how.step4.desc") },
            ].map((item, i) => (
              <div key={i} className="relative group">
                <div className="p-6 rounded-2xl bg-card border border-border card-hover text-center">
                  <div className="w-12 h-12 rounded-xl btn-amber mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <item.icon className="w-6 h-6 text-black" />
                  </div>
                  <div className="text-xs text-muted-foreground font-bold tracking-widest mb-2">STEP {item.step}</div>
                  <h3 className="font-heading font-semibold text-base mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
                {i < 3 && (
                  <ChevronRight className="hidden lg:block absolute top-1/2 -right-4 w-6 h-6 text-muted-foreground/40 -translate-y-1/2 z-10" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────── */}
      <section className="py-20 px-4" id="features">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Features</span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mt-2">{t("features.title")}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Activity,
                title: t("features.audit.title"),
                desc: t("features.audit.desc"),
                badge: "Phase 1",
                highlight: false,
              },
              {
                icon: Lightbulb,
                title: t("features.niche.title"),
                desc: t("features.niche.desc"),
                badge: "NEW",
                highlight: true,
              },
              {
                icon: BarChart3,
                title: t("features.competitor.title"),
                desc: t("features.competitor.desc"),
                badge: "Phase 2",
                highlight: false,
              },
              {
                icon: TrendingUp,
                title: t("features.trends.title"),
                desc: t("features.trends.desc"),
                badge: "Phase 3",
                highlight: false,
              },
              {
                icon: FileText,
                title: t("features.scripts.title"),
                desc: t("features.scripts.desc"),
                badge: "Phase 4",
                highlight: false,
              },
              {
                icon: BookOpen,
                title: t("features.hooks.title"),
                desc: t("features.hooks.desc"),
                badge: "Library",
                highlight: false,
              },
            ].map((f, i) => (
              <div
                key={i}
                className={`p-6 rounded-2xl border card-hover relative overflow-hidden group ${
                  f.highlight
                    ? "border-amber-400/40 bg-amber-400/5"
                    : "border-border bg-card"
                }`}
              >
                {f.highlight && (
                  <div className="absolute top-0 right-0 w-32 h-32 amber-gradient opacity-10 rounded-full -translate-y-8 translate-x-8" />
                )}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${f.highlight ? "btn-amber" : "bg-muted"} group-hover:scale-110 transition-transform`}>
                    <f.icon className={`w-5 h-5 ${f.highlight ? "text-black" : "text-foreground"}`} />
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${f.highlight ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}>
                    {f.badge}
                  </span>
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NICHE DISCOVERY SECTION ───────────────── */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-400/8 to-orange-400/5 p-8 sm:p-12 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 amber-gradient opacity-8 rounded-full translate-x-24 -translate-y-12 pointer-events-none" />
            <div className="relative z-10 flex flex-col lg:flex-row gap-10 items-center">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-600 dark:text-amber-400 text-xs font-bold mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  NEW FEATURE
                </div>
                <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-4">
                  Niche Discover Tool 🔍
                </h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  <strong className="text-foreground">Nahi pata tumhara niche kya hai?</strong> Koi baat nahi. Apna Instagram profile aur apna profession ya experience batao — baaki sab AI kar dega. Tumhara perfect niche, target audience, content types aur top competitors automatically mil jaayenge.
                </p>
                <div className="space-y-3">
                  {[
                    { icon: Target, text: "Suggested niche + target audience" },
                    { icon: Users, text: "Auto-discovered competitors (top 3)" },
                    { icon: TrendingUp, text: "Trending topics in your niche right now" },
                    { icon: Brain, text: "Content types you can realistically make" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-amber-400/15 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="text-sm font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Mock Niche Discovery card */}
              <div className="w-full lg:w-80 flex-shrink-0">
                <div className="bg-card rounded-2xl border border-border p-5 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <Lightbulb className="w-4 h-4" />
                    NICHE DISCOVERY REPORT
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Suggested Niche</p>
                      <p className="font-semibold">Personal Finance for Millennials 💰</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Target Audience</p>
                      <p className="font-medium">22–32 year olds, salaried professionals, first-time investors</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-2">Auto-Found Competitors</p>
                      <div className="flex flex-wrap gap-1.5">
                        {["@financewithrk", "@millennial_money", "@investsmart_in"].map((h) => (
                          <span key={h} className="px-2 py-0.5 rounded-full bg-background border border-border text-xs">{h}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button onClick={openModal} className="btn-amber w-full py-2.5 rounded-xl text-xs font-bold">
                    Try Niche Discovery →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPETITOR ANALYTICS SECTION ─────────── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Competitor Analytics</span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mt-2">
              Seedha batayenge — <span className="text-gradient">wo kyun grow kar rahe hain</span> aur tum kyun nahi
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Sirf comparison nahi, <strong>exact reasons</strong> milenge — kya galat hai tumhare account mein aur competitors kya sahi kar rahe hain.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* What you're doing wrong */}
            <div className="p-6 rounded-2xl border border-red-400/20 bg-red-500/5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-red-500">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                TUMHARA ACCOUNT — KYA GALAT HAI
              </div>
              <div className="space-y-2.5">
                {[
                  "Hook game weak — First 3 seconds bore karte hain",
                  "CTA sirf 30% posts mein hai — baaki mein ghayab",
                  "Hashtags too generic — niche audience nahi milti",
                  "Posting time wrong — Indian prime time miss ho raha hai",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <div className="w-5 h-5 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center text-xs font-bold mt-0.5 flex-shrink-0">✗</div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* What competitors do right */}
            <div className="p-6 rounded-2xl border border-green-400/20 bg-green-500/5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-green-600 dark:text-green-400">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                COMPETITORS — KYA SAHI KAR RAHE HAIN
              </div>
              <div className="space-y-2.5">
                {[
                  "Curiosity gap hook use karte hain — viewer ruk jaata hai",
                  "Har post mein comment CTA — 'Comment GROWTH for strategy'",
                  "Niche-specific hashtags — #FinanceIndia #IndianInvestor",
                  "Posting 7–9 PM IST consistently — jab India scroll karta hai",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <div className="w-5 h-5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 flex items-center justify-center text-xs font-bold mt-0.5 flex-shrink-0">✓</div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 p-6 rounded-2xl border border-border bg-card">
            <p className="text-xs font-bold text-muted-foreground mb-3 tracking-wider">GENERATED HOOK USING COMPETITOR INSIGHTS</p>
            <blockquote className="text-lg font-medium italic leading-relaxed border-l-4 border-amber-400 pl-4">
              "Yaar, main bhi exactly yahi sochta tha — jab tak maine yeh ek cheez try nahi ki. Ab mere account ka engagement 4x ho gaya hai. 👇"
            </blockquote>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-600 dark:text-amber-400 font-medium">Curiosity Gap</span>
              <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">Relatability Trigger</span>
              <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">Scroll-stopper</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── MULTI-ACCOUNT / PRICING ──────────────── */}
      <section className="py-20 px-4 bg-muted/30" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-500 dark:text-violet-400 text-xs font-bold uppercase tracking-wider mb-4">
              <Users className="w-3.5 h-3.5" /> Multi-Account
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mt-2">
              Manage <span className="bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">all your brands</span> from one dashboard
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Connect up to 5 Instagram, 5 Facebook, 5 YouTube, and 5 LinkedIn accounts. Publish and automate across all at once.
            </p>
          </div>

          {/* Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {/* Free Tier */}
            <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-lg">Free</h3>
                <span className="text-2xl font-black text-gradient">₹9</span>
              </div>
              <p className="text-sm text-muted-foreground">One-time payment, lifetime access</p>
              <div className="space-y-2.5">
                {[
                  { text: "1× Instagram account", active: true },
                  { text: "1× Facebook page", active: true },
                  { text: "1× YouTube channel", active: true },
                  { text: "1× LinkedIn profile", active: true },
                  { text: "AI content analysis", active: true },
                  { text: "DM & comment automation", active: true },
                  { text: "Multi-account publish", active: false },
                  { text: "Priority support", active: false },
                ].map((f, i) => (
                  <div key={i} className={`flex items-center gap-2 text-sm ${f.active ? "" : "text-muted-foreground line-through opacity-50"}`}>
                    <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${f.active ? "text-amber-500" : "text-muted-foreground/30"}`} />
                    {f.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Pro Tier */}
            <div className="p-6 rounded-2xl border-2 border-violet-500/40 bg-gradient-to-br from-violet-500/5 to-indigo-500/5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 rounded-full -translate-y-16 translate-x-16" />
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <h3 className="font-heading font-bold text-lg">Pro</h3>
                  <span className="text-xs text-violet-500 font-bold">Most Popular</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">₹59</span>
                  <span className="text-xs text-muted-foreground">/month</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground relative z-10">Or ₹299/6-months · ₹599/year</p>
              <div className="space-y-2.5 relative z-10">
                {[
                  "5× Instagram accounts",
                  "5× Facebook pages",
                  "5× YouTube channels",
                  "5× LinkedIn profiles",
                  "AI content analysis",
                  "DM & comment automation",
                  "Publish to all at once",
                  "Priority support",
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-violet-500" />
                    {f}
                  </div>
                ))}
              </div>
              <a href="/pricing" className="block w-full py-3 rounded-xl text-center font-bold text-sm bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 transition relative z-10">
                Upgrade to Pro →
              </a>
            </div>
          </div>

          {/* Platform icons strip */}
          <div className="flex items-center justify-center gap-8 opacity-60">
            {[
              { icon: Camera, label: "Instagram" },
              { icon: Share2, label: "Facebook" },
              { icon: PlayCircle, label: "YouTube" },
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <p.icon className="w-5 h-5" />
                <span>Up to 5</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold">{t("testimonials.title")}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                initials: "RK",
                name: "Rahul Kumar",
                niche: "Finance Creator",
                platform: "YouTube",
                quote: "Bhai, pehle main blind tha — kya post karna hai, kab karna hai, kuch nahi pata tha. Content Engineer ne seedha bataya ki mere competitors kya kar rahe hain. 3 weeks mein mera engagement 2x ho gaya.",
                followers: "48K",
              },
              {
                initials: "PS",
                name: "Priya Sharma",
                niche: "Fitness Creator",
                platform: "Instagram",
                quote: "Niche Discovery tool ne meri life badal di. Mujhe pata hi nahi tha ki main exactly kiske liye content bana raha hoon. Ab mera content itna targeted hai ki log DM karte hain khud.",
                followers: "23K",
              },
              {
                initials: "AM",
                name: "Aryan Mehta",
                niche: "Tech Reviewer",
                platform: "Instagram Reels",
                quote: "₹9 mein itna value? Mujhe trust nahi tha pehle. Lekin jab audit aaya, aur usne bataya ki meri 80% posts mein CTA nahi hai — tab aankhen khul gayi. Yeh tool must-have hai.",
                followers: "31K",
              },
            ].map((t, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border border-border card-hover space-y-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed italic">"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <div className="w-10 h-10 rounded-full btn-amber flex items-center justify-center text-sm font-bold text-black flex-shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.niche} · {t.platform} · {t.followers} followers</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────── */}
      <section className="py-20 px-4" id="pricing">
        <div className="max-w-md mx-auto text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-6">
            {t("pricing.badge")}
          </div>
          <div className="p-8 rounded-3xl border border-border bg-card shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 amber-gradient opacity-8 rounded-full translate-x-16 -translate-y-16 pointer-events-none" />
            <div className="relative z-10">
              <div className="text-6xl sm:text-7xl font-heading font-extrabold mb-1 text-gradient">
                {t("pricing.price")}
              </div>
              <p className="text-muted-foreground mb-8 text-sm">{t("pricing.sub")}</p>
              <div className="space-y-3 text-left mb-8">
                {[
                  t("pricing.feature1"),
                  t("pricing.feature2"),
                  t("pricing.feature3"),
                  t("pricing.feature4"),
                  t("pricing.feature5"),
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <button
                id="pricing-cta-btn"
                onClick={openModal}
                className="btn-amber w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                {t("pricing.cta")}
              </button>
              <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-green-500" />
                {t("pricing.trust")}
              </p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Instant access</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>No subscription</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Razorpay secure</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────── */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-heading text-3xl font-bold text-center mb-10">{t("faq.title")}</h2>
          <div className="space-y-3">
            {[
              { q: t("faq.q1"), a: t("faq.a1") },
              { q: t("faq.q2"), a: t("faq.a2") },
              { q: t("faq.q3"), a: t("faq.a3") },
              { q: t("faq.q4"), a: t("faq.a4") },
              { q: t("faq.q5"), a: t("faq.a5") },
              { q: t("faq.q6"), a: t("faq.a6") },
            ].map((item, i) => (
              <FAQItem key={i} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────── */}
      <footer className="border-t border-border bg-card py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg btn-amber flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-black" />
            </div>
            <div>
              <span className="font-heading font-bold">Content<span className="text-gradient">IQ</span></span>
              <p className="text-xs text-muted-foreground">{t("footer.tagline")}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="/privacy" className="hover:text-foreground transition-colors">{t("footer.privacy")}</a>
            <a href="/terms" className="hover:text-foreground transition-colors">{t("footer.terms")}</a>
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {t("footer.contact")}
            </a>
          </div>
        </div>
      </footer>

      {/* ── LEAD FORM MODAL ──────────────────────── */}
      <LeadFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

      {/* ── SAMPLE REPORT MODAL ──────────────────── */}
      {sampleOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSampleOpen(false)} />
          <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-bold">Sample Analysis Report</h2>
              <button onClick={() => setSampleOpen(false)} className="text-muted-foreground hover:text-foreground transition">
                ✕
              </button>
            </div>
            <div className="p-4 rounded-xl bg-amber-400/5 border border-amber-400/20">
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">PROFILE HEALTH</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-heading font-extrabold text-gradient">{SAMPLE_REPORT.engagement}</span>
                <span className="text-sm text-muted-foreground">Engagement Rate</span>
              </div>
              <p className="text-sm mt-1 text-muted-foreground">{SAMPLE_REPORT.verdict}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-green-600 mb-2">✓ STRENGTHS</p>
              {SAMPLE_REPORT.strengths.map((s, i) => <p key={i} className="text-sm text-muted-foreground py-1 border-b border-border last:border-0">• {s}</p>)}
            </div>
            <div>
              <p className="text-xs font-bold text-red-500 mb-2">✗ ISSUES FOUND</p>
              {SAMPLE_REPORT.weaknesses.map((w, i) => <p key={i} className="text-sm text-muted-foreground py-1 border-b border-border last:border-0">• {w}</p>)}
            </div>
            <div className="p-4 rounded-xl bg-muted/40 text-center">
              <p className="text-xs text-muted-foreground mb-3">Yeh sirf ek sample hai. Tumhara actual report aur bhi detailed hoga — competitors breakdown, 7 scripts, aur posting schedule ke saath.</p>
              <button onClick={() => { setSampleOpen(false); openModal(); }} className="btn-amber px-6 py-2.5 rounded-lg text-sm font-bold">
                Apna Report Banao →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
