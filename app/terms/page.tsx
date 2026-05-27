import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — ContentIQ",
  description: "ContentIQ Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-heading text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground text-sm mb-10">Last updated: 27 May 2026</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed text-sm">
          <section>
            <h2 className="font-heading text-lg font-bold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using ContentIQ ("the Service"), you agree to these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-foreground mb-3">2. Service Description</h2>
            <p>ContentIQ is a social media analytics and automation platform that:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Analyzes social media profiles using official platform APIs and your own API keys</li>
              <li>Generates content scripts and hooks using AI (using your own Anthropic API key)</li>
              <li>Automates DMs and comments on connected social accounts at your direction</li>
              <li>Schedules and publishes social media posts on your behalf</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-foreground mb-3">3. Payment Terms</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>ContentIQ requires a one-time fee of ₹9 (nine Indian Rupees) for lifetime access</li>
              <li>All payments are processed by Razorpay and are non-refundable</li>
              <li>The ₹9 fee does not include API usage costs (Anthropic, Apify) which are charged directly by those providers</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-foreground mb-3">4. Permitted Use</h2>
            <p>You may use ContentIQ only for:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Managing your own social media accounts</li>
              <li>Analyzing social media profiles for legitimate competitive research</li>
              <li>Automating communications with users who have initiated contact with you</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-foreground mb-3">5. Prohibited Use</h2>
            <p>You may NOT use ContentIQ to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Send spam, unsolicited messages, or misleading content</li>
              <li>Violate Meta's, Google's, or any platform's Terms of Service</li>
              <li>Automate actions on accounts you do not own</li>
              <li>Scrape data beyond what official APIs provide</li>
              <li>Harass, deceive, or harm other users</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-foreground mb-3">6. Platform API Compliance</h2>
            <p>
              ContentIQ integrates with Meta (Instagram/Facebook) and Google (YouTube) APIs. You are responsible for
              ensuring your use of ContentIQ complies with the respective platform's terms:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><a href="https://developers.facebook.com/policy/" className="text-amber-600 dark:text-amber-400 hover:underline" target="_blank" rel="noopener">Meta Platform Terms</a></li>
              <li><a href="https://developers.google.com/youtube/terms/api-services-terms-of-service" className="text-amber-600 dark:text-amber-400 hover:underline" target="_blank" rel="noopener">YouTube API Terms of Service</a></li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-foreground mb-3">7. Disclaimer of Warranties</h2>
            <p>ContentIQ is provided "as is" without warranty. We do not guarantee specific results, engagement rates, or follower growth. AI-generated content should be reviewed before publishing.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-foreground mb-3">8. Limitation of Liability</h2>
            <p>ContentIQ shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service, including account suspensions by social media platforms.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-foreground mb-3">9. Termination</h2>
            <p>We reserve the right to suspend or terminate your account if you violate these Terms or misuse the automation features in ways that violate platform policies.</p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-foreground mb-3">10. Contact</h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a href="mailto:legal@contentiq.app" className="text-amber-600 dark:text-amber-400 hover:underline">legal@contentiq.app</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
