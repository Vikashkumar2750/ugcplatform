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

import { supabase } from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  retryAfterMs?: number;      // ms to wait before retrying
  reason?: "per_user_spacing" | "hourly_exceeded" | "daily_exceeded";
  currentHourlyCount?: number;
  hourlyLimit?: number;
}

// ─── Default configuration ───────────────────────────────────────────────────

const DEFAULT_CONFIG: RateLimitConfig = {
  perUserSpacingMs: 5000,     // 1 message per 5 seconds per recipient
  hourlyLimit: 120,           // Safe tier
  dailyLimit: 2000,           // Safety cap
  aggressive: false,
};

const AGGRESSIVE_HOURLY_LIMIT = 200; // Requires explicit opt-in + warning

// ─── In-memory state (per account) ───────────────────────────────────────────
// Resyncs from DB periodically to survive serverless cold starts.

interface AccountRateState {
  hourlyCount: number;
  hourlyWindowStart: number;    // timestamp ms
  dailyCount: number;
  dailyWindowStart: number;     // timestamp ms
  lastSendAt: number;           // timestamp ms
  lastSendByRecipient: Map<string, number>;  // recipientId → timestamp ms
  config: RateLimitConfig;
}

const accountStates = new Map<string, AccountRateState>();

// ─── Get or initialize account state ─────────────────────────────────────────

async function getAccountState(accountId: string): Promise<AccountRateState> {
  // Return cached state if fresh
  const cached = accountStates.get(accountId);
  if (cached) {
    // Reset hourly window if expired
    const now = Date.now();
    if (now - cached.hourlyWindowStart >= 3600_000) {
      cached.hourlyCount = 0;
      cached.hourlyWindowStart = now;
    }
    // Reset daily window if expired
    if (now - cached.dailyWindowStart >= 86400_000) {
      cached.dailyCount = 0;
      cached.dailyWindowStart = now;
    }
    return cached;
  }

  // Load from DB
  const { data } = await supabase
    .from("rate_limit_state")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();

  const now = Date.now();
  let state: AccountRateState;

  if (data) {
    const hourlyStart = new Date(data.hourly_window_start).getTime();
    const dailyStart = new Date(data.daily_window_start).getTime();
    const configOverride = (data.config_override || {}) as Partial<RateLimitConfig>;

    state = {
      hourlyCount: (now - hourlyStart < 3600_000) ? (data.hourly_count || 0) : 0,
      hourlyWindowStart: (now - hourlyStart < 3600_000) ? hourlyStart : now,
      dailyCount: (now - dailyStart < 86400_000) ? (data.daily_count || 0) : 0,
      dailyWindowStart: (now - dailyStart < 86400_000) ? dailyStart : now,
      lastSendAt: data.last_send_at ? new Date(data.last_send_at).getTime() : 0,
      lastSendByRecipient: new Map(),
      config: { ...DEFAULT_CONFIG, ...configOverride },
    };
  } else {
    state = {
      hourlyCount: 0,
      hourlyWindowStart: now,
      dailyCount: 0,
      dailyWindowStart: now,
      lastSendAt: 0,
      lastSendByRecipient: new Map(),
      config: { ...DEFAULT_CONFIG },
    };
  }

  // Apply aggressive override
  if (state.config.aggressive) {
    state.config.hourlyLimit = Math.min(state.config.hourlyLimit, AGGRESSIVE_HOURLY_LIMIT);
  }

  accountStates.set(accountId, state);
  return state;
}

// ─── Check rate limit ────────────────────────────────────────────────────────

export async function checkRateLimit(
  accountId: string,
  recipientId: string
): Promise<RateLimitResult> {
  const state = await getAccountState(accountId);
  const now = Date.now();

  // ── Check per-user spacing ───────────────────────────────────────────────
  const lastSendToRecipient = state.lastSendByRecipient.get(recipientId) || 0;
  const timeSinceLastToRecipient = now - lastSendToRecipient;

  if (timeSinceLastToRecipient < state.config.perUserSpacingMs) {
    return {
      allowed: false,
      reason: "per_user_spacing",
      retryAfterMs: state.config.perUserSpacingMs - timeSinceLastToRecipient,
      currentHourlyCount: state.hourlyCount,
      hourlyLimit: state.config.hourlyLimit,
    };
  }

  // ── Check hourly limit ───────────────────────────────────────────────────
  if (state.hourlyCount >= state.config.hourlyLimit) {
    const windowReset = state.hourlyWindowStart + 3600_000;
    return {
      allowed: false,
      reason: "hourly_exceeded",
      retryAfterMs: windowReset - now,
      currentHourlyCount: state.hourlyCount,
      hourlyLimit: state.config.hourlyLimit,
    };
  }

  // ── Check daily limit ────────────────────────────────────────────────────
  if (state.dailyCount >= state.config.dailyLimit) {
    const windowReset = state.dailyWindowStart + 86400_000;
    return {
      allowed: false,
      reason: "daily_exceeded",
      retryAfterMs: windowReset - now,
      currentHourlyCount: state.hourlyCount,
      hourlyLimit: state.config.hourlyLimit,
    };
  }

  return { allowed: true, currentHourlyCount: state.hourlyCount, hourlyLimit: state.config.hourlyLimit };
}

