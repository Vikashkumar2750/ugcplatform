import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { fileName } = await request.json();
    if (!fileName) return NextResponse.json({ error: "No fileName provided" }, { status: 400 });

    const ext = fileName.split(".").pop()?.toLowerCase() || "mp4";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await serviceClient.storage
      .from("post-media")
      .createSignedUploadUrl(path);

    if (error) throw new Error(error.message);

    // Get the public URL ahead of time so the client knows where it will be
    const { data: { publicUrl } } = serviceClient.storage
      .from("post-media")
      .getPublicUrl(path);

    return NextResponse.json({ 
      signedUrl: data.signedUrl, 
      token: data.token,
      path, 
      publicUrl 
    });
  } catch (err: any) {
    console.error("[GetUploadUrl]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
