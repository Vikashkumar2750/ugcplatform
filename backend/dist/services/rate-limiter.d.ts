/**
 * rate-limiter.ts — Per-Account Outbound Message Rate Limiter
 *
 * Enforces configurable rate limits on automated messages:
 * - Per-user message spacing: 1 msg / 5s minimum
 * - Safe account throughput: 120 DMs/hour (default)
 * - Aggressive tier: 200 DMs/hour (flagged for review)
 * - Typing simulation delay: varies by message length
 *
 * Implementation: In-memory sliding window + Postgres persistence.
 * Memory state resyncs from DB on startup and periodically.
 */
export interface RateLimitConfig {
    /** Minimum ms between messages to the SAME recipient. Default: 5000 */
    perUserSpacingMs: number;
    /** Max automated messages per hour for this account. Default: 120 */
    hourlyLimit: number;
    /** Max daily automated messages. Default: 2000 */
    dailyLimit: number;
    /** If true, this account is in aggressive mode (flagged for review). */
    aggressive: boolean;
}
export interface RateLimitResult {
    allowed: boolean;
    retryAfterMs?: number;
    reason?: "per_user_spacing" | "hourly_exceeded" | "daily_exceeded";
    currentHourlyCount?: number;
    hourlyLimit?: number;
}
export declare function checkRateLimit(accountId: string, recipientId: string): Promise<RateLimitResult>;
export declare function recordSend(accountId: string, recipientId: string): Promise<void>;
export declare function getTypingDelay(messageText: string): number;
export declare function updateRateLimitConfig(accountId: string, config: Partial<RateLimitConfig>): Promise<void>;
export declare function cleanupExpiredRateLimits(): Promise<number>;
export declare function getRateLimitStatus(accountId: string): Promise<{
    hourlyCount: number;
    hourlyLimit: number;
    dailyCount: number;
    dailyLimit: number;
    lastSendAt: string | null;
    config: RateLimitConfig;
}>;
