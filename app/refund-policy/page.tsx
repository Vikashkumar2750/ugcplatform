import type { Metadata } from "next";
import { PublicHeader, PublicFooter } from "@/components/public-layout";

export const metadata: Metadata = {
  title: "Refund Policy — ContentIQ",
  description: "ContentIQ Refund Policy — understand our refund and cancellation terms.",
};

export default function RefundPolicyPage() {
  return (
    <>
      <PublicHeader />
      <div className="min-h-screen bg-background py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-heading text-3xl font-bold mb-2">Refund Policy</h1>
          <p className="text-muted-foreground text-sm mb-10">Last updated: 27 May 2026</p>

          <div className="space-y-8 text-muted-foreground leading-relaxed text-sm">
            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">1. Subscription Plans</h2>
              <p>ContentIQ offers monthly and annual subscription plans. All payments are processed securely via Razorpay.</p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">2. Refund Eligibility</h2>
              <p>We offer refunds under the following conditions:</p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong className="text-foreground">7-Day Money-Back Guarantee:</strong> If you are not satisfied with ContentIQ, you may request a full refund within 7 days of your initial subscription purchase. This applies to first-time subscribers only.
                </li>
                <li>
                  <strong className="text-foreground">Technical Issues:</strong> If a verified technical issue on our end prevents you from using the service for more than 72 consecutive hours, you may be eligible for a pro-rated refund for that period.
                </li>
                <li>
                  <strong className="text-foreground">Duplicate Charges:</strong> If you were accidentally charged twice, we will refund the duplicate charge immediately upon verification.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">3. Non-Refundable Cases</h2>
              <p>Refunds will NOT be issued in the following cases:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Renewal charges after the initial subscription period (cancel before renewal)</li>
                <li>Refund requests made after 7 days of the initial purchase</li>
                <li>Account termination due to violation of our Terms of Service</li>
                <li>Dissatisfaction with third-party API services (Anthropic, Apify, Meta, etc.) that ContentIQ integrates with</li>
                <li>Partial month usage after cancellation</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">4. Annual Subscription Cancellation</h2>
              <p>If you cancel an annual subscription:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>You will retain access to ContentIQ until the end of your billing period</li>
                <li>No pro-rated refunds are issued for unused months unless under the 7-day guarantee</li>
                <li>Auto-renewal will be disabled immediately upon cancellation</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">5. How to Request a Refund</h2>
              <p>To request a refund:</p>
              <ol className="list-decimal pl-5 space-y-2 mt-2">
                <li>Email us at <a href="mailto:contact@techaasvik.com" className="text-amber-600 dark:text-amber-400 hover:underline">contact@techaasvik.com</a> with subject line <strong className="text-foreground">&ldquo;Refund Request — [Your Email]&rdquo;</strong></li>
                <li>Include your registered email address and Razorpay payment ID</li>
                <li>Briefly describe the reason for the refund request</li>
                <li>Our team will respond within 2 business days</li>
              </ol>
              <div className="mt-4 p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
                <p className="text-amber-600 dark:text-amber-400 font-medium text-sm">⏱ Processing Time</p>
                <p className="text-xs mt-1">Approved refunds are processed within 5–7 business days. The refund will be credited to your original payment method via Razorpay.</p>
              </div>
            </section>

            <section>
              <h2 className="font-heading text-lg font-bold text-foreground mb-3">6. Contact Us</h2>
              <p>
                For refund queries, email us at{" "}
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
