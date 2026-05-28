import type { Metadata } from "next";
import { PublicHeader, PublicFooter } from "@/components/public-layout";
import { Zap, Target, Users, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us — ContentIQ by TechAasvik",
  description: "Learn about ContentIQ — the AI-powered social media automation and analytics platform built by TechAasvik for Indian content creators.",
};

export default function AboutPage() {
  return (
    <>
      <PublicHeader />
      <div className="min-h-screen bg-background">

        {/* Hero */}
        <section className="py-20 px-4 text-center border-b border-border">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-400/30 bg-amber-400/8 text-amber-600 dark:text-amber-400 text-xs font-medium mb-6">
              <Zap className="w-3 h-3" /> Built for Indian Creators
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-4">
              About <span className="text-gradient">ContentIQ</span>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
              ContentIQ is an AI-powered social media analytics and automation platform built by <strong className="text-foreground">TechAasvik</strong> — helping Indian content creators and businesses grow smarter on Instagram, Facebook, and YouTube.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid sm:grid-cols-2 gap-8">
              {[
                {
                  icon: Target,
                  title: "Our Mission",
                  desc: "To democratize social media growth for every Indian creator and small business — giving them enterprise-grade automation tools at an accessible price."
                },
                {
                  icon: Users,
                  title: "Who We Serve",
                  desc: "Content creators, UGC creators, digital marketers, and small business owners who want to save time on DMs, grow their audience, and understand their analytics."
                },
                {
                  icon: Zap,
                  title: "What We Build",
                  desc: "Smart automation for Instagram DMs and comments, AI-powered content analysis, competitor insights, and post scheduling — all in one place."
                },
                {
                  icon: Shield,
                  title: "Our Commitment",
                  desc: "We follow Meta's Platform Policies strictly. All automation is opt-in, user-controlled, and compliant. Your data is never sold or used for advertising."
                },
              ].map(item => (
                <div key={item.title} className="p-6 rounded-2xl border border-border bg-card hover:border-amber-400/30 transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center mb-4 group-hover:bg-amber-400/20 transition">
                    <item.icon className="w-5 h-5 text-amber-500" />
                  </div>
                  <h2 className="font-heading font-bold text-base mb-2">{item.title}</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About TechAasvik */}
        <section className="py-16 px-4 border-t border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-heading text-2xl font-bold mb-4">About TechAasvik</h2>
            <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
              <p>
                <strong className="text-foreground">TechAasvik</strong> is an India-based technology company focused on building practical SaaS tools for content creators and digital businesses. We believe in building tools that actually solve problems — not just add complexity.
              </p>
              <p>
                ContentIQ was born from a simple observation: Indian creators spend hours manually responding to DMs, checking analytics, and planning content — time that could be spent creating. We built ContentIQ to automate the repetitive so you can focus on the creative.
              </p>
              <p>
                All our products are built with a mobile-first, India-first mindset — optimized for the way Indian creators and businesses actually use the internet.
              </p>
            </div>

            <div className="mt-8 p-6 rounded-2xl border border-amber-400/20 bg-amber-400/5">
              <p className="font-semibold text-sm mb-1">Get in Touch</p>
              <p className="text-muted-foreground text-sm">
                Have questions about ContentIQ or want to partner with us?{" "}
                <a href="mailto:contact@techaasvik.com" className="text-amber-600 dark:text-amber-400 hover:underline">contact@techaasvik.com</a>
              </p>
            </div>
          </div>
        </section>

      </div>
      <PublicFooter />
    </>
  );
}
