import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// UPI config — set these in Vercel env vars
const UPI_ID       = process.env.UPI_ID       || "techaasvik@okicici";
const MERCHANT_NAME = process.env.MERCHANT_NAME || "Content Engineer";
const AMOUNT_INR    = Number(process.env.LIFETIME_PRICE_INR || "9");

export async function POST(req: NextRequest) {
  try {
    const { userEmail, userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const txnId = `CE-${Date.now()}-${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // Save pending payment to DB
    const { error: dbErr } = await supabase.from("payments").insert({
      id: txnId,
      user_id: userId,
      user_email: userEmail,
      amount_inr: AMOUNT_INR,
      status: "pending",
      method: "upi",
      created_at: new Date().toISOString(),
    });

    if (dbErr) {
      // Table may not exist yet — non-fatal, still show UPI link
      console.warn("[upi-init] DB insert failed (table may need migration):", dbErr.message);
    }

    // UPI deep link (works with Google Pay, PhonePe, BHIM, Paytm etc.)
    const upiParams = new URLSearchParams({
      pa: UPI_ID,
      pn: MERCHANT_NAME,
      am: String(AMOUNT_INR),
      cu: "INR",
      tn: `Content Engineer Access - ${txnId}`,
      tr: txnId,
    });

    const upiLink   = `upi://pay?${upiParams}`;
    const gpayLink  = `gpay://upi/pay?${upiParams}`;
    const phonepeLink = `phonepe://pay?${upiParams}`;

    return NextResponse.json({
      txnId,
      upiLink,
      gpayLink,
      phonepeLink,
      upiId: UPI_ID,
      merchantName: MERCHANT_NAME,
      amountInr: AMOUNT_INR,
    });
  } catch (err: any) {
    console.error("[/api/payments/upi-init]", err);
    return NextResponse.json({ error: err.message || "Failed to init payment" }, { status: 500 });
  }
}
