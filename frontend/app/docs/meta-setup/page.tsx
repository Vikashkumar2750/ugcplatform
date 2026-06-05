"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, Copy, AlertCircle, ChevronDown, ChevronUp, Shield, Zap } from "lucide-react";

const PERMISSIONS_TABLE = [
  { permission: "instagram_basic", feature: "OAuth Login + Profile Info", reviewNeeded: false, businessVerif: false },
  { permission: "instagram_manage_insights", feature: "Full Analytics (reach, impressions, demographics)", reviewNeeded: true, businessVerif: false },
  { permission: "instagram_content_publish", feature: "Post Scheduling", reviewNeeded: true, businessVerif: false },
  { permission: "instagram_manage_messages", feature: "DM Automation", reviewNeeded: true, businessVerif: true },
  { permission: "instagram_manage_comments", feature: "Comment Automation", reviewNeeded: true, businessVerif: true },
  { permission: "pages_show_list", feature: "List Facebook Pages", reviewNeeded: false, businessVerif: false },
  { permission: "pages_read_engagement", feature: "Facebook Page Analytics", reviewNeeded: true, businessVerif: false },
  { permission: "pages_manage_posts", feature: "Facebook Post Scheduling", reviewNeeded: true, businessVerif: false },
  { permission: "pages_messaging", feature: "Facebook Messenger Automation", reviewNeeded: true, businessVerif: true },
  { permission: "pages_manage_engagement", feature: "Facebook Comment Automation", reviewNeeded: true, businessVerif: true },
  { permission: "youtube.readonly", feature: "YouTube Analytics", reviewNeeded: false, businessVerif: false },
  { permission: "youtube.upload", feature: "YouTube Video Scheduling", reviewNeeded: true, businessVerif: false },
];

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div id={id} className="rounded-2xl border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/20 transition">
        <h2 className="font-heading font-bold text-base">{title}</h2>
        {open ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>
      {open && <div className="px-6 pb-6 space-y-4">{children}</div>}
    </div>
  );
}

function Step({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full btn-amber flex items-center justify-center text-sm font-bold text-black flex-shrink-0 mt-0.5">{num}</div>
      <div className="flex-1">
        <p className="font-semibold text-sm mb-1">{title}</p>
        <div className="text-sm text-muted-foreground space-y-1">{children}</div>
      </div>
    </div>
  );
}

