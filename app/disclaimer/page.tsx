import type { Metadata } from "next";
import { PublicHeader, PublicFooter } from "@/components/public-layout";

export const metadata: Metadata = {
  title: "Disclaimer — Content Engineer",
  description: "Content Engineer Disclaimer — important notices about AI-generated content, social media automation, and platform limitations.",
};

export default function DisclaimerPage() {
  return (
    <>
      <PublicHeader />
      <div className="min-h-screen bg-background py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-heading text-3xl font-bold mb-2">Disclaimer</h1>
          <p className="text-muted-foreground text-sm mb-10">Last updated: 27 May 2026</p>

          <div className="space-y-8 text-muted-foreground leading-relaxed text-sm">

            <div className="p-4 rounded-xl border border-amber-400/30 bg-amber-400/5 text-amber-700 dark:text-amber-300 text-sm">
              Please read this disclaimer carefully before using Content Engineer. By using our platform, you acknowledge and agree to the terms below.
            </div>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">1. AI-Generated Content</h2>
              <p>Content Engineer uses artificial intelligence (including large language models) to generate content ideas, scripts, captions, and suggestions. Please note:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>AI-generated content may be inaccurate, incomplete, or contextually inappropriate</li>
                <li>Always review AI-generated content before publishing it publicly</li>
                <li>Content Engineer is not responsible for any consequences arising from publishing unreviewed AI content</li>
                <li>AI suggestions should be treated as a starting point, not a final product</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">2. Social Media Automation</h2>
              <p>Our automation tools are designed to comply with platform policies. However:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Social media platforms (Meta, Google, etc.) may change their terms and policies at any time</li>
                <li>Users are solely responsible for ensuring their use of automation complies with the respective platform&apos;s current terms</li>
                <li>Content Engineer is not liable for account restrictions, suspensions, or bans resulting from your use of automation</li>
                <li>Automation features must be used only for accounts you own or have explicit permission to manage</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">3. Analytics &amp; Insights</h2>
              <p>Analytics data displayed on Content Engineer is sourced from official platform APIs. However:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Data accuracy depends on what the respective platform APIs return</li>
                <li>Historical data may be limited by API restrictions</li>
                <li>Content Engineer does not guarantee the accuracy or completeness of analytics data</li>
                <li>Business decisions should not be made solely based on Content Engineer analytics</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">4. Results Disclaimer</h2>
              <p>Content Engineer does not guarantee any specific results including:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Growth in followers, likes, comments, or engagement</li>
                <li>Increase in sales, leads, or revenue</li>
                <li>Improvement in social media reach or impressions</li>
                <li>Success of AI-generated content or automation campaigns</li>
              </ul>
              <p className="mt-2">Results vary based on account niche, content quality, audience, and many factors outside our control.</p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">5. Third-Party Services</h2>
              <p>Content Engineer integrates with third-party services including Meta, Google, Razorpay, Supabase, Anthropic, and Apify. We are not affiliated with or endorsed by these companies. Their respective terms and policies govern your use of those services.</p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">6. Limitation of Liability</h2>
              <p>To the maximum extent permitted by law, TechAasvik and Content Engineer shall not be liable for any direct, indirect, incidental, consequential, or special damages arising from:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Use or inability to use the platform</li>
                <li>Any content generated by AI tools</li>
                <li>Loss of data or business opportunities</li>
                <li>Platform policy changes by third parties</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">7. Contact</h2>
              <p>
                For questions about this Disclaimer, contact us at{" "}
                <a href="mailto:contact@techaasvik.com" className="text-amber-600 dark:text-amber-400 hover:underline">contact@techaasvik.com</a>
              </p>
            </section>

          </div>
        </div>
      </div>
      <PublicFooter />
    </>
  );
}
