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
export interface ComplianceCheckInput {
    accountId: string;
    userId: string;
    recipientId: string;
    messageText: string;
    messageType: "dm" | "comment_reply" | "private_reply" | "broadcast";
    messageTag?: string;
    ruleId?: string;
    queueId?: string;
}
export interface ComplianceResult {
    allowed: boolean;
    reasonCode?: ComplianceReasonCode;
    reasonDetail?: string;
    windowExpiresAt?: string;
}
export type ComplianceReasonCode = "outside_messaging_window" | "opted_out" | "account_inactive" | "blocked_content" | "invalid_message_tag" | "recipient_blocked" | "rate_exceeded";
export declare function checkCompliance(input: ComplianceCheckInput): Promise<ComplianceResult>;
export declare function trackUserInteraction(accountId: string, userId: string, senderId: string): Promise<void>;
export declare function isWithinMessagingWindow(accountId: string, recipientId: string): Promise<{
    inWindow: boolean;
    expiresAt?: string;
}>;
