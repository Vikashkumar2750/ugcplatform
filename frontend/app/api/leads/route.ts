import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, email, whatsapp, platform, niche, source } = body;

    if (!fullName || !email || !whatsapp || !platform || !niche) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create Razorpay order
    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.create({
      amount: 900, // ₹9 in paise
      currency: "INR",
      notes: { email, fullName },
    });

    // TODO: Save lead to Supabase when env vars are configured
    // const supabase = createClient(...)
    // await supabase.from('leads').insert({ ... })

    return NextResponse.json({
      leadId: `lead_${Date.now()}`, // Will be real UUID from Supabase
      orderId: order.id,
    });
  } catch (error: any) {
    console.error("[/api/leads]", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