// ─── Record a successful send ────────────────────────────────────────────────
// Called AFTER a message is successfully sent via Meta API.

export async function recordSend(accountId: string, recipientId: string): Promise<void> {
  const state = await getAccountState(accountId);
  const now = Date.now();

  state.hourlyCount++;
  state.dailyCount++;
  state.lastSendAt = now;
  state.lastSendByRecipient.set(recipientId, now);

  // Prune old per-recipient entries (keep last 1000)
  if (state.lastSendByRecipient.size > 1000) {
    const entries = [...state.lastSendByRecipient.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 500);
    state.lastSendByRecipient = new Map(entries);
  }

  // Persist to DB (non-blocking, non-fatal)
  persistState(accountId, state).catch(err => {
    console.warn("[RateLimiter] Failed to persist state:", err.message);
  });
}

// ─── Persist state to DB ─────────────────────────────────────────────────────

async function persistState(accountId: string, state: AccountRateState): Promise<void> {
  await supabase.from("rate_limit_state").upsert({
    account_id: accountId,
    hourly_count: state.hourlyCount,
    hourly_window_start: new Date(state.hourlyWindowStart).toISOString(),
    daily_count: state.dailyCount,
    daily_window_start: new Date(state.dailyWindowStart).toISOString(),
    last_send_at: state.lastSendAt ? new Date(state.lastSendAt).toISOString() : null,
    config_override: state.config,
  }, { onConflict: "account_id" });
}

// ─── Calculate typing simulation delay ───────────────────────────────────────
// Makes messages feel more natural and avoids detection.

export function getTypingDelay(messageText: string): number {
  const len = messageText.length;
  if (len < 150) return 1000;      // 1s for short messages
  if (len < 300) return 2000;      // 2s for medium messages
  if (len < 500) return 3000;      // 3s for longer messages
  return Math.min(5000, 3000 + Math.floor((len - 500) / 100) * 500); // Max 5s
}

// ─── Update account rate limit config ────────────────────────────────────────
// Called from admin/settings UI.

export async function updateRateLimitConfig(
  accountId: string,
  config: Partial<RateLimitConfig>
): Promise<void> {
  // Enforce hard maximums
  if (config.hourlyLimit && config.hourlyLimit > AGGRESSIVE_HOURLY_LIMIT) {
    config.hourlyLimit = AGGRESSIVE_HOURLY_LIMIT;
    config.aggressive = true;
  }

  const state = await getAccountState(accountId);
  state.config = { ...state.config, ...config };

  await persistState(accountId, state);
}

// ─── Cleanup: reset expired windows ─────────────────────────────────────────
// Called from periodic cron to clean up stale rate limit entries.

export async function cleanupExpiredRateLimits(): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  const { data, error } = await supabase
    .from("rate_limit_state")
    .update({ hourly_count: 0, hourly_window_start: new Date().toISOString() })
    .lt("hourly_window_start", oneHourAgo)
    .select("account_id");

  if (error) {
    console.warn("[RateLimiter] Cleanup error:", error.message);
    return 0;
  }

  // Also clear in-memory state for reset accounts
  for (const row of data || []) {
    const cached = accountStates.get(row.account_id);
    if (cached) {
      cached.hourlyCount = 0;
      cached.hourlyWindowStart = Date.now();
    }
  }

  return data?.length || 0;
}

// ─── Get current rate limit status (for UI display) ──────────────────────────

export async function getRateLimitStatus(accountId: string): Promise<{
  hourlyCount: number;
  hourlyLimit: number;
  dailyCount: number;
  dailyLimit: number;
  lastSendAt: string | null;
  config: RateLimitConfig;
}> {
  const state = await getAccountState(accountId);
  return {
    hourlyCount: state.hourlyCount,
    hourlyLimit: state.config.hourlyLimit,
    dailyCount: state.dailyCount,
    dailyLimit: state.config.dailyLimit,
    lastSendAt: state.lastSendAt ? new Date(state.lastSendAt).toISOString() : null,
    config: state.config,
  };
}
