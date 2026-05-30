import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const maxBytes = file.type.startsWith("video") ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: `File too large. Max: ${file.type.startsWith("video") ? "100MB" : "20MB"}` }, { status: 400 });
    }

    const ext  = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    const { data, error } = await serviceClient.storage
      .from("post-media")
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (error) throw new Error(error.message);

    const { data: { publicUrl } } = serviceClient.storage
      .from("post-media")
      .getPublicUrl(data.path);

    return NextResponse.json({ url: publicUrl });
  } catch (err: any) {
    console.error("[Upload]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
