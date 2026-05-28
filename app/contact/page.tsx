"use client";

import { useState } from "react";
import { PublicHeader, PublicFooter } from "@/components/public-layout";
import { Mail, MessageCircle, Clock, CheckCircle2, Loader2 } from "lucide-react";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    // Simulate form submission — replace with actual API call
    await new Promise(r => setTimeout(r, 1200));
    setStatus("success");
  };

  return (
    <>
      <PublicHeader />
      <div className="min-h-screen bg-background py-16 px-4">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-3">Contact Us</h1>
            <p className="text-muted-foreground text-base max-w-lg mx-auto">
              Have a question, feedback, or need support? We&apos;re here to help. Reach out and we&apos;ll get back to you within 24 hours.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">

            {/* Info Cards */}
            <div className="space-y-4">
              {[
                {
                  icon: Mail,
                  title: "Email Us",
                  desc: "For general queries, billing, and support",
                  value: "contact@techaasvik.com",
                  href: "mailto:contact@techaasvik.com",
                },
                {
                  icon: MessageCircle,
                  title: "WhatsApp Support",
                  desc: "Quick support for technical issues",
                  value: "+91 90539 07793",
                  href: "https://wa.me/919053907793",
                },
                {
                  icon: Clock,
                  title: "Response Time",
                  desc: "We typically respond within",
                  value: "24 business hours",
                  href: null,
                },
              ].map(item => (
                <div key={item.title} className="p-5 rounded-2xl border border-border bg-card">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center mb-3">
                    <item.icon className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="font-semibold text-sm mb-0.5">{item.title}</p>
                  <p className="text-xs text-muted-foreground mb-1.5">{item.desc}</p>
                  {item.href ? (
                    <a href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel="noopener"
                      className="text-sm text-amber-600 dark:text-amber-400 font-medium hover:underline">
                      {item.value}
                    </a>
                  ) : (
                    <p className="text-sm font-medium">{item.value}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Contact Form */}
            <div className="sm:col-span-2">
              {status === "success" ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-border bg-card gap-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-xl mb-2">Message Sent!</h2>
                    <p className="text-muted-foreground text-sm">Thanks for reaching out. We&apos;ll get back to you at <strong>{form.email}</strong> within 24 hours.</p>
                  </div>
                  <button onClick={() => { setForm({ name: "", email: "", subject: "", message: "" }); setStatus("idle"); }}
                    className="btn-amber px-6 py-2.5 rounded-xl text-sm font-bold">
                    Send Another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-6 rounded-2xl border border-border bg-card space-y-4">
                  <h2 className="font-heading font-bold text-lg mb-1">Send a Message</h2>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Your Name</label>
                      <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="Rahul Sharma"
                        className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Email Address</label>
                      <input required type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                        placeholder="you@example.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Subject</label>
                    <select value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} required
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/30">
                      <option value="">Select a topic</option>
                      <option value="billing">Billing / Refund</option>
                      <option value="technical">Technical Support</option>
                      <option value="feature">Feature Request</option>
                      <option value="partnership">Partnership / Collaboration</option>
                      <option value="meta">Meta App / Integration</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Message</label>
                    <textarea required value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                      rows={5} placeholder="Describe your question or issue in detail..."
                      className="w-full px-4 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/30 resize-none" />
                  </div>

                  <button type="submit" disabled={status === "loading"}
                    className="w-full py-3 btn-amber rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                    {status === "loading" ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : "Send Message"}
                  </button>

                  <p className="text-xs text-muted-foreground text-center">
                    Or email directly: <a href="mailto:contact@techaasvik.com" className="text-amber-500 hover:underline">contact@techaasvik.com</a>
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* FAQ note */}
          <div className="mt-12 p-6 rounded-2xl border border-border bg-muted/20 text-center">
            <p className="text-sm text-muted-foreground">
              Looking for quick answers? Visit our{" "}
              <a href="/support" className="text-amber-500 hover:underline font-medium">Support Center</a>
              {" "}or check our{" "}
              <a href="/docs/meta-setup" className="text-amber-500 hover:underline font-medium">Integration Docs</a>.
            </p>
          </div>

        </div>
      </div>
      <PublicFooter />
    </>
  );
}
