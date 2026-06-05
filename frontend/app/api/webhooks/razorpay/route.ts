import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    // TODO: Store in payment_events table via Supabase

    switch (event.event) {
      case "payment.captured": {
        const payment = event.payload.payment.entity;
        const leadId = payment.notes?.lead_id;
        console.log(`[Webhook] payment.captured - lead_id=${leadId}, payment_id=${payment.id}`);
        // TODO: Update lead, create user, send email
        break;
      }
      case "payment.failed": {
        const payment = event.payload.payment.entity;
        const leadId = payment.notes?.lead_id;
        console.log(`[Webhook] payment.failed - lead_id=${leadId}`);
        // TODO: Update lead payment_status = 'failed'
        break;
      }
      case "order.paid": {
        console.log(`[Webhook] order.paid`);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[/api/webhooks/razorpay]", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
