/**
 * Test follower check with commenter's IG user ID
 */
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const SUPABASE_URL = "https://efrxmkidupynwmnqhcfx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmcnhta2lkdXB5bndtbnFoY2Z4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg4MDc4MCwiZXhwIjoyMDk1NDU2NzgwfQ.7nGLIXLbYLZZ1q9VYQaeroOnG8ElpRz97Myt1dVF1Zs";
const API_KEY_SECRET = "dcd36115cdf53cee51226fd1733c8f2d91451cc8eae2ba6b58054722abfff202";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function decryptToken(data) {
  try {
    if (!API_KEY_SECRET) return data;
    const parts = data.split(":");
    if (parts.length !== 3) return data;
    const [ivHex, tagHex, encryptedHex] = parts;
    const key = crypto.scryptSync(API_KEY_SECRET, "contentiq_salt_v1", 32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(encryptedHex, "hex")).toString("utf8") + decipher.final("utf8");
  } catch {
    return data;
  }
}

async function test() {
  // 1. Get the Instagram account
  const { data: acc } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("platform", "instagram")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!acc) { console.log("No IG account"); return; }
  const token = decryptToken(acc.access_token);
  console.log(`Account: ${acc.platform_username} (igId=${acc.platform_user_id}, pageId=${acc.page_id})`);
  console.log(`Token starts: ${token.substring(0, 30)}...`);

  // 2. Get recent comment senders from webhook_events  
  const { data: commentEvents } = await supabase
    .from("webhook_events")
    .select("sender_id, payload, created_at")
    .eq("event_type", "comments")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log(`\nRecent comment senders:`);
  for (const ce of (commentEvents || [])) {
    const from = ce.payload?.from || {};
    console.log(`  sender_id=${ce.sender_id} | from.id=${from.id} | from.username=${from.username}`);
  }

  // 3. Get recent commenter IDs from processed_comments  
  const { data: pc } = await supabase
    .from("processed_comments")
    .select("commentor_id, comment_id, rule_id")
    .not("commentor_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  console.log(`\nProcessed comments with commentor_id:`);
  for (const p of (pc || [])) {
    console.log(`  commentor_id=${p.commentor_id} | comment_id=${p.comment_id?.substring(0, 20)}`);
  }

  // 4. Try follower check with different endpoints
  // Test with the user's own IG ID first (should return is_user_follow_business for own account)
  const testIds = [
    ...new Set([
      acc.platform_user_id, // own IG ID
      ...(commentEvents || []).map(e => e.payload?.from?.id).filter(Boolean),
      ...(commentEvents || []).map(e => e.sender_id).filter(Boolean),
    ])
  ].slice(0, 5);

  console.log(`\nTesting follower check API with ${testIds.length} IDs:`);
  for (const testId of testIds) {
    console.log(`\n  Testing ID: ${testId}`);
    
    // Method A: GET /{userId}?fields=is_user_follow_business
    try {
      const url = `https://graph.facebook.com/v21.0/${testId}?fields=is_user_follow_business&access_token=${token}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        console.log(`  A) GET /${testId}?fields=is_user_follow_business → ❌ ${data.error.message.substring(0, 80)}`);
      } else {
        console.log(`  A) GET /${testId}?fields=is_user_follow_business → ✅ follow=${data.is_user_follow_business}`);
      }
    } catch (e) {
      console.log(`  A) ❌ Error: ${e.message}`);
    }

    // Method B: Check if this is an IG user who follows the business via IG User ID
    try {
      const url2 = `https://graph.facebook.com/v21.0/${acc.platform_user_id}?fields=business_discovery.fields(followers_count)&access_token=${token}`;
      const res2 = await fetch(url2);
      const data2 = await res2.json();
      if (data2.error) {
        console.log(`  B) business_discovery → ❌ ${data2.error.message.substring(0, 80)}`);
      } else {
        console.log(`  B) business_discovery → followers_count=${data2.business_discovery?.followers_count}`);
      }
    } catch (e) {
      console.log(`  B) ❌ Error: ${e.message}`);
    }
  }

  // 5. Test: What API permissions does this app have?
  console.log(`\n\nChecking app permissions via /me endpoint:`);
  try {
    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}`);
    const meData = await meRes.json();
    console.log(`  /me result:`, JSON.stringify(meData));
  } catch (e) {
    console.log(`  /me error:`, e.message);
  }

  // Check permissions
  try {
    const permRes = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${token}`);
    const permData = await permRes.json();
    console.log(`\n  Permissions:`);
    for (const p of (permData.data || [])) {
      const emoji = p.status === "granted" ? "✅" : "❌";
      console.log(`    ${emoji} ${p.permission} = ${p.status}`);
    }
  } catch (e) {
    console.log(`  permissions error:`, e.message);
  }
}

test().catch(e => console.error("Test failed:", e));
