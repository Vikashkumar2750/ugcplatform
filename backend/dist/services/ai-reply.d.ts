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
export interface AIReplyInput {
    userId: string;
    accountId: string;
    recipientId: string;
    conversationId?: string;
    incomingMessage: string;
    conversationHistory?: Array<{
        role: "user" | "assistant";
        text: string;
        timestamp?: string;
    }>;
    businessContext?: string;
    replyStyle?: string;
    language?: string;
    maxTokens?: number;
}
export interface AIReplyResult {
    text: string;
    confidence: number;
    autoSend: boolean;
    escalated: boolean;
    escalationReason?: string;
    reviewQueueId?: string;
    provider: string;
    model: string;
}
export declare function generateAIReply(input: AIReplyInput): Promise<AIReplyResult>;
export declare function approveReviewedMessage(reviewId: string, agentId: string, editedText?: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function discardReviewedMessage(reviewId: string, agentId: string): Promise<{
    success: boolean;
}>;
export declare function getPendingReviews(userId: string, limit?: number): Promise<Array<{
    id: string;
    recipientId: string;
    draftText: string;
    confidence: number;
    reason: string;
    createdAt: string;
}>>;
