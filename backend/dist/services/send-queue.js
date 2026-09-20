"use strict";
/**
 * send-queue.ts — Postgres-backed Outbound Message Queue
 *
 * Architecture:
 *   enqueueMessage() → compliance check → rate limit check → insert to queue
 *   processMessageQueue() [cron] → dequeue → typing delay → Meta API → record
 *
 * Every automated message flows through this pipeline.
 * No code path sends directly to Meta API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueMessage = enqueueMessage;
exports.processMessageQueue = processMessageQueue;
exports.recoverStaleMessages = recoverStaleMessages;
exports.getQueueStats = getQueueStats;
const supabase_1 = require("../lib/supabase");
const compliance_1 = require("./compliance");
const rate_limiter_1 = require("./rate-limiter");
const crypto_1 = require("./crypto");
// ─── Enqueue a message ───────────────────────────────────────────────────────
// This is the ONLY way automated messages should be sent.
async function enqueueMessage(input) {
    const { accountId, userId, recipientId, messagePayload, messageType, platform, automationRuleId, correlationId, messageTag, priority, scheduledSendAt, idempotencyKey, } = input;
    // ── Step 0: Idempotency check (BUG-14 fix) ──────────────────────────────
    // If an idempotency key is provided, check if this message was already enqueued.
    // This prevents duplicate messages when Meta retries the same webhook event.
    if (idempotencyKey) {
        const { data: existing } = await supabase_1.supabase
            .from("message_queue")
            .select("id, status")
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle();
        if (existing) {
            console.log(`[SendQueue] Idempotency hit: key=${idempotencyKey} → existing queue=${existing.id} status=${existing.status}`);
            return { queued: true, queueId: existing.id };
        }
    }
    // ── Step 1: Compliance check ─────────────────────────────────────────────
    const complianceInput = {
        accountId,
        userId,
        recipientId,
        messageText: messagePayload.text,
        messageType,
        messageTag,
        ruleId: automationRuleId,
    };
    const compliance = await (0, compliance_1.checkCompliance)(complianceInput);
    if (!compliance.allowed) {
        // Insert as blocked (for audit trail) then return
        const { data } = await supabase_1.supabase.from("message_queue").insert({
            account_id: accountId,
            user_id: userId,
            recipient_id: recipientId,
            message_payload: messagePayload,
            message_type: messageType,
            automation_rule_id: automationRuleId || null,
            compliance_status: "blocked",
            compliance_reason: compliance.reasonCode,
            rate_limit_status: "pending",
            status: "blocked",
            priority: priority || 5,
            scheduled_send_at: scheduledSendAt || new Date().toISOString(),
        }).select("id").single();
        return {
            queued: false,
            queueId: data?.id,
            blocked: true,
            blockReason: compliance.reasonDetail || compliance.reasonCode,
        };
    }
    // ── Step 2: Rate limit pre-check ─────────────────────────────────────────
    // We do a pre-check here to reject obviously rate-limited messages early.
    // The actual rate gate happens again at dequeue time (double-check).
    const rateCheck = await (0, rate_limiter_1.checkRateLimit)(accountId, recipientId);
    let initialStatus = "queued";
    let rateLimitStatus = "pending";
    const isFuture = scheduledSendAt && new Date(scheduledSendAt) > new Date();
    if (!rateCheck.allowed) {
        // Don't block — delay instead. The queue processor will retry.
        rateLimitStatus = "delayed";
        initialStatus = "queued"; // Still queued, just delayed
    }
    else {
        rateLimitStatus = "approved";
        // If it's scheduled for the future, it MUST be queued. Otherwise it bypasses the scheduled time.
        initialStatus = isFuture ? "queued" : "ready";
    }
    // ── Step 3: Insert into queue ────────────────────────────────────────────
    const insertData = {
        account_id: accountId,
        user_id: userId,
        recipient_id: recipientId,
        message_payload: messagePayload,
        message_type: messageType,
        automation_rule_id: automationRuleId || null,
        compliance_status: "approved",
        compliance_reason: null,
        rate_limit_status: rateLimitStatus,
        status: initialStatus,
        priority: priority || 5,
        scheduled_send_at: scheduledSendAt || new Date().toISOString(),
    };
    // Add optional fields
    if (idempotencyKey)
        insertData.idempotency_key = idempotencyKey;
    if (platform)
        insertData.platform = platform;
    if (correlationId)
        insertData.correlation_id = correlationId;
    const { data, error } = await supabase_1.supabase.from("message_queue")
        .insert(insertData)
        .select("id").single();
    if (error) {
        console.error("[SendQueue] Failed to enqueue:", error.message);
        return { queued: false, blockReason: `Queue insertion failed: ${error.message}` };
    }
    if (!rateCheck.allowed) {
        return {
            queued: true,
            queueId: data.id,
            rateLimited: true,
            retryAfterMs: rateCheck.retryAfterMs,
        };
    }
    return { queued: true, queueId: data.id };
}
// ─── Process message queue (called by cron every 5 seconds) ──────────────────
async function processMessageQueue() {
    const nowISO = new Date().toISOString();
    // First, fetch messages that are explicitly "ready" (no rate limit delay)
    const { data: readyMessages, error: readyError } = await supabase_1.supabase
        .from("message_queue")
        .select("*, connected_accounts(access_token, platform_user_id, page_id, platform)")
        .eq("status", "ready")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(10);
    // DIAGNOSTIC: Log query errors that were previously swallowed silently
    if (readyError) {
        console.error(`[SendQueue] ❌ readyMessages query FAILED — code=${readyError.code} message=${readyError.message} details=${readyError.details} hint=${readyError.hint}`);
    }
    // Then fetch "queued" messages that have reached their scheduled time
    const { data: queuedMessages, error: queuedError } = await supabase_1.supabase
        .from("message_queue")
        .select("*, connected_accounts(access_token, platform_user_id, page_id, platform)")
        .eq("status", "queued")
        .lte("scheduled_send_at", nowISO)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(10);
    // DIAGNOSTIC: Log query errors that were previously swallowed silently
    if (queuedError) {
        console.error(`[SendQueue] ❌ queuedMessages query FAILED — code=${queuedError.code} message=${queuedError.message} details=${queuedError.details} hint=${queuedError.hint}`);
    }
    const messages = [...(readyMessages || []), ...(queuedMessages || [])].slice(0, 10);
    // DIAGNOSTIC: Log queue state every cycle (helps identify silent failures)
    if (messages.length > 0) {
        console.log(`[SendQueue] 📬 Found ${messages.length} messages to process (ready=${readyMessages?.length || 0}, queued=${queuedMessages?.length || 0}, now=${nowISO})`);
        // Log each message's key fields (no tokens/secrets)
        for (const m of messages) {
            const hasAccount = !!m.connected_accounts;
            const hasToken = !!(Array.isArray(m.connected_accounts) ? m.connected_accounts[0]?.access_token : m.connected_accounts?.access_token);
            console.log(`[SendQueue]   → id=${m.id} type=${m.message_type} status=${m.status} platform=${m.platform || 'null'} account_id=${m.account_id || 'null'} scheduled=${m.scheduled_send_at} retry=${m.retry_count} has_account=${hasAccount} has_token=${hasToken}`);
        }
    }
    if (!messages.length)
        return 0;
    let sentCount = 0;
    for (const msg of messages) {
        try {
            // ── Mark as processing (prevent other workers from picking it up) ─────
            await supabase_1.supabase.from("message_queue")
                .update({ status: "processing", processing_at: new Date().toISOString() })
                .eq("id", msg.id)
                .eq("status", msg.status); // Optimistic lock
            // ── Re-check rate limit at dequeue time ──────────────────────────────
            const rateCheck = await (0, rate_limiter_1.checkRateLimit)(msg.account_id, msg.recipient_id);
            if (!rateCheck.allowed) {
                // Put back in queue with delay
                const retryAt = new Date(Date.now() + (rateCheck.retryAfterMs || 5000)).toISOString();
                await supabase_1.supabase.from("message_queue")
                    .update({
                    status: "queued",
                    rate_limit_status: "delayed",
                    scheduled_send_at: retryAt,
                    processing_at: null,
                })
                    .eq("id", msg.id);
                continue;
            }
            // ── Get account token ────────────────────────────────────────────────
            const account = Array.isArray(msg.connected_accounts)
                ? msg.connected_accounts[0]
                : msg.connected_accounts;
            if (!account?.access_token) {
                throw new Error("No access token for connected account");
            }
            // Decrypt token
            let token;
            try {
                token = (0, crypto_1.decrypt)(account.access_token);
            }
            catch {
                // Token might not be encrypted yet (pre-migration)
                token = account.access_token;
            }
            // ── Apply typing simulation delay ────────────────────────────────────
            const payload = msg.message_payload;
            const typingDelay = (0, rate_limiter_1.getTypingDelay)(payload.text);
            await new Promise(r => setTimeout(r, typingDelay));
            // ── Send via Meta API ────────────────────────────────────────────────
            const metaResult = await sendViaMetaAPI({
                token,
                igUserId: account.platform_user_id,
                pageId: account.page_id, // needed for Private Reply endpoint
                recipientId: msg.recipient_id,
                payload,
                messageType: msg.message_type,
                platform: account.platform,
            });
            if (metaResult.error) {
                throw new Error(metaResult.error);
            }
            // ── Record success ───────────────────────────────────────────────────
            await (0, rate_limiter_1.recordSend)(msg.account_id, msg.recipient_id);
            await supabase_1.supabase.from("message_queue").update({
                status: "sent",
                sent_at: new Date().toISOString(),
                meta_message_id: metaResult.messageId || null,
                rate_limit_status: "approved",
            }).eq("id", msg.id);
            sentCount++;
            console.log(`[SendQueue] ✅ Sent to ${msg.recipient_id} (queue=${msg.id})`);
        }
        catch (err) {
            console.error(`[SendQueue] ❌ Failed queue=${msg.id}:`, err.message);
            const retryCount = (msg.retry_count || 0) + 1;
            const maxRetries = msg.max_retries || 3;
            if (retryCount >= maxRetries) {
                // Max retries exceeded — mark as failed permanently
                await supabase_1.supabase.from("message_queue").update({
                    status: "failed",
                    error: err.message.substring(0, 500),
                    retry_count: retryCount,
                    processing_at: null,
                }).eq("id", msg.id);
            }
            else {
                // Exponential backoff: 10s, 30s, 90s
                const backoffMs = 10_000 * Math.pow(3, retryCount - 1);
                const retryAt = new Date(Date.now() + backoffMs).toISOString();
                await supabase_1.supabase.from("message_queue").update({
                    status: "queued",
                    error: err.message.substring(0, 500),
                    retry_count: retryCount,
                    scheduled_send_at: retryAt,
                    processing_at: null,
                }).eq("id", msg.id);
            }
        }
    }
    return sentCount;
}
// ─── Recover stale processing messages ───────────────────────────────────────
// If a worker crashes mid-processing, messages get stuck in 'processing'.
// This cron resets them back to 'queued' after 60 seconds.
async function recoverStaleMessages() {
    const staleThreshold = new Date(Date.now() - 60_000).toISOString();
    const { data, error } = await supabase_1.supabase
        .from("message_queue")
        .update({ status: "queued", processing_at: null })
        .eq("status", "processing")
        .lt("processing_at", staleThreshold)
        .select("id");
    if (error) {
        console.warn("[SendQueue] Stale recovery error:", error.message);
        return 0;
    }
    if (data?.length) {
        console.log(`[SendQueue] Recovered ${data.length} stale messages`);
    }
    return data?.length || 0;
}
async function sendViaMetaAPI(input) {
    const { token, igUserId, recipientId, payload, messageType, platform } = input;
    // ── 1. Public comment reply ────────────────────────────────────────────────
    // CRITICAL: Instagram uses /{comment-id}/replies
    //           Facebook uses  /{comment-id}/comments
    // Using the wrong endpoint causes a Meta API error and no reply is sent.
    if (messageType === "comment_reply") {
        const replyEndpoint = platform === "facebook"
            ? `https://graph.facebook.com/v21.0/${recipientId}/comments`
            : `https://graph.facebook.com/v21.0/${recipientId}/replies`;
        console.log(`[SendQueue] Public comment reply → platform=${platform} endpoint=.../${recipientId}/${platform === "facebook" ? "comments" : "replies"}`);
        const res = await fetch(replyEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: payload.text,
                access_token: token,
            }),
        });
        const data = await res.json();
        if (!res.ok || data.error)
            return { error: `Meta comment reply: ${data.error?.message || `HTTP ${res.status}`}` };
        return { messageId: data.id };
    }
    // ── 2. Private Reply (DM to commenter via comment_id) ─────────────────────
    // This is the CORRECT way to DM a commenter. It works in testing mode without
    // App Review as long as the account is an App Admin/Tester/Developer.
    // Endpoint: POST /{page-id}/messages with recipient: { comment_id: <comment_id> }
    // Ref: https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies
    //
    // IMPORTANT: Meta's Private Reply API (recipient: { comment_id }) only reliably
    // supports TEXT-ONLY messages. quick_replies, postback buttons, and generic
    // templates are NOT supported in this API context and return "Invalid parameter".
    // Interactive elements should only be sent AFTER the user replies (24h window)
    // using the standard IGSID Send API (recipient: { id: <IGSID> }).
    if (messageType === "private_reply") {
        // Build text-only message — include link in text body if present
        let messageText = payload.text || "";
        // If there's a link, append it to the message text (URLs auto-link in Instagram DMs)
        if (payload.link && !messageText.includes(payload.link)) {
            messageText = messageText.trim() + "\n\n" + payload.link;
        }
        // Log stripped interactive elements for debugging
        if (payload.quick_replies?.length) {
            console.log(`[SendQueue] ⚠️ Private Reply: stripped ${payload.quick_replies.length} quick_replies (NOT supported by Meta in comment_id context)`);
        }
        if (payload.postback_button) {
            console.log(`[SendQueue] ⚠️ Private Reply: stripped postback_button "${payload.postback_button.title}" (NOT supported by Meta in comment_id context)`);
        }
        const privateReplyBody = {
            recipient: { comment_id: recipientId }, // recipientId IS the comment_id here
            message: { text: messageText },
        };
        // Private Reply uses the Page ID as the sender endpoint (NOT the IG User ID)
        // Ref: https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies
        // Endpoint: POST /{page-id}/messages with recipient: { comment_id }
        const senderId = input.pageId || igUserId; // prefer page_id, fall back to igUserId
        console.log(`[SendQueue] Private Reply → comment=${recipientId} sender=${senderId} (page=${input.pageId}, igUser=${igUserId}) text_length=${messageText.length} has_link=${!!payload.link}`);
        const res = await fetch(`https://graph.facebook.com/v21.0/${senderId}/messages?access_token=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(privateReplyBody),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
            const errMsg = data.error?.message || `HTTP ${res.status}`;
            const errCode = data.error?.code || "unknown";
            const errSubcode = data.error?.error_subcode || "none";
            console.error(`[SendQueue] ❌ Private Reply API error: code=${errCode} subcode=${errSubcode} message=${errMsg}`, JSON.stringify(data));
            return { error: `Meta Private Reply API: ${errMsg}` };
        }
        console.log(`[SendQueue] ✅ Private Reply sent: message_id=${data.message_id} recipient_id=${data.recipient_id}`);
        return { messageId: data.message_id };
    }
    // ── 3. Standard DM / Broadcast ────────────────────────────────────────────
    // NOTE: Instagram API does NOT use "messaging_product" (that's WhatsApp-only)
    const dmBody = {
        recipient: { id: recipientId },
        message: {},
    };
    // Build message body
    if (payload.link) {
        let title = payload.text;
        let subtitle = "";
        if (title.length > 80) {
            title = payload.text.substring(0, 80);
            subtitle = payload.text.substring(80, 160);
        }
        // Template with button (for Instagram, use generic template)
        dmBody.message.attachment = {
            type: "template",
            payload: {
                template_type: "generic",
                elements: [{
                        title,
                        ...(subtitle ? { subtitle } : {}),
                        default_action: { type: "web_url", url: payload.link },
                        buttons: [{ type: "web_url", url: payload.link, title: payload.button_label || "Open Link →" }],
                    }],
            },
        };
    }
    else {
        dmBody.message.text = payload.text;
    }
    // Quick replies
    if (payload.quick_replies?.length) {
        dmBody.message.quick_replies = payload.quick_replies.map(qr => ({
            content_type: "text",
            title: qr.title.substring(0, 20),
            payload: qr.payload,
        }));
    }
    // Sender endpoint differs by platform:
    // Instagram: /{ig-user-id}/messages (platform_user_id)
    // Facebook:  /{page-id}/messages    (page_id)
    // Never use /me/messages — it is ambiguous and may resolve to the wrong identity.
    const senderId = platform === "facebook"
        ? (input.pageId || igUserId) // Facebook DMs must use Page ID
        : (igUserId || input.pageId); // Instagram DMs use IG User ID
    const endpoint = `https://graph.facebook.com/v21.0/${senderId}/messages`;
    console.log(`[SendQueue] Sending DM to ${recipientId} via platform=${platform} sender=${senderId}`);
    const res = await fetch(`${endpoint}?access_token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dmBody),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
        const errMsg = data.error?.message || `HTTP ${res.status}`;
        console.error(`[SendQueue] ❌ Meta DM API error: ${errMsg}`, JSON.stringify(data));
        return { error: `Meta DM API: ${errMsg}` };
    }
    return { messageId: data.message_id };
}
// ─── Queue stats (for monitoring/dashboard) ──────────────────────────────────
async function getQueueStats(accountId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    let query = supabase_1.supabase.from("message_queue").select("status", { count: "exact", head: false });
    if (accountId) {
        query = query.eq("account_id", accountId);
    }
    const [queuedRes, processingRes, sentRes, failedRes, blockedRes] = await Promise.all([
        supabase_1.supabase.from("message_queue").select("id", { count: "exact", head: true })
            .in("status", ["queued", "ready"]).then(r => r.count || 0),
        supabase_1.supabase.from("message_queue").select("id", { count: "exact", head: true })
            .eq("status", "processing").then(r => r.count || 0),
        supabase_1.supabase.from("message_queue").select("id", { count: "exact", head: true })
            .eq("status", "sent").gte("sent_at", todayISO).then(r => r.count || 0),
        supabase_1.supabase.from("message_queue").select("id", { count: "exact", head: true })
            .eq("status", "failed").gte("created_at", todayISO).then(r => r.count || 0),
        supabase_1.supabase.from("message_queue").select("id", { count: "exact", head: true })
            .eq("status", "blocked").gte("created_at", todayISO).then(r => r.count || 0),
    ]);
    return {
        queued: queuedRes,
        processing: processingRes,
        sent_today: sentRes,
        failed_today: failedRes,
        blocked_today: blockedRes,
    };
}
//# sourceMappingURL=send-queue.js.map