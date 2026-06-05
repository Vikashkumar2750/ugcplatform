import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { txnId, utr, userId } = await req.json();

    if (!txnId || !utr || !userId) {
      return NextResponse.json({ error: "txnId, utr, userId required" }, { status: 400 });
    }

    // Validate UTR format (12 digits typically)
    const cleanUTR = utr.trim().replace(/\s/g, "");
    if (cleanUTR.length < 10 || cleanUTR.length > 22) {
      return NextResponse.json({ error: "UTR number invalid. 10-22 digits hona chahiye." }, { status: 400 });
    }

    // Update payment record
    await supabase.from("payments").update({
      utr_number: cleanUTR,
      status: "pending_verification",
      utr_submitted_at: new Date().toISOString(),
    }).eq("id", txnId).eq("user_id", userId);

    // Optimistically mark user as active (admin can revoke if fraud)
    // In production: wait for manual admin verification before this step
    const { error: profileErr } = await supabase.from("profiles").update({
      subscription_status: "active",
      subscription_plan: "lifetime",
      subscription_activated_at: new Date().toISOString(),
      payment_utr: cleanUTR,
      payment_txn_id: txnId,
    }).eq("id", userId);

    if (profileErr) {
      console.warn("[upi-verify] Profile update failed:", profileErr.message);
    }

    return NextResponse.json({
      success: true,
      message: "UTR submitted. Verification 24 ghante mein complete hogi. Agar 24 ghante mein access nahi mila to support@techaasvik.in par contact karo.",
      txnId,
      utr: cleanUTR,
    });
  } catch (err: any) {
    console.error("[/api/payments/upi-verify]", err);
    return NextResponse.json({ error: err.message || "Verification failed" }, { status: 500 });
  }
}
