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
    const { accountId, userId, recipientId, messagePayload, messageType, automationRuleId, messageTag, priority, scheduledSendAt, } = input;
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
    if (!rateCheck.allowed) {
        // Don't block — delay instead. The queue processor will retry.
        rateLimitStatus = "delayed";
        initialStatus = "queued"; // Still queued, just delayed
    }
    else {
        rateLimitStatus = "approved";
        initialStatus = "ready"; // Ready for immediate processing
    }
    // ── Step 3: Insert into queue ────────────────────────────────────────────
    const { data, error } = await supabase_1.supabase.from("message_queue").insert({
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
    }).select("id").single();
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
    // Fetch ready messages, oldest first, limited batch
    const { data: messages, error } = await supabase_1.supabase
        .from("message_queue")
        .select("*, connected_accounts(access_token, platform_user_id, page_id, platform)")
        .in("status", ["ready", "queued"])
        .lte("scheduled_send_at", new Date().toISOString())
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(10);
    if (error || !messages?.length)
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
    if (messageType === "comment_reply") {
        const res = await fetch(`https://graph.facebook.com/v21.0/${recipientId}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: payload.text,
                access_token: token,
            }),
        });
        const data = await res.json();
        if (data.error)
            return { error: `Meta comment reply: ${data.error.message}` };
        return { messageId: data.id };
    }
    // ── 2. Private Reply (DM to commenter via comment_id) ─────────────────────
    // This is the CORRECT way to DM a commenter. It works in testing mode without
    // App Review as long as the account is an App Admin/Tester/Developer.
    // Endpoint: POST /{page-id}/messages with recipient: { comment_id: <comment_id> }
    // Ref: https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies
    if (messageType === "private_reply") {
        const privateReplyBody = {
            recipient: { comment_id: recipientId }, // recipientId IS the comment_id here
            message: {},
        };
        // Meta Private Replies to comments ONLY support plain text, no templates!
        if (payload.link) {
            // Append the link to the text since we can't use buttons
            privateReplyBody.message.text = `${payload.text}\n\n${payload.link}`;
        }
        else {
            privateReplyBody.message.text = payload.text;
        }
        // Private Reply uses the Page ID as the sender endpoint (NOT the IG User ID)
        // Ref: https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies
        // Endpoint: POST /{page-id}/messages with recipient: { comment_id }
        const senderId = input.pageId || igUserId; // prefer page_id, fall back to igUserId
        console.log(`[SendQueue] Private Reply → comment=${recipientId} sender=${senderId} (page=${input.pageId}, igUser=${igUserId})`);
        const res = await fetch(`https://graph.facebook.com/v21.0/${senderId}/messages?access_token=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(privateReplyBody),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
            const errMsg = data.error?.message || `HTTP ${res.status}`;
            console.error(`[SendQueue] ❌ Private Reply API error: ${errMsg}`, JSON.stringify(data));
            return { error: `Meta Private Reply API: ${errMsg}` };
        }
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
        // Template with button (for Instagram, use generic template)
        dmBody.message.attachment = {
            type: "template",
            payload: {
                template_type: "generic",
                elements: [{
                        title: payload.text.substring(0, 80),
                        default_action: { type: "web_url", url: payload.link },
                        buttons: [{ type: "web_url", url: payload.link, title: "Open Link →" }],
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
    const endpoint = `https://graph.facebook.com/v21.0/me/messages`;
    console.log(`[SendQueue] Sending DM to ${recipientId} via ${platform} (igUserId=${igUserId})`);
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