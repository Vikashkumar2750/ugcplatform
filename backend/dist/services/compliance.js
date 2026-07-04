"use strict";
/**
 * compliance.ts — Core Compliance Engine
 *
 * Every outbound automated message MUST pass through checkCompliance()
 * before it can be enqueued for sending. No code path bypasses this.
 *
 * Checks enforced:
 * 1. 24h messaging window (Meta policy)
 * 2. Opt-out / unsubscribe
 * 3. Account active status
 * 4. Content validation (no forbidden patterns)
 * 5. Message tag validation (if outside 24h window)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCompliance = checkCompliance;
exports.trackUserInteraction = trackUserInteraction;
exports.isWithinMessagingWindow = isWithinMessagingWindow;
const supabase_1 = require("../lib/supabase");
// ─── Meta-approved message tags (as of 2025) ─────────────────────────────────
// These allow sending outside the 24h window for specific use cases.
// See: https://developers.facebook.com/docs/messenger-platform/policy/policy-overview/
const APPROVED_MESSAGE_TAGS = new Set([
    "CONFIRMED_EVENT_UPDATE",
    "POST_PURCHASE_UPDATE",
    "ACCOUNT_UPDATE",
    "HUMAN_AGENT", // allowed within 7 days for human agents
]);
// ─── Forbidden content patterns ──────────────────────────────────────────────
// Messages matching these are always blocked regardless of other checks.
const FORBIDDEN_PATTERNS = [
    // Password/credential harvesting
    /(?:send|share|give|tell)\s*(?:me|us)\s*(?:your|ur)\s*(?:password|passwd|login|credentials)/i,
    // Phishing URLs
    /(?:bit\.ly|tinyurl|goo\.gl)\//i,
    // Mass spam indicators
    /(?:earn|make)\s*\$?\d+k?\s*(?:per|a|each)\s*(?:day|week|month)/i,
];
// ─── 24h Messaging Window ────────────────────────────────────────────────────
const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const HUMAN_AGENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for HUMAN_AGENT tag
// ─── Main compliance check ───────────────────────────────────────────────────
async function checkCompliance(input) {
    const { accountId, recipientId, messageText, messageType, messageTag } = input;
    // ── 1. Account active check ──────────────────────────────────────────────
    const { data: account } = await supabase_1.supabase
        .from("connected_accounts")
        .select("is_active, platform")
        .eq("id", accountId)
        .maybeSingle();
    if (!account || !account.is_active) {
        const result = {
            allowed: false,
            reasonCode: "account_inactive",
            reasonDetail: "Connected account is inactive or not found",
        };
        await logComplianceDecision(input, result);
        return result;
    }
    // ── 2. Opt-out check ─────────────────────────────────────────────────────
    const { data: conversation } = await supabase_1.supabase
        .from("dm_conversations")
        .select("opted_out, last_user_interaction_at, last_message_at")
        .eq("account_id", accountId)
        .eq("sender_id", recipientId)
        .maybeSingle();
    if (conversation?.opted_out) {
        const result = {
            allowed: false,
            reasonCode: "opted_out",
            reasonDetail: "Recipient has opted out of automated messages",
        };
        await logComplianceDecision(input, result);
        return result;
    }
    // ── 3. 24h messaging window (DMs only — comment/private replies are exempt) ─
    // private_reply: user just commented so they initiated contact — always allowed
    // comment_reply: public reply, not a DM — always allowed
    if (messageType === "dm" || messageType === "broadcast") {
        const lastInteraction = conversation?.last_user_interaction_at || conversation?.last_message_at;
        if (lastInteraction) {
            const lastInteractionTime = new Date(lastInteraction).getTime();
            const now = Date.now();
            const standardExpiry = lastInteractionTime + MESSAGING_WINDOW_MS;
            if (now > standardExpiry) {
                // Outside the standard 24h window
                if (!messageTag || !APPROVED_MESSAGE_TAGS.has(messageTag)) {
                    // No approved tag — block
                    const result = {
                        allowed: false,
                        reasonCode: "outside_messaging_window",
                        reasonDetail: `Last user interaction was ${Math.round((now - lastInteractionTime) / 3600000)}h ago. ` +
                            `24h messaging window expired at ${new Date(standardExpiry).toISOString()}. ` +
                            `No approved message tag provided.`,
                        windowExpiresAt: new Date(standardExpiry).toISOString(),
                    };
                    await logComplianceDecision(input, result);
                    return result;
                }
                // Has approved tag — check tag-specific extended window
                if (messageTag === "HUMAN_AGENT") {
                    const humanAgentExpiry = lastInteractionTime + HUMAN_AGENT_WINDOW_MS;
                    if (now > humanAgentExpiry) {
                        const result = {
                            allowed: false,
                            reasonCode: "outside_messaging_window",
                            reasonDetail: `HUMAN_AGENT 7-day window expired. Last interaction was ${Math.round((now - lastInteractionTime) / 3600000)}h ago.`,
                            windowExpiresAt: new Date(humanAgentExpiry).toISOString(),
                        };
                        await logComplianceDecision(input, result);
                        return result;
                    }
                }
                // Other approved tags (POST_PURCHASE_UPDATE, etc.) allow one-time notification sends
            }
        }
        else {
            // No prior conversation exists.
            // For DMs: first outbound message is allowed (e.g., new follower welcome).
            // For broadcasts: block if no prior interaction.
            if (messageType === "broadcast") {
                const result = {
                    allowed: false,
                    reasonCode: "outside_messaging_window",
                    reasonDetail: "Cannot send broadcast to user with no prior interaction",
                };
                await logComplianceDecision(input, result);
                return result;
            }
        }
    }
    // ── 4. Message tag validation ────────────────────────────────────────────
    if (messageTag && !APPROVED_MESSAGE_TAGS.has(messageTag)) {
        const result = {
            allowed: false,
            reasonCode: "invalid_message_tag",
            reasonDetail: `Message tag '${messageTag}' is not a Meta-approved tag`,
        };
        await logComplianceDecision(input, result);
        return result;
    }
    // ── 5. Content validation ────────────────────────────────────────────────
    for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(messageText)) {
            const result = {
                allowed: false,
                reasonCode: "blocked_content",
                reasonDetail: `Message matches forbidden content pattern: ${pattern.source.substring(0, 60)}`,
            };
            await logComplianceDecision(input, result);
            return result;
        }
    }
    // ── All checks passed ────────────────────────────────────────────────────
    const result = { allowed: true };
    await logComplianceDecision(input, result);
    return result;
}
// ─── Compliance logging ──────────────────────────────────────────────────────
async function logComplianceDecision(input, result) {
    try {
        await supabase_1.supabase.from("compliance_logs").insert({
            account_id: input.accountId,
            user_id: input.userId,
            recipient_id: input.recipientId,
            direction: "outbound",
            decision: result.allowed ? "allowed" : "blocked",
            reason_code: result.reasonCode || null,
            reason_detail: result.reasonDetail || null,
            message_preview: input.messageText.substring(0, 50),
            queue_id: input.queueId || null,
            rule_id: input.ruleId || null,
            meta_data: result.windowExpiresAt ? { window_expires_at: result.windowExpiresAt } : {},
        });
    }
    catch (err) {
        // Compliance logging is important but should never block sends
        console.error("[Compliance] Failed to log decision:", err.message);
    }
}
// ─── Helper: Update last user interaction timestamp ──────────────────────────
// Called from webhook handler on every incoming user message.
async function trackUserInteraction(accountId, userId, senderId) {
    const now = new Date().toISOString();
    // Upsert: update if exists, insert if not
    const { data: existing } = await supabase_1.supabase
        .from("dm_conversations")
        .select("id")
        .eq("account_id", accountId)
        .eq("sender_id", senderId)
        .maybeSingle();
    if (existing) {
        await supabase_1.supabase
            .from("dm_conversations")
            .update({ last_user_interaction_at: now })
            .eq("account_id", accountId)
            .eq("sender_id", senderId);
    }
    else {
        await supabase_1.supabase.from("dm_conversations").insert({
            account_id: accountId,
            user_id: userId,
            sender_id: senderId,
            last_user_interaction_at: now,
            last_message_at: now,
            message_count: 1,
        });
    }
}
// ─── Helper: Check if conversation is within 24h window ──────────────────────
// Quick check without full compliance (useful for UI indicators)
async function isWithinMessagingWindow(accountId, recipientId) {
    const { data } = await supabase_1.supabase
        .from("dm_conversations")
        .select("last_user_interaction_at")
        .eq("account_id", accountId)
        .eq("sender_id", recipientId)
        .maybeSingle();
    if (!data?.last_user_interaction_at) {
        return { inWindow: false };
    }
    const expiry = new Date(data.last_user_interaction_at).getTime() + MESSAGING_WINDOW_MS;
    const inWindow = Date.now() < expiry;
    return {
        inWindow,
        expiresAt: new Date(expiry).toISOString(),
    };
}
//# sourceMappingURL=compliance.js.map