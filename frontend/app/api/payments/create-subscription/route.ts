import { NextRequest, NextResponse } from "next/server";

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;

const RAZORPAY_AUTH = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

// Prices in paise (₹ × 100)
const PLAN_PRICES: Record<string, number> = {
  lifetime: 900,        // ₹9
  monthly: 5900,        // ₹59
  pro_6month: 29900,    // ₹299
  yearly: 59900,        // ₹599
};

export async function POST(req: NextRequest) {
  try {
    const { planType, userEmail, userName, amountOverride } = await req.json();

    if (!planType || !PLAN_PRICES[planType]) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: "Payment not configured" }, { status: 503 });
    }

    const amount = amountOverride || PLAN_PRICES[planType];

    // Create a Razorpay Order (one-time payment for all plans)
    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${RAZORPAY_AUTH}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: `${planType}_${Date.now()}`,
        notes: { plan: planType, email: userEmail, name: userName },
      }),
    });
    const order = await orderRes.json();
    if (order.error) throw new Error(order.error.description || "Razorpay order creation failed");

    return NextResponse.json({
      type: "order",
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err: any) {
    console.error("[/api/payments/create-subscription]", err);
    return NextResponse.json({ error: err.message || "Payment creation failed" }, { status: 500 });
  }
}
