import { NextRequest, NextResponse } from "next/server";

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;

const RAZORPAY_AUTH = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

// Plan IDs — create these in Razorpay Dashboard first
// Monthly: plan_monthly_Content Engineer
// Yearly:  plan_yearly_Content Engineer
const PLAN_IDS: Record<string, string> = {
  monthly: process.env.RAZORPAY_PLAN_MONTHLY || "plan_monthly_Content Engineer",
  yearly: process.env.RAZORPAY_PLAN_YEARLY || "plan_yearly_Content Engineer",
};

// Prices for one-time lifetime payment (in paise)
const LIFETIME_PRICE_PAISE = Number(process.env.LIFETIME_PRICE_PAISE || "900"); // ₹9

export async function POST(req: NextRequest) {
  try {
    const { planType, userEmail, userName } = await req.json();

    if (!planType || !["monthly", "yearly", "lifetime"].includes(planType)) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: "Payment not configured" }, { status: 503 });
    }

    // --- LIFETIME: create a one-time Order ---
    if (planType === "lifetime") {
      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${RAZORPAY_AUTH}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: LIFETIME_PRICE_PAISE,
          currency: "INR",
          receipt: `lifetime_${Date.now()}`,
          notes: { plan: "lifetime", email: userEmail, name: userName },
        }),
      });
      const order = await orderRes.json();
      if (order.error) throw new Error(order.error.description);
      return NextResponse.json({ type: "order", orderId: order.id, amount: order.amount, currency: order.currency });
    }

    // --- MONTHLY / YEARLY: create a Subscription ---
    const planId = PLAN_IDS[planType];
    const subRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${RAZORPAY_AUTH}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: planId,
        total_count: planType === "yearly" ? 5 : 60, // 5 years max or 60 months
        quantity: 1,
        customer_notify: 1,
        notes: { plan: planType, email: userEmail, name: userName },
      }),
    });
    const sub = await subRes.json();
    if (sub.error) throw new Error(sub.error.description);

    return NextResponse.json({
      type: "subscription",
      subscriptionId: sub.id,
      planType,
    });
  } catch (err: any) {
    console.error("[/api/payments/create-subscription]", err);
    return NextResponse.json({ error: err.message || "Payment creation failed" }, { status: 500 });
  }
}
