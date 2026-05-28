import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch { return null; }
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — fetch user's Instagram recent media posts
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();

  // Get user's active Instagram connection with access token
  const { data: connection } = await supabase
    .from("platform_connections")
    .select("access_token, platform_user_id")
    .eq("user_id", userId)
    .eq("platform", "instagram")
    .eq("is_active", true)
    .single();

  if (!connection?.access_token) {
    return NextResponse.json({ error: "Instagram not connected", media: [] });
  }

  try {
    // Fetch recent 20 media from Instagram Graph API
    const fields = "id,media_type,media_url,thumbnail_url,caption,timestamp,permalink";
    const url = `https://graph.facebook.com/v21.0/${connection.platform_user_id}/media?fields=${fields}&limit=20&access_token=${connection.access_token}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message, media: [] });
    }

    // Normalize media items
    const media = (data.data || []).map((m: any) => ({
      id: m.id,
      type: m.media_type, // IMAGE | VIDEO | CAROUSEL_ALBUM
      url: m.media_url || m.thumbnail_url || "",
      thumbnail: m.thumbnail_url || m.media_url || "",
      caption: m.caption?.substring(0, 100) || "",
      timestamp: m.timestamp,
      permalink: m.permalink,
    }));

    return NextResponse.json({ media });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, media: [] });
  }
}
