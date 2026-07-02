import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_subscription_id,
      razorpay_signature,
      planType,
      userId,
    } = body;

    if (!RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: "Not configured" }, { status: 503 });
    }

    // Verify signature
    let expectedSig: string;
    if (razorpay_order_id) {
      // One-time order
      expectedSig = createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");
    } else {
      // Subscription
      expectedSig = createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
        .digest("hex");
    }

    if (expectedSig !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Update user plan in Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && userId) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const now = new Date();
      let periodEnd: Date | null = null;
      if (planType === "monthly") { periodEnd = new Date(now); periodEnd.setMonth(periodEnd.getMonth() + 1); }
      if (planType === "yearly") { periodEnd = new Date(now); periodEnd.setFullYear(periodEnd.getFullYear() + 1); }
      if (planType === "pro_6month") { periodEnd = new Date(now); periodEnd.setMonth(periodEnd.getMonth() + 6); }

      await supabase.from("user_subscriptions").upsert({
        user_id: userId,
        plan_type: planType,
        status: "active",
        razorpay_subscription_id: razorpay_subscription_id || null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd?.toISOString() || null,
        updated_at: now.toISOString(),
      }, { onConflict: "user_id" });

      // Log transaction
      await supabase.from("transactions").insert({
        user_id: userId,
        type: "payment",
        plan: planType,
        amount: planType === "lifetime" ? 9 : planType === "monthly" ? 9 : 89,
        currency: "INR",
        status: "success",
        razorpay_payment_id,
        razorpay_order_id: razorpay_order_id || null,
        razorpay_subscription_id: razorpay_subscription_id || null,
      });
    }

    return NextResponse.json({ success: true, planType });
  } catch (err: any) {
    console.error("[/api/payments/verify]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