function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative bg-muted rounded-xl px-4 py-3 font-mono text-sm group">
      <code className="text-foreground">{text}</code>
      <button
        onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-foreground"
      >
        {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

const TOC = [
  { id: "meta-app", label: "1. Create Meta App" },
  { id: "use-cases", label: "2. Add Use Cases" },
  { id: "permissions", label: "3. Permissions Table" },
  { id: "webhooks", label: "4. Webhook Setup" },
  { id: "compliance", label: "5. Compliance Checklist" },
  { id: "app-review", label: "6. App Review" },
  { id: "google", label: "7. YouTube / Google" },
  { id: "env", label: "8. Environment Variables" },
];

export default function MetaSetupDocsPage() {
  return (
    <div className="flex gap-8 max-w-6xl mx-auto p-6">
      {/* Table of contents */}
      <aside className="w-48 flex-shrink-0 hidden lg:block">
        <div className="sticky top-6">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">On this page</p>
          <nav className="space-y-1">
            {TOC.map(item => (
              <a key={item.id} href={`#${item.id}`}
                className="block text-sm text-muted-foreground hover:text-foreground py-1 transition">
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 space-y-5 min-w-0">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-600 dark:text-amber-400 text-xs font-bold mb-3">
            <Zap className="w-3.5 h-3.5" /> Developer Setup Guide
          </div>
          <h1 className="font-heading text-2xl font-bold">Meta App Setup Guide</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Complete step-by-step guide to create your Meta Developer App, configure permissions, and set up webhooks for Content Engineer.
          </p>
        </div>

        {/* Step 1: Create Meta App */}
        <Section title="1. Create Your Meta Developer App" id="meta-app">
          <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5 text-sm">
            <p className="font-medium text-amber-600 dark:text-amber-400">Before you start:</p>
            <p className="text-muted-foreground mt-1">You need a Facebook account with a verified Business Manager or a Facebook Page with admin access.</p>
          </div>
          <div className="space-y-5">
            <Step num={1} title="Go to Meta Developer Console">
              <p>Visit <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener" className="text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1">developers.facebook.com/apps <ExternalLink className="w-3 h-3" /></a></p>
              <p>Click <strong className="text-foreground">"Create App"</strong> → Select <strong className="text-foreground">"Business"</strong> as app type</p>
            </Step>
            <Step num={2} title="Fill in App Details">
              <p><strong className="text-foreground">App Name:</strong> Content Engineer (or your branded name)</p>
              <p><strong className="text-foreground">App Contact Email:</strong> Your business email</p>
              <p><strong className="text-foreground">Business Account:</strong> Link your Facebook Business Manager</p>
            </Step>
            <Step num={3} title="Get Your App Credentials">
              <p>Go to <strong className="text-foreground">App Settings → Basic</strong></p>
              <p>Copy your <strong className="text-foreground">App ID</strong> and <strong className="text-foreground">App Secret</strong> and add to your <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.env.local</code>:</p>
              <CodeBlock text="META_APP_ID=your_app_id_here" />
              <CodeBlock text="META_APP_SECRET=your_app_secret_here" />
            </Step>
            <Step num={4} title="Add Privacy Policy and Terms URLs">
              <p>In <strong className="text-foreground">App Settings → Basic</strong>, add these required URLs:</p>
              <CodeBlock text="Privacy Policy URL: https://your-domain.com/privacy" />
              <CodeBlock text="Terms of Service URL: https://your-domain.com/terms" />
              <p className="text-amber-600 dark:text-amber-400 font-medium">⚠️ Without these URLs, your app cannot go live.</p>
            </Step>
          </div>
        </Section>

        {/* Step 2: Add Use Cases */}
        <Section title="2. Add Use Cases to Your App" id="use-cases">
          <p className="text-sm text-muted-foreground">In your Meta app dashboard, click <strong className="text-foreground">"Add Use Case"</strong> and add ALL of these:</p>
          <div className="space-y-2">
            {[
              { name: "Authenticate and request data from Instagram", icon: "📸", required: true },
              { name: "Manage messaging & content on Instagram", icon: "💬", required: true },
              { name: "Manage everything on your Page", icon: "📄", required: true },
              { name: "Engage with customers on Messenger", icon: "📨", required: true },
              { name: "Access the Instagram Graph API", icon: "📊", required: true },
            ].map(uc => (
              <div key={uc.name} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                <span className="text-lg">{uc.icon}</span>
                <span className="text-sm font-medium flex-1">{uc.name}</span>
                {uc.required && <span className="text-xs text-green-600 dark:text-green-400 font-medium">Required</span>}
              </div>
            ))}
          </div>
          <div className="p-4 rounded-xl border border-blue-400/20 bg-blue-400/5 text-sm">
            <p className="font-medium text-blue-600 dark:text-blue-400">💡 Note about your screenshot:</p>
            <p className="text-muted-foreground mt-1">
              You already have "Engage with customers on Messenger", "Manage messaging & content on Instagram", and "Manage everything on your Page" checked — that's correct! Also add "Authenticate and request data from Instagram".
            </p>
          </div>
        </Section>

        {/* Step 3: Permissions */}
        <Section title="3. Permissions Reference Table" id="permissions">
          <p className="text-sm text-muted-foreground">Each permission needs to be added in your app's use case configuration. Some require App Review.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Permission</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Enables</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">App Review?</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Business Verification?</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS_TABLE.map((row, i) => (
                  <tr key={row.permission} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-muted/10" : ""}`}>
                    <td className="py-2 px-3 font-mono text-xs">{row.permission}</td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">{row.feature}</td>
                    <td className="py-2 px-3">
                      {row.reviewNeeded
                        ? <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Yes</span>
                        : <span className="text-xs text-green-600 dark:text-green-400">No</span>}
                    </td>
                    <td className="py-2 px-3">
                      {row.businessVerif
                        ? <span className="text-xs text-red-500 font-medium">Required</span>
                        : <span className="text-xs text-muted-foreground">No</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Step 4: Webhooks */}
        <Section title="4. Webhook Configuration" id="webhooks">
          <div className="space-y-5">
            <Step num={1} title="Go to App Dashboard → Webhooks">
              <p>In your Meta app, go to <strong className="text-foreground">Products → Webhooks</strong></p>
              <p>Click <strong className="text-foreground">"Subscribe to this object"</strong> for both <strong className="text-foreground">Instagram</strong> and <strong className="text-foreground">Page</strong></p>
            </Step>
            <Step num={2} title="Set Callback URL and Verify Token">
              <p><strong className="text-foreground">Callback URL:</strong></p>
              <CodeBlock text="https://your-domain.com/api/webhooks/meta" />
              <p><strong className="text-foreground">Verify Token:</strong> (create a random string)</p>
              <CodeBlock text="META_WEBHOOK_VERIFY_TOKEN=your-random-verify-token" />
              <p>Add this to your <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.env.local</code> as shown above.</p>
            </Step>
            <Step num={3} title="Subscribe to Required Fields">
              <p>For <strong className="text-foreground">Instagram</strong>, subscribe to:</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {["messages", "comments", "mentions", "story_insights"].map(f => (
                  <code key={f} className="text-xs bg-muted px-2 py-0.5 rounded">{f}</code>
                ))}
              </div>
              <p className="mt-2">For <strong className="text-foreground">Page</strong>, subscribe to:</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {["messages", "comments", "feed", "mention"].map(f => (
                  <code key={f} className="text-xs bg-muted px-2 py-0.5 rounded">{f}</code>
                ))}
              </div>
            </Step>
          </div>
        </Section>

        {/* Step 5: Compliance */}
        <Section title="5. Meta Compliance Checklist" id="compliance">
          <div className="p-4 rounded-xl border border-red-400/20 bg-red-400/5 text-sm">
            <p className="font-medium text-red-500 mb-1">⚠️ Required by Meta — your app will be rejected without these</p>
          </div>
          <div className="space-y-3">
            {[
              { label: "Privacy Policy URL", url: "/privacy", status: "done", note: "Add to Meta app settings" },
              { label: "Terms of Service URL", url: "/terms", status: "done", note: "Add to Meta app settings" },
              { label: "Data Deletion Callback URL", url: "/api/webhooks/data-deletion", status: "done", note: "REQUIRED — deletes user data on request" },
              { label: "Deauthorize Callback URL", url: "/api/webhooks/deauthorize", status: "todo", note: "Called when user disconnects app" },
              { label: "App Icon (1024×1024)", url: "", status: "todo", note: "Upload in Meta app dashboard" },
              { label: "Business Verification", url: "https://business.facebook.com/overview", status: "todo", note: "Required for messaging permissions" },
              { label: "Opt-out mechanism in all DMs", url: "", status: "done", note: "Already built into DM automation (Reply STOP)" },
              { label: "24-hour messaging window respected", url: "", status: "done", note: "Enforced in automation webhook handler" },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
                {item.status === "done"
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.note}</p>
                  {item.url && item.url.startsWith("/") && (
                    <code className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 block">
                      {`https://your-domain.com${item.url}`}
                    </code>
                  )}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${item.status === "done" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                  {item.status === "done" ? "Built ✓" : "Action needed"}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Step 6: App Review */}
        <Section title="6. Submitting for App Review" id="app-review">
          <div className="space-y-5">
            <Step num={1} title="Switch App to Live Mode first">
              <p>Toggle your app from <strong className="text-foreground">Development → Live</strong> mode before submitting.</p>
              <p>In dev mode, only 5 test users can use the app.</p>
            </Step>
            <Step num={2} title="Prepare screen recordings">
              <p>Meta requires a <strong className="text-foreground">screen recording</strong> for each advanced permission showing:</p>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>How the user grants the permission</li>
                <li>How your app uses the data</li>
                <li>That you're not scraping or storing data beyond what's needed</li>
              </ul>
            </Step>
            <Step num={3} title="Submit each permission separately">
              <p>In your app dashboard, go to <strong className="text-foreground">App Review → Permissions and Features</strong></p>
              <p>Request each permission one by one with justification and recording.</p>
            </Step>
            <Step num={4} title="Timeline">
              <p>Basic permissions: <strong className="text-foreground">1–3 business days</strong></p>
              <p>Messaging permissions: <strong className="text-foreground">5–10 business days</strong> + Business Verification</p>
            </Step>
          </div>
        </Section>

        {/* Step 7: Google / YouTube */}
        <Section title="7. Google Cloud / YouTube API Setup" id="google">
          <div className="space-y-5">
            <Step num={1} title="Create Google Cloud Project">
              <p>Visit <a href="https://console.cloud.google.com" target="_blank" rel="noopener" className="text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1">console.cloud.google.com <ExternalLink className="w-3 h-3" /></a></p>
              <p>Create a new project → Name it "Content Engineer"</p>
            </Step>
            <Step num={2} title="Enable Required APIs">
              <p>Go to <strong className="text-foreground">APIs & Services → Library</strong> and enable:</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {["YouTube Data API v3", "YouTube Analytics API"].map(api => (
                  <code key={api} className="text-xs bg-muted px-2 py-0.5 rounded">{api}</code>
                ))}
              </div>
            </Step>
            <Step num={3} title="Create OAuth 2.0 Credentials">
              <p>Go to <strong className="text-foreground">APIs & Services → Credentials → Create Credentials → OAuth Client ID</strong></p>
              <p><strong className="text-foreground">Application type:</strong> Web application</p>
              <p><strong className="text-foreground">Authorized redirect URIs:</strong></p>
              <CodeBlock text="https://your-domain.com/api/auth/youtube/callback" />
              <p>Copy Client ID and Client Secret to .env.local</p>
            </Step>
          </div>
        </Section>

        {/* Step 8: Environment Variables */}
        <Section title="8. Complete .env.local Reference" id="env">
          <p className="text-sm text-muted-foreground">All required environment variables for the platform:</p>
          <div className="bg-muted/50 rounded-xl p-4 font-mono text-xs space-y-1 leading-relaxed">
            {[
              "# Supabase",
              "NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co",
              "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...",
              "SUPABASE_SERVICE_ROLE_KEY=eyJ...",
              "",
              "# Razorpay",
              "NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx",
              "RAZORPAY_KEY_SECRET=xxx",
              "RAZORPAY_WEBHOOK_SECRET=xxx",
              "",
              "# Meta",
              "META_APP_ID=your_meta_app_id",
              "META_APP_SECRET=your_meta_app_secret",
              "META_WEBHOOK_VERIFY_TOKEN=random_string",
              "NEXT_PUBLIC_APP_URL=https://your-domain.com",
              "",
              "# Google / YouTube",
              "GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com",
              "GOOGLE_CLIENT_SECRET=GOCSPX-xxx",
              "",
              "# Render Worker",
              "RENDER_WORKER_URL=https://your-worker.onrender.com",
              "RENDER_WORKER_SECRET=random_secret",
            ].map((line, i) => (
              <p key={i} className={line.startsWith("#") ? "text-muted-foreground" : "text-foreground"}>{line || "\u00A0"}</p>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
