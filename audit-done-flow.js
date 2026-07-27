/**
 * COMPREHENSIVE AUDIT: DONE Flow Debug
 * Tests every step from webhook receipt to DM delivery
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
  } catch (e) {
    console.log("  ❌ Decrypt failed:", e.message);
    return data;
  }
}

async function audit() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  DONE FLOW AUDIT — Step by Step");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ─── STEP 1: Check connected accounts ───────────────────────────
  console.log("━━━ STEP 1: Connected Accounts ━━━");
  const { data: accounts, error: accErr } = await supabase
    .from("connected_accounts")
    .select("id, user_id, platform, platform_user_id, page_id, platform_username, is_active, access_token")
    .eq("is_active", true)
    .limit(10);

  if (accErr) {
    console.log("  ❌ Error fetching accounts:", accErr.message);
    return;
  }

  console.log(`  Found ${accounts.length} active accounts:`);
  for (const acc of accounts) {
    const tokenPreview = acc.access_token?.substring(0, 20) + "...";
    const isEncrypted = acc.access_token?.includes(":");
    const decrypted = isEncrypted ? decryptToken(acc.access_token) : acc.access_token;
    const decryptOK = decrypted !== acc.access_token || !isEncrypted;
    console.log(`  • ${acc.platform_username} (${acc.platform}) | igId=${acc.platform_user_id} | pageId=${acc.page_id}`);
    console.log(`    id=${acc.id} | encrypted=${isEncrypted} | decrypt=${decryptOK ? '✅' : '❌'}`);
    console.log(`    token_start=${decrypted?.substring(0, 30)}...`);
    
    // Check if multiple accounts share same page_id or platform_user_id
    const { data: dupes } = await supabase
      .from("connected_accounts")
      .select("id, platform, platform_username")
      .or(`platform_user_id.eq.${acc.platform_user_id},page_id.eq.${acc.page_id || 'NONE'}`)
      .eq("is_active", true);
    if (dupes && dupes.length > 1) {
      console.log(`    ⚠️ DUPLICATE MATCH: ${dupes.length} accounts match this pageId/igId!`);
      dupes.forEach(d => console.log(`      → ${d.platform_username} (${d.platform}) id=${d.id}`));
    }
  }

  // ─── STEP 2: Check recent webhook events for DM/postback ────────
  console.log("\n━━━ STEP 2: Recent Webhook Events (last 20) ━━━");
  const { data: events } = await supabase
    .from("webhook_events")
    .select("id, event_type, sender_id, recipient_id, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  console.log(`  Found ${events?.length || 0} recent events:`);
  for (const evt of (events || [])) {
    const p = evt.payload;
    const msgText = p?.message?.text || p?.postback?.title || "—";
    const postbackPayload = p?.postback?.payload || "—";
    const quickReply = p?.message?.quick_reply?.payload || "—";
    const isPostback = !!p?.postback;
    const time = new Date(evt.created_at).toLocaleTimeString();
    console.log(`  [${time}] ${evt.event_type} from=${evt.sender_id} | text="${msgText.substring(0, 40)}" | postback=${postbackPayload} | qr=${quickReply} | isPostback=${isPostback}`);
  }

  // ─── STEP 3: Check automation rules with require_follow ─────────
  console.log("\n━━━ STEP 3: Automation Rules with require_follow ━━━");
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("id, name, type, is_active, action_config, account_id, trigger_count, last_triggered")
    .eq("is_active", true)
    .limit(20);

  let requireFollowRules = [];
  for (const r of (rules || [])) {
    const hasRF = r.action_config?.require_follow === true;
    const doneBtn = r.action_config?.done_button_text || "(not set → default 'Send me the access')";
    const link = r.action_config?.link || "(no link!)";
    const msg = r.action_config?.message || r.action_config?.messages?.[0] || "(no message)";
    console.log(`  • "${r.name}" type=${r.type} active=${r.is_active} require_follow=${hasRF} account_id=${r.account_id || 'null'}`);
    console.log(`    done_button_text="${doneBtn}" | link=${link.substring(0, 50)}`);
    console.log(`    trigger_count=${r.trigger_count} | last_triggered=${r.last_triggered || 'never'}`);
    if (hasRF) requireFollowRules.push(r);
  }

  if (requireFollowRules.length === 0) {
    console.log("  ⚠️ NO RULES with require_follow=true found!");
  }

  // ─── STEP 4: Check message_queue for recent activity ────────────
  console.log("\n━━━ STEP 4: Message Queue (last 20 entries) ━━━");
  const { data: queue } = await supabase
    .from("message_queue")
    .select("id, status, message_type, recipient_id, message_payload, error, created_at, sent_at, scheduled_send_at, automation_rule_id")
    .order("created_at", { ascending: false })
    .limit(20);

  console.log(`  Found ${queue?.length || 0} queue entries:`);
  for (const q of (queue || [])) {
    const time = new Date(q.created_at).toLocaleTimeString();
    const sentTime = q.sent_at ? new Date(q.sent_at).toLocaleTimeString() : "—";
    const payload = q.message_payload;
    const text = payload?.text?.substring(0, 50) || "—";
    const hasLink = !!payload?.link;
    const hasPostback = !!payload?.postback_button;
    const hasQR = !!payload?.quick_replies?.length;
    console.log(`  [${time}] ${q.status} | type=${q.message_type} | to=${q.recipient_id?.substring(0, 15)}... | rule=${q.automation_rule_id?.substring(0, 8) || '—'}`);
    console.log(`    text="${text}" | link=${hasLink} | postback=${hasPostback} | qr=${hasQR} | error=${q.error || '—'} | sent=${sentTime}`);
  }

  // ─── STEP 5: Test DONE detection logic ──────────────────────────
  console.log("\n━━━ STEP 5: DONE Detection Test ━━━");
  const testTexts = ["done", "send me the access", "send me the access ✅", "access", "DONE:some-uuid"];
  for (const text of testTexts) {
    const lower = text.toLowerCase();
    const isDonePayload = lower.startsWith("done:");
    const isDoneText = lower === "done" || lower === "done ✅" || lower.includes("done")
      || lower.includes("send me the access") || lower === "access";
    console.log(`  "${text}" → isDonePayload=${isDonePayload}, isDoneText=${isDoneText}, TRIGGERED=${isDonePayload || isDoneText ? '✅' : '❌'}`);
  }

  // ─── STEP 6: Test follower check API ────────────────────────────
  console.log("\n━━━ STEP 6: Follower Check API Test ━━━");
  if (accounts.length > 0) {
    const acc = accounts.find(a => a.platform === "instagram") || accounts[0];
    const token = decryptToken(acc.access_token);
    
    // Find a recent sender from webhook_events
    const recentSender = events?.find(e => e.sender_id && e.sender_id !== acc.platform_user_id)?.sender_id;
    if (recentSender) {
      console.log(`  Testing follower check for sender=${recentSender} with account=${acc.platform_username}`);
      try {
        const followUrl = `https://graph.facebook.com/v21.0/${recentSender}?fields=is_user_follow_business&access_token=${token}`;
        const res = await fetch(followUrl);
        const data = await res.json();
        console.log(`  Result: ${JSON.stringify(data)}`);
        if (data.error) {
          console.log(`  ❌ API Error: ${data.error.message}`);
          console.log(`  Error type: ${data.error.type}, code: ${data.error.code}`);
        } else {
          console.log(`  ✅ is_user_follow_business = ${data.is_user_follow_business}`);
        }
      } catch (e) {
        console.log(`  ❌ Fetch error: ${e.message}`);
      }
    } else {
      console.log("  ⚠️ No recent sender found in webhook events to test");
    }
  }

  // ─── STEP 7: Test backend enqueue endpoint ──────────────────────
  console.log("\n━━━ STEP 7: Backend Enqueue Reachability ━━━");
  const BACKEND_URL = "https://ugc-backend-bx31.onrender.com";
  const WORKER_SECRET = "";  // Will be read from env
  try {
    const healthRes = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    const healthData = await healthRes.text();
    console.log(`  Backend health: ${healthRes.status} — ${healthData.substring(0, 100)}`);
  } catch (e) {
    console.log(`  ❌ Backend unreachable: ${e.message}`);
    console.log(`  ⚠️ If backend is down, enqueue fails → DONE flow sends nothing!`);
  }

  // ─── STEP 8: Check processed_comments for DONE tracking ─────────
  console.log("\n━━━ STEP 8: Processed Comments (DONE tracking) ━━━");
  const { data: processed } = await supabase
    .from("processed_comments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  console.log(`  Found ${processed?.length || 0} recent entries:`);
  for (const p of (processed || [])) {
    console.log(`  • comment=${p.comment_id?.substring(0, 15)}... sender=${p.sender_id} rule=${p.rule_id?.substring(0, 8)} created=${new Date(p.created_at).toLocaleTimeString()}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  AUDIT COMPLETE — Review above for 🔴 errors");
  console.log("═══════════════════════════════════════════════════════════");
}

audit().catch(e => console.error("Audit failed:", e));
