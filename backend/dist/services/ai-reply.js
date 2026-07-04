"use strict";
/**
 * ai-reply.ts — AI Auto-Reply with Confidence Scoring
 *
 * Wraps the existing LLM service with:
 * 1. Confidence scoring via structured output
 * 2. Human escalation for low-confidence replies (<70%)
 * 3. Draft attachment for manual review
 *
 * PRD §4.5: Every AI response carries a confidence score.
 * <70% confidence routes to human queue with the AI's draft attached.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAIReply = generateAIReply;
exports.approveReviewedMessage = approveReviewedMessage;
exports.discardReviewedMessage = discardReviewedMessage;
exports.getPendingReviews = getPendingReviews;
const llm_1 = require("./llm");
const supabase_1 = require("../lib/supabase");
// ─── Configuration ───────────────────────────────────────────────────────────
const CONFIDENCE_THRESHOLD = 70; // Below this → escalate to human
const MAX_CONVERSATION_CONTEXT = 10; // Max messages to include as context
// ─── System prompt template ──────────────────────────────────────────────────
function buildSystemPrompt(input) {
    const style = input.replyStyle || "friendly";
    const lang = input.language || "en";
    return `You are an AI assistant replying to Instagram DMs on behalf of a business.

CRITICAL RULES:
1. You MUST reply in valid JSON format with exactly these fields:
   { "reply": "your reply text", "confidence": 85, "reasoning": "brief explanation" }
2. confidence is a number from 0 to 100 representing how confident you are in this reply.
3. Set confidence HIGH (80-100) when: the question is clear, you have enough context, the reply is helpful.
4. Set confidence LOW (0-69) when: the question is ambiguous, requires specific business knowledge you don't have, involves pricing/availability/scheduling, or could be misinterpreted.
5. NEVER make up product details, prices, or availability. If unsure, set low confidence.
6. Keep replies concise (1-3 sentences max for DMs).
7. Match the tone: ${style}.
8. Language: ${lang === "hi" ? "Hindi" : lang === "hinglish" ? "Hinglish (Hindi + English mix)" : "English"}.
9. Include emojis naturally if the tone is friendly/casual.
10. NEVER include passwords, login credentials, or ask for sensitive personal information.

${input.businessContext ? `BUSINESS CONTEXT:\n${input.businessContext}` : ""}

Reply ONLY with the JSON object. No markdown, no code blocks, no extra text.`;
}
// ─── Build user prompt with conversation context ─────────────────────────────
function buildUserPrompt(input) {
    const parts = [];
    // Include conversation history if available
    if (input.conversationHistory?.length) {
        const recent = input.conversationHistory.slice(-MAX_CONVERSATION_CONTEXT);
        parts.push("CONVERSATION HISTORY:");
        for (const msg of recent) {
            const role = msg.role === "user" ? "Customer" : "Business";
            parts.push(`${role}: ${msg.text}`);
        }
        parts.push("");
    }
    parts.push(`NEW MESSAGE FROM CUSTOMER: ${input.incomingMessage}`);
    parts.push("");
    parts.push("Generate a reply as JSON: { \"reply\": \"...\", \"confidence\": N, \"reasoning\": \"...\" }");
    return parts.join("\n");
}
// ─── Main entry point ────────────────────────────────────────────────────────
async function generateAIReply(input) {
    const systemPrompt = buildSystemPrompt(input);
    const userPrompt = buildUserPrompt(input);
    // Call the existing LLM service
    const llmRequest = {
        userId: input.userId,
        endpoint: "ai_reply",
        prompt: userPrompt,
        systemPrompt,
    };
    const llmResponse = await (0, llm_1.callLLM)(llmRequest);
    // Parse the structured response
    let replyText;
    let confidence;
    let reasoning = "";
    try {
        // Try to parse as JSON
        const cleaned = llmResponse.text
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .trim();
        const parsed = JSON.parse(cleaned);
        replyText = parsed.reply || parsed.text || parsed.message || llmResponse.text;
        confidence = typeof parsed.confidence === "number"
            ? Math.max(0, Math.min(100, parsed.confidence))
            : estimateConfidence(replyText);
        reasoning = parsed.reasoning || "";
    }
    catch {
        // If JSON parsing fails, use the raw text and estimate confidence
        replyText = llmResponse.text.trim();
        confidence = estimateConfidence(replyText);
        reasoning = "Failed to parse structured response — using heuristic confidence";
    }
    const autoSend = confidence >= CONFIDENCE_THRESHOLD;
    // If low confidence, escalate to human review queue
    if (!autoSend) {
        const escalationReason = reasoning || `Confidence ${confidence}% is below ${CONFIDENCE_THRESHOLD}% threshold`;
        const { data: reviewEntry } = await supabase_1.supabase.from("human_review_queue").insert({
            account_id: input.accountId,
            user_id: input.userId,
            conversation_id: input.conversationId || null,
            recipient_id: input.recipientId,
            ai_draft_text: replyText,
            ai_confidence: confidence,
            ai_provider: llmResponse.provider,
            ai_model: llmResponse.model,
            escalation_reason: escalationReason,
            status: "pending",
        }).select("id").single();
        console.log(`[AIReply] Escalated to human review: confidence=${confidence}%, reason="${escalationReason.substring(0, 60)}"`);
        return {
            text: replyText,
            confidence,
            autoSend: false,
            escalated: true,
            escalationReason,
            reviewQueueId: reviewEntry?.id,
            provider: llmResponse.provider,
            model: llmResponse.model,
        };
    }
    console.log(`[AIReply] Auto-send approved: confidence=${confidence}%, provider=${llmResponse.provider}`);
    return {
        text: replyText,
        confidence,
        autoSend: true,
        escalated: false,
        provider: llmResponse.provider,
        model: llmResponse.model,
    };
}
// ─── Heuristic confidence estimation ─────────────────────────────────────────
// Used when the LLM doesn't return structured confidence.
function estimateConfidence(replyText) {
    let confidence = 70; // Start at threshold
    // Reduce confidence for uncertainty markers
    const uncertaintyMarkers = [
        /i'?m not sure/i, /i don'?t know/i, /i'?m not certain/i,
        /maybe/i, /perhaps/i, /could be/i, /might be/i,
        /i think/i, /it seems/i, /possibly/i,
        /you'?d need to/i, /please contact/i, /check with/i,
        /mujhe nahi pata/i, /shayad/i, /ho sakta hai/i,
    ];
    for (const marker of uncertaintyMarkers) {
        if (marker.test(replyText)) {
            confidence -= 15;
        }
    }
    // Reduce for very short replies (likely unhelpful)
    if (replyText.length < 20)
        confidence -= 20;
    // Reduce for very long replies (might be hallucinating)
    if (replyText.length > 500)
        confidence -= 10;
    // Increase for replies with greeting (shows awareness)
    if (/^(hi|hello|hey|namaste|namaskar)/i.test(replyText))
        confidence += 5;
    // Clamp to 0-100
    return Math.max(0, Math.min(100, confidence));
}
// ─── Process human review decisions ──────────────────────────────────────────
async function approveReviewedMessage(reviewId, agentId, editedText) {
    const { data: review } = await supabase_1.supabase
        .from("human_review_queue")
        .select("*")
        .eq("id", reviewId)
        .eq("status", "pending")
        .single();
    if (!review) {
        return { success: false, error: "Review item not found or already processed" };
    }
    const finalText = editedText || review.ai_draft_text;
    const newStatus = editedText ? "edited" : "approved";
    // Update review status
    await supabase_1.supabase.from("human_review_queue").update({
        status: newStatus,
        agent_id: agentId,
        agent_edit: editedText || null,
        reviewed_at: new Date().toISOString(),
    }).eq("id", reviewId);
    // The caller should enqueue the message via send-queue after approval
    return { success: true };
}
async function discardReviewedMessage(reviewId, agentId) {
    await supabase_1.supabase.from("human_review_queue").update({
        status: "discarded",
        agent_id: agentId,
        reviewed_at: new Date().toISOString(),
    }).eq("id", reviewId);
    return { success: true };
}
// ─── Get pending review items ────────────────────────────────────────────────
async function getPendingReviews(userId, limit = 20) {
    const { data } = await supabase_1.supabase
        .from("human_review_queue")
        .select("id, recipient_id, ai_draft_text, ai_confidence, escalation_reason, created_at")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(limit);
    return (data || []).map(r => ({
        id: r.id,
        recipientId: r.recipient_id,
        draftText: r.ai_draft_text,
        confidence: r.ai_confidence,
        reason: r.escalation_reason,
        createdAt: r.created_at,
    }));
}
//# sourceMappingURL=ai-reply.js.map