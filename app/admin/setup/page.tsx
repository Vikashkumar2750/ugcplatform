import { BookOpen, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function AdminSetupPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-amber-400" /> Platform Setup Guide
        </h1>
        <p className="text-zinc-500 text-sm mt-1">One-time configuration checklist for ContentIQ administrators</p>
      </div>

      {[
        {
          step: 1, title: "Supabase Database Setup", color: "border-blue-500/30",
          items: [
            "Create a new project at supabase.com",
            "Copy SUPABASE_URL and SUPABASE_ANON_KEY to .env",
            "Copy SUPABASE_SERVICE_ROLE_KEY to .env (server-side only)",
            "Go to SQL Editor → run supabase/schema.sql",
            "Then run supabase/schema-v2.sql",
            "Enable Row Level Security on all tables",
          ],
        },
        {
          step: 2, title: "Meta Developer App (Instagram + Facebook)", color: "border-pink-500/30",
          items: [
            "Go to developers.facebook.com → Create App → Business",
            "Add product: 'Instagram Graph API'",
            "Add product: 'Messenger'",
            "Set Valid OAuth Redirect URIs: https://yourdomain.com/api/auth/instagram/callback",
            "Set Valid OAuth Redirect URIs: https://yourdomain.com/api/auth/facebook/callback",
            "Copy App ID → META_APP_ID in .env",
            "Copy App Secret → META_APP_SECRET in .env",
            "Set Privacy Policy URL: https://yourdomain.com/privacy",
            "Set Data Deletion URL: https://yourdomain.com/api/webhooks/data-deletion",
            "Set Deauthorize Callback: https://yourdomain.com/api/webhooks/deauthorize",
            "Submit for App Review for: pages_messaging, instagram_manage_messages, instagram_manage_comments",
          ],
        },
        {
          step: 3, title: "Google / YouTube API", color: "border-red-500/30",
          items: [
            "Go to console.cloud.google.com → Create Project",
            "Enable: YouTube Data API v3",
            "Create OAuth 2.0 credentials",
            "Add redirect URI: https://yourdomain.com/api/auth/youtube/callback",
            "Copy Client ID → GOOGLE_CLIENT_ID in .env",
            "Copy Client Secret → GOOGLE_CLIENT_SECRET in .env",
          ],
        },
        {
          step: 4, title: "Razorpay Payment Gateway", color: "border-amber-500/30",
          items: [
            "Create account at razorpay.com",
            "Go to Settings → API Keys → Generate",
            "Copy Key ID → NEXT_PUBLIC_RAZORPAY_KEY_ID in .env",
            "Copy Key Secret → RAZORPAY_KEY_SECRET in .env",
            "Set webhook URL: https://yourdomain.com/api/webhooks/razorpay",
            "Enable webhook events: payment.captured, payment.failed",
          ],
        },
        {
          step: 5, title: "Deployment", color: "border-green-500/30",
          items: [
            "Next.js app → Deploy to Vercel (connect GitHub repo)",
            "Add all .env variables to Vercel Environment Variables",
            "Background worker (render-worker/) → Deploy to Render.com",
            "Set WORKER_URL in .env to your Render service URL",
            "Set NEXT_PUBLIC_APP_URL to your Vercel domain",
          ],
        },
        {
          step: 6, title: "Admin Account", color: "border-red-500/30",
          items: [
            "Set ADMIN_EMAIL=admin@techaasvik.in in .env",
            "Set ADMIN_PASSWORD=asmin@123 in .env (change in production!)",
            "Set SESSION_SECRET to a long random string in .env",
            "Test login at /login with admin credentials",
          ],
        },
      ].map(section => (
        <div key={section.step} className={`rounded-xl border ${section.color} bg-zinc-950 overflow-hidden`}>
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 text-xs font-bold flex items-center justify-center">
              {section.step}
            </div>
            <h2 className="font-semibold text-zinc-100">{section.title}</h2>
          </div>
          <ul className="px-5 py-4 space-y-2">
            {section.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-400">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="flex gap-3">
        <Link href="/docs/meta-setup" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition">
          <ExternalLink className="w-4 h-4" /> Full Meta Guide
        </Link>
      </div>
    </div>
  );
}
