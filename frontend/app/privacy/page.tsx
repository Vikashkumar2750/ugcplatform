import type { Metadata } from "next";
import { PublicHeader, PublicFooter } from "@/components/public-layout";

export const metadata: Metadata = {
  title: "Privacy Policy — Content Engineer",
  description: "Content Engineer Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <PublicHeader />
      <div className="min-h-screen bg-background py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-heading text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm mb-10">Last updated: 27 May 2026</p>

          <div className="space-y-8 text-muted-foreground leading-relaxed text-sm">
            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">1. Information We Collect</h2>
              <p>When you use Content Engineer, we collect:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong className="text-foreground">Account Information:</strong> Name, email address, WhatsApp number provided during registration.</li>
                <li><strong className="text-foreground">Social Media Data:</strong> If you connect your social accounts via OAuth, we access your profile data, insights, and content as authorized by you.</li>
                <li><strong className="text-foreground">API Keys:</strong> Your Anthropic Claude and Apify API keys are stored encrypted in your browser's localStorage and are never transmitted to our servers.</li>
                <li><strong className="text-foreground">Payment Information:</strong> Payment is processed by Razorpay. We store only the payment reference ID — not your card or bank details.</li>
                <li><strong className="text-foreground">Usage Data:</strong> Analysis history, generated scripts, and automation rules you create.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">2. How We Use Your Data</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>To provide, maintain, and improve the Content Engineer service</li>
                <li>To analyze your social media profiles (with your explicit permission)</li>
                <li>To automate DMs and comments on your behalf (only when you create automation rules)</li>
                <li>To schedule and publish posts on your connected accounts</li>
                <li>To send you service-related communications via WhatsApp or email</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">3. Meta Platform Data</h2>
              <p>Content Engineer uses the Meta (Facebook/Instagram) Graph API and complies with <a href="https://developers.facebook.com/policy/" className="text-amber-600 dark:text-amber-400 hover:underline" target="_blank" rel="noopener">Meta&apos;s Platform Terms</a>.</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>We only request permissions you explicitly grant</li>
                <li>We do not sell or share your Meta data with third parties</li>
                <li>We do not use your data to train AI models</li>
                <li>Access tokens are stored encrypted and can be revoked at any time</li>
                <li>You can request complete data deletion at any time (see Section 7)</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">4. DM Automation Compliance</h2>
              <p>Our DM automation feature complies with Meta&apos;s messaging policies:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>All automated DMs include an opt-out option (&ldquo;Reply STOP to unsubscribe&rdquo;)</li>
                <li>We respect opt-out requests immediately and permanently</li>
                <li>We enforce Meta&apos;s 24-hour messaging window policy</li>
                <li>We do not send unsolicited promotional messages</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">5. Data Security</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>All data is stored in Supabase with Row Level Security (RLS) enabled</li>
                <li>OAuth tokens are encrypted at rest</li>
                <li>Your AI API keys (Anthropic, Apify) are stored only in your browser — never on our servers</li>
                <li>All API communications use HTTPS/TLS</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">6. Data Sharing</h2>
              <p>We do not sell your personal data. We share data only with:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong className="text-foreground">Supabase</strong> — database hosting</li>
                <li><strong className="text-foreground">Razorpay</strong> — payment processing</li>
                <li><strong className="text-foreground">Meta</strong> — required for social media integration (data sent to Meta APIs per your instructions)</li>
                <li><strong className="text-foreground">Vercel</strong> — hosting provider</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">7. Your Rights &amp; Data Deletion</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Access all data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request complete deletion of your account and data</li>
                <li>Disconnect any social account at any time</li>
                <li>Export your generated scripts and analysis results</li>
              </ul>
              <p className="mt-3">
                To delete your data, contact us at{" "}
                <a href="mailto:contact@techaasvik.com" className="text-amber-600 dark:text-amber-400 hover:underline">contact@techaasvik.com</a>{" "}
                or use the account deletion option in Settings. Facebook users can also request data deletion directly through{" "}
                <a href="https://www.facebook.com/settings?tab=applications" className="text-amber-600 dark:text-amber-400 hover:underline" target="_blank" rel="noopener">Facebook App Settings</a>.
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">8. Contact</h2>
              <p>
                For privacy-related questions or requests, contact us at:{" "}
                <a href="mailto:contact@techaasvik.com" className="text-amber-600 dark:text-amber-400 hover:underline">contact@techaasvik.com</a>
              </p>
              <p className="mt-2">
                <strong className="text-foreground">TechAasvik</strong><br />
                Website: <a href="https://contentengineer.techaasvik.in" className="text-amber-600 dark:text-amber-400 hover:underline">contentengineer.techaasvik.in</a>
              </p>
            </section>
          </div>
        </div>
      </div>
      <PublicFooter />
    </>
  );
}
