import { NextRequest, NextResponse } from "next/server";

// Handle LinkedIn Webhook Challenge
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challengeCode = searchParams.get("challengeCode");

  if (challengeCode) {
    // LinkedIn requires the exact challengeCode to be returned in the body
    return new NextResponse(challengeCode, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return NextResponse.json({ error: "Missing challengeCode" }, { status: 400 });
}

// Handle incoming LinkedIn webhook events (if needed in the future)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("LinkedIn Webhook Event Received:", JSON.stringify(body, null, 2));
    
    // We can add logic here in the future to handle LinkedIn comments/reactions
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
