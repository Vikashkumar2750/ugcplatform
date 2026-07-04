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
export interface EnqueueInput {
    accountId: string;
    userId: string;
    recipientId: string;
    messagePayload: MessagePayload;
    messageType: "dm" | "comment_reply" | "private_reply" | "broadcast";
    automationRuleId?: string;
    messageTag?: string;
    priority?: number;
    scheduledSendAt?: string;
}
export interface MessagePayload {
    text: string;
    link?: string;
    attachment?: {
        type: string;
        payload: Record<string, unknown>;
    };
    quick_replies?: Array<{
        content_type: string;
        title: string;
        payload: string;
    }>;
}
export interface EnqueueResult {
    queued: boolean;
    queueId?: string;
    blocked?: boolean;
    blockReason?: string;
    rateLimited?: boolean;
    retryAfterMs?: number;
}
export declare function enqueueMessage(input: EnqueueInput): Promise<EnqueueResult>;
export declare function processMessageQueue(): Promise<number>;
export declare function recoverStaleMessages(): Promise<number>;
export declare function getQueueStats(accountId?: string): Promise<{
    queued: number;
    processing: number;
    sent_today: number;
    failed_today: number;
    blocked_today: number;
}>;
