import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { randomGaussianDelayMs, parseSpintax } from "@/lib/anti-bot";
import { isNightTime, getSleepCycleDelayMs, checkDailyLimit } from "@/lib/compliance";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN!;
const META_APP_SECRET = process.env.META_APP_SECRET!;
const BACKEND_URL = process.env.RENDER_WORKER_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.RENDER_WORKER_SECRET || process.env.WORKER_SECRET || "";

// Ã¢â€â‚¬Ã¢â€â‚¬ Gate token for follow-gate landing page Ã¢â€â‚¬Ã¢â€â‚¬
function createGateToken(data: { ruleId: string; username: string; link: string; message?: string; buttonLabel?: string }): string {
  const payload = JSON.stringify({ ...data, ts: Date.now() });
  const sig = crypto.createHmac("sha256", META_APP_SECRET).update(payload).digest("hex").substring(0, 12);
  return Buffer.from(`${sig}:${payload}`).toString("base64url");
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Decrypt access tokens (same algorithm as backend/src/services/crypto.ts) Ã¢â€â‚¬Ã¢â€â‚¬
function decryptToken(data: string): string {
  try {
    const secret = process.env.API_KEY_SECRET;
    if (!secret) return data; // No secret Ã¢â‚¬â€ token is plain text
    const parts = data.split(":");
    if (parts.length !== 3) return data; // Not encrypted format Ã¢â‚¬â€ use as-is
    const [ivHex, tagHex, encryptedHex] = parts;
    const key = crypto.scryptSync(secret, "contentiq_salt_v1", 32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(encryptedHex, "hex")).toString("utf8") + decipher.final("utf8");
  } catch {
    return data; // Decryption failed Ã¢â‚¬â€ token might be plain text (pre-migration)
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Keyword matching Ã¢â‚¬â€ use WORD BOUNDARY regex, not substring includes().
// This prevents "test5" keyword matching "test55" comment ("test55".includes("test5") === true).
// \btest5\b correctly rejects "test55" since "55" has no word boundary between the two digits.
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function keywordMatch(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}



function scheduledSendAt(delayMs: number): string {
  return new Date(Date.now() + delayMs).toISOString();
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Correlation ID Ã¢â‚¬â€ ties all steps of one automation execution
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function newCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Derive platform from Meta webhook object field
// Meta sends: object="instagram" for IG, object="page" for FB
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function derivePlatform(metaObject: string): "instagram" | "facebook" {
  if (metaObject === "instagram") return "instagram";
  if (metaObject === "page") return "facebook";
  // Default to instagram for backward compat with older event types
  return "instagram";
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Webhook event deduplication
// NOTE: In-memory dedup does NOT work in Vercel serverless (new instance per request).
// Real dedup is handled by processed_comments table unique constraint.
// We keep a lightweight per-invocation set only to prevent double-processing
// within a single webhook payload that contains duplicate entries.
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const processedEntriesThisRequest = new Set<string>();

function getEventFingerprint(entry: any): string {
  const id = entry.id || "";
  const time = entry.time || "";
  return crypto.createHash("md5").update(`${id}:${time}`).digest("hex");
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// GET Ã¢â‚¬â€ Meta webhook verification
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Webhook] Meta verified Ã¢Å“â€œ");
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// POST Ã¢â‚¬â€ Receive Meta webhook events
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export async function POST(request: NextRequest) {
  const supabase = getServiceClient();

  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256") || "";

    // Ã¢â€â‚¬Ã¢â€â‚¬ Log EVERY raw webhook to DB FIRST (even before signature check) Ã¢â€â‚¬Ã¢â€â‚¬
    // This is critical for debugging Ã¢â‚¬â€ we need to know if Meta is sending events at all
    let parsedBody: any = null;
    try {
      parsedBody = JSON.parse(rawBody);
      await supabase.from("webhook_raw_log").insert({
        object_type: parsedBody?.object || "unknown",
        raw_body: parsedBody,
        received_at: new Date().toISOString(),
      });
    } catch {
      // JSON parse or DB insert failed Ã¢â‚¬â€ continue anyway
    }

    if (!verifySignature(rawBody, signature)) {
      console.warn("[Webhook] Signature mismatch Ã¢â‚¬â€ rejecting");
      console.warn("[Webhook] Received signature:", signature?.substring(0, 20) + "...");
      // Calculate expected for debugging
      const expected = process.env.META_APP_SECRET 
        ? "sha256=" + crypto.createHmac("sha256", process.env.META_APP_SECRET).update(Buffer.from(rawBody, "utf-8")).digest("hex")
        : "no_secret";

      // Log the rejection to DB so we can see it in debug endpoint
      try {
        await supabase.from("webhook_raw_log").insert({
          object_type: "SIGNATURE_REJECTED",
          raw_body: { error: "signature_mismatch", signature_prefix: signature?.substring(0, 30), expected: expected.substring(0, 30), body_length: rawBody.length },
          received_at: new Date().toISOString(),
        });
      } catch {}
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = parsedBody || JSON.parse(rawBody);

    // Raw payload log
    try {
      await supabase.from("webhook_events").insert({
        platform: "meta_raw",
        event_type: "raw",
        payload: body,
        processed: true
      });
    } catch(e){}

    console.log("[Webhook] Received:", JSON.stringify(body).substring(0, 800));
    console.log("[Webhook] Object:", body.object, "| Entries:", body.entry?.length);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Derive platform from Meta object field Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // object="instagram" Ã¢â€ â€™ Instagram Graph API events
    // object="page"      Ã¢â€ â€™ Facebook Page events (comments, Messenger)
    const platform = derivePlatform(body.object || "");
    console.log(`[Webhook] Platform derived: ${platform} (object=${body.object})`);

    for (const entry of (body.entry || [])) {
      // Ã¢â€â‚¬Ã¢â€â‚¬ Deduplication: skip if we've already processed this entry in THIS request Ã¢â€â‚¬Ã¢â€â‚¬
      const fingerprint = getEventFingerprint(entry);
      if (processedEntriesThisRequest.has(fingerprint)) {
        console.log(`[Webhook] Skipping duplicate entry within same request: ${fingerprint}`);
        continue;
      }
      processedEntriesThisRequest.add(fingerprint);

      const pageId: string = entry.id;
      console.log(`[Webhook] Processing entry id=${pageId} | platform=${platform} | changes=${entry.changes?.length || 0} | messaging=${entry.messaging?.length || 0}`);

      // Ã¢â€â‚¬Ã¢â€â‚¬ Standard change events (comments, mentions, follow) Ã¢â€â‚¬Ã¢â€â‚¬
      for (const change of (entry.changes || [])) {
        console.log(`[Webhook] Change: field="${change.field}" value_keys=${Object.keys(change.value || {}).join(",")}`);
        
        await processChangeEvent(supabase, {
          object: body.object,
          platform,
          field: change.field,
          value: change.value,
          pageId,
        });

        // Ã¢â€â‚¬Ã¢â€â‚¬ Handle "feed" field which may contain Facebook comments Ã¢â€â‚¬Ã¢â€â‚¬
        // Facebook: field="feed" with value.item="comment" is how FB page comment webhooks arrive.
        // Instagram: uses field="comments" directly Ã¢â‚¬â€ never "feed".
        // So this block is FB-only (platform guard added for safety).
        if (change.field === "feed" && change.value?.item === "comment" && change.value?.verb === "add" && platform === "facebook") {
          console.log(`[Webhook] FB feed comment detected Ã¢â‚¬â€ converting to comment event format`);
          const feedComment = {
            id: change.value.comment_id,
            text: change.value.message,
            from: change.value.from,
            media: { id: change.value.post_id },
            parent_id: change.value.parent_id || null,
          };
          await processCommentEvent(supabase, feedComment, pageId, platform);
        }
      }

      // Ã¢â€â‚¬Ã¢â€â‚¬ Messaging events (DMs, postbacks, quick replies) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
      const allMessages = [...(entry.messaging || []), ...(entry.standby || [])];
      for (const msg of allMessages) {
        await processMessagingEvent(supabase, msg, pageId, platform);
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("[Webhook] Error:", err);
    return new NextResponse("OK", { status: 200 }); // Always 200 to Meta
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Change events dispatcher
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function processChangeEvent(
  supabase: any,
  ctx: { object: string; platform: "instagram" | "facebook"; field: string; value: any; pageId: string }
) {
  const { field, value, pageId, platform } = ctx;
  console.log(`[Webhook] Change event: field=${field} pageId=${pageId} platform=${platform}`);

  // Log to DB
  await supabase.from("webhook_events").insert({
    platform,
    event_type: field,
    sender_id: value?.from?.id || null,
    recipient_id: pageId,
    payload: value,
    processed: false,
  }).select().single();

  if (field === "comments") {
    await processCommentEvent(supabase, value, pageId, platform);
  }
  if (field === "mentions") {
    console.log("[Webhook] Mention event:", JSON.stringify(value).substring(0, 200));
  }
  // Note: Instagram doesn't send individual follow events via webhooks.
  // New-follower DM is handled in processMessagingEvent via first-contact detection.
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// DM / Messaging events
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function processMessagingEvent(supabase: any, messaging: any, pageId: string, platform: "instagram" | "facebook") {
  // Skip delivery receipts, reads, etc.
  if (!messaging.message && !messaging.follow && !messaging.postback) return;

  const senderId: string = messaging.sender?.id;
  // IMPORTANT: Instagram quick_reply responses come as messaging.message.quick_reply.payload
  // NOT as messaging.postback. We must check ALL possible payload locations:
  // 1. messaging.message.quick_reply.payload (quick reply button click)
  // 2. messaging.postback.payload (generic template postback button click)
  // 3. messaging.message.text (user typed text)
  // 4. messaging.postback.title (postback button title as last resort)
  const quickReplyPayload: string = messaging.message?.quick_reply?.payload || "";
  const postbackPayload: string = messaging.postback?.payload || "";
  const rawText: string = messaging.message?.text || "";
  
  // Priority: quick_reply payload > postback payload > message text > postback title
  const messageText: string = (quickReplyPayload || postbackPayload || rawText || messaging.postback?.title || "").toLowerCase();

  console.log(`[Webhook] DM from ${senderId} to page ${pageId} platform=${platform}: "${messageText.substring(0, 80)}" (qr=${quickReplyPayload ? 'yes' : 'no'}, pb=${postbackPayload ? 'yes' : 'no'}, text=${rawText ? 'yes' : 'no'})`);

  // Log DM event with correct platform
  await supabase.from("webhook_events").insert({
    platform,
    event_type: "message",
    sender_id: senderId,
    recipient_id: pageId,
    payload: messaging,
    processed: false,
  });

  // Find connected account for this page/IG account
  const { data: account, error: accErr } = await supabase
    .from("connected_accounts")
    .select("id, user_id, access_token, platform_user_id, platform_username")
    .or(`platform_user_id.eq.${pageId},page_id.eq.${pageId}`)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (accErr) {
    console.error(`[Webhook] Account lookup error for pageId=${pageId}: ${accErr.message}`);
  }
  if (!account) {
    console.warn(`[Webhook] No connected account found for pageId=${pageId}`);
    return;
  }
  console.log(`[Webhook] Account found: id=${account.id}, username=${account.platform_username}, igId=${account.platform_user_id}`);

  // Check opt-out
  const { data: conv } = await supabase
    .from("dm_conversations")
    .select("opted_out, message_count")
    .eq("account_id", account.id)
    .eq("sender_id", senderId)
    .single();

  if (conv?.opted_out) {
    console.log(`[Webhook] Sender ${senderId} opted out Ã¢â‚¬â€ skipping`);
    return;
  }

  const isFirstMessage = !conv || (conv.message_count || 0) === 0;

  // Update or create conversation tracker (avoid upsert conflict issue)
  // CRITICAL: Track last_user_interaction_at for 24h messaging window compliance
  if (conv) {
    await supabase.from("dm_conversations")
      .update({
        message_count: (conv.message_count || 0) + 1,
        last_message_at: new Date().toISOString(),
        last_user_interaction_at: new Date().toISOString(),  // 24h window tracking
      })
      .eq("account_id", account.id)
      .eq("sender_id", senderId);
  } else {
    const { error: insertErr } = await supabase.from("dm_conversations").insert({
      account_id: account.id,
      user_id: account.user_id,
      sender_id: senderId,
      message_count: 1,
      last_message_at: new Date().toISOString(),
      last_user_interaction_at: new Date().toISOString(),  // 24h window tracking
    });
    if (insertErr) console.warn("[Webhook] dm_conversations insert error:", insertErr.message);
  }

  // Handle opt-out keywords
  const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "optout", "opt out", "cancel", "band karo"];
  if (OPT_OUT_KEYWORDS.some(k => messageText.includes(k))) {
    await supabase.from("dm_conversations").upsert({
      account_id: account.id,
      user_id: account.user_id,
      sender_id: senderId,
      opted_out: true,
    }, { onConflict: "account_id,sender_id" });
    console.log(`[Webhook] Opt-out recorded for ${senderId}`);
    return;
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Automation context resolution Ã¢â‚¬â€ DETERMINISTIC TOKEN LOOKUP Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // The quick_reply payload is "AUTO:<token_uuid>" where the UUID maps to
  // an exact row in automation_context_tokens containing the full context.
  // This is the ONLY supported correlation mechanism for commentÃ¢â€ â€™DM flows.
  // Methods 2/3/4 (probabilistic fallbacks) have been REMOVED per Blocker 1-4.
  // If token is missing, expired, invalid, or wrong-tenant: STOP. Never guess.

  const rawPayload: string = quickReplyPayload || postbackPayload;

  if (rawPayload.toLowerCase().startsWith("auto:")) {
    const tokenId = rawPayload.substring(5).trim(); // strip "AUTO:" prefix
    console.log(`[Webhook] AUTO token received: token=${tokenId} sender=${senderId} platform=${platform}`);

    const { data: ctxToken, error: ctxErr } = await supabase
      .from("automation_context_tokens")
      .select("*")
      .eq("id", tokenId)
      .maybeSingle();

    const now = new Date();

    if (ctxErr || !ctxToken) {
      console.error(`[Webhook] AUTOMATION_CONTEXT_NOT_FOUND: token=${tokenId} sender=${senderId}`);
      return;
    }
    if (ctxToken.account_id !== account.id) {
      console.error(`[Webhook] AUTOMATION_CONTEXT_REJECTED: token=${tokenId} Ã¢â‚¬â€ account mismatch`);
      return;
    }
    if (ctxToken.platform !== platform) {
      console.error(`[Webhook] AUTOMATION_CONTEXT_REJECTED: token=${tokenId} Ã¢â‚¬â€ platform mismatch (token=${ctxToken.platform} webhook=${platform})`);
      return;
    }
    if (ctxToken.user_id !== account.user_id) {
      console.error(`[Webhook] AUTOMATION_CONTEXT_REJECTED: token=${tokenId} Ã¢â‚¬â€ tenant mismatch`);
      return;
    }
    if (new Date(ctxToken.expires_at) < now) {
      console.error(`[Webhook] AUTOMATION_CONTEXT_REJECTED: token=${tokenId} Ã¢â‚¬â€ expired at ${ctxToken.expires_at}`);
      await supabase.from("automation_context_tokens").update({ status: "expired" }).eq("id", tokenId);
      return;
    }
    if (ctxToken.status === "access_sent") {
      console.log(`[Webhook] AUTOMATION_CONTEXT_ALREADY_CONSUMED: token=${tokenId} Ã¢â‚¬â€ access already delivered`);
      return;
    }
    if (ctxToken.status === "rejected" || ctxToken.status === "expired") {
      console.error(`[Webhook] AUTOMATION_CONTEXT_REJECTED: token=${tokenId} Ã¢â‚¬â€ status=${ctxToken.status}`);
      return;
    }

    console.log(`[Webhook] AUTO token resolved: ruleId=${ctxToken.rule_id} commentId=${ctxToken.comment_id} attempt=${ctxToken.recheck_attempts + 1}`);

    // Store IGSID Ã¢â‚¬â€ authoritative messaging identity (NOT comment.from.id)
    await supabase
      .from("automation_context_tokens")
      .update({ igsid: senderId, status: "interacted", interacted_at: now.toISOString() })
      .eq("id", tokenId);

    const { data: rule, error: ruleErr } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("id", ctxToken.rule_id)
      .single();

    if (ruleErr || !rule) {
      console.error(`[Webhook] AUTOMATION_CONTEXT_NOT_FOUND: token=${tokenId} Ã¢â‚¬â€ rule not found (ruleId=${ctxToken.rule_id})`);
      return;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Follower check Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // -- Follower check: THREE DISTINCT STATES (Correction 2) ----------------------
    // FOLLOWER_TRUE:         user is following -> deliver access
    // FOLLOWER_FALSE:        user is NOT following -> send [I followed]
    // FOLLOWER_CHECK_FAILED: API error -> stop, do NOT send anything, do NOT assume false
    // These states are MUTUALLY EXCLUSIVE. Never combine FALSE + API_ERROR.
    const correlationId = ctxToken.correlation_id || newCorrelationId();
    const requiresFollow = rule.action_config?.require_follow === true;

    // Follower state: null = not yet determined, will be set to one of three strings
    type FollowerState = "FOLLOWER_TRUE" | "FOLLOWER_FALSE" | "FOLLOWER_CHECK_FAILED" | "NOT_REQUIRED" | "FB_BYPASS";
    let followerState: FollowerState;
    let followerCheckErrorMsg = "";

    if (!requiresFollow) {
      // require_follow=false: no follower check needed, deliver directly
      followerState = "NOT_REQUIRED";
      console.log("[Webhook] FOLLOWER_CHECK: not required for this rule (token=" + tokenId + ")");

    } else if (platform === "facebook") {
      // Facebook: is_user_follow_business not available â€” deliver directly
      followerState = "FB_BYPASS";
      console.log("[Webhook] FOLLOWER_CHECK: FB platform â€” skipped, delivering directly (token=" + tokenId + ")");

    } else {
      // Instagram: enforce max recheck first
      const MAX_RECHECK = ctxToken.max_recheck_attempts || rule.action_config?.max_recheck_attempts || 3;
      if (ctxToken.recheck_attempts >= MAX_RECHECK) {
        console.log("[Webhook] FOLLOW_VERIFICATION_LIMIT_REACHED: token=" + tokenId + " attempts=" + ctxToken.recheck_attempts);
        await supabase.from("automation_context_tokens").update({ status: "rejected" }).eq("id", tokenId);
        return;
      }

      if (!account?.access_token) {
        console.error("[Webhook] FOLLOWER_CHECK_FAILED: no access_token on account (token=" + tokenId + ")");
        followerState = "FOLLOWER_CHECK_FAILED";
        followerCheckErrorMsg = "no access_token";
      } else {
        console.log("[Webhook] FOLLOWER_CHECK_STARTED: IGSID=" + senderId + " token=" + tokenId + " corr=" + correlationId);
        try {
          const decryptedToken = decryptToken(account.access_token);
          const followRes = await fetch(
            "https://graph.facebook.com/v21.0/" + senderId + "?fields=is_user_follow_business&access_token=" + decryptedToken
          );
          const followData = await followRes.json();
          console.log("[Webhook] Follower API response:", JSON.stringify(followData).substring(0, 300));

          if (!followRes.ok || followData.error) {
            // State: FOLLOWER_CHECK_FAILED â€” do NOT treat as false
            const metaErr = followData.error || {};
            followerCheckErrorMsg = "HTTP " + followRes.status + " code=" + metaErr.code + " msg=" + metaErr.message;
            console.error("[Webhook] FOLLOWER_CHECK_FAILED token=" + tokenId + " IGSID=" + senderId + ": " + followerCheckErrorMsg);
            followerState = "FOLLOWER_CHECK_FAILED";

          } else if (followData.is_user_follow_business === true) {
            // State: FOLLOWER_TRUE
            followerState = "FOLLOWER_TRUE";
            console.log("[Webhook] FOLLOWER_TRUE: IS following (token=" + tokenId + ")");

          } else {
            // State: FOLLOWER_FALSE â€” user is confirmed NOT following
            followerState = "FOLLOWER_FALSE";
            console.log("[Webhook] FOLLOWER_FALSE: NOT following (token=" + tokenId + ")");
          }
        } catch (e: any) {
          // Network/parse error: FOLLOWER_CHECK_FAILED, NOT FOLLOWER_FALSE
          followerCheckErrorMsg = e.message;
          console.error("[Webhook] FOLLOWER_CHECK_FAILED (network) token=" + tokenId + ": " + e.message);
          followerState = "FOLLOWER_CHECK_FAILED";
        }
      }
    }

    // -- State dispatch: exhaustive, mutually exclusive --
    if (followerState === "FOLLOWER_CHECK_FAILED") {
      // Do NOT send access. Do NOT send follow message. Log and stop.
      // Token stays "interacted" â€” user can tap [I followed] again to retry.
      console.error("[Webhook] FOLLOWER_CHECK_FAILED â€” NOT delivering. IGSID=" + senderId + 
                    " token=" + tokenId + " error=" + followerCheckErrorMsg);
      return;
    }

    if (followerState === "FOLLOWER_FALSE") {
      // User is confirmed NOT following. Send [I followed] with SAME token.
      const notFollowingMsgs = rule.action_config?.not_following_messages || [];
      const randomNF = notFollowingMsgs.length > 0 ? notFollowingMsgs[Math.floor(Math.random() * notFollowingMsgs.length)] : undefined;
      const reminderText = parseSpintax(randomNF || "You are almost there! Please follow our account and then tap the button below.");
      const iFollowedBtnText = (rule.action_config?.done_button_text || "I followed!").substring(0, 20);

      console.log("[Webhook] FOLLOWER_FALSE: sending [" + iFollowedBtnText + "] to " + senderId + " token=" + tokenId + " attempt=" + ctxToken.recheck_attempts);

      await supabase
        .from("automation_context_tokens")
        .update({ recheck_attempts: ctxToken.recheck_attempts + 1 })
        .eq("id", tokenId);

      await enqueueViaBackend({
        accountId: rule.account_id || account.id,
        userId: rule.user_id,
        platform,
        recipientId: senderId,
        messagePayload: {
          text: reminderText,
          quick_replies: [{
            content_type: "text",
            title: iFollowedBtnText,
            payload: "AUTO:" + tokenId, // SAME token â€” scoped to exact execution
          }],
        },
        messageType: "dm",
        automationRuleId: rule.id,
        correlationId,
      }).catch((e: any) => console.error("[Webhook] FOLLOWER_FALSE enqueue failed:", e.message));
      return;
    }

    // FOLLOWER_TRUE | NOT_REQUIRED | FB_BYPASS: all lead to access delivery
    const msgs = rule.action_config?.messages || [];
    const randomMsg3 = msgs[Math.floor(Math.random() * msgs.length)];
    const dmText = parseSpintax(randomMsg3 || rule.action_config?.message || "Here is your link!");
    const dmLink: string | undefined = rule.action_config?.link || undefined;

    console.log(`[Webhook] ACCESS_SENT: to ${senderId} text="${dmText?.substring(0, 50)}" link=${dmLink || 'none'} token=${tokenId}`);

    try {
      // Mark token consumed Ã¢â‚¬â€ single-use, prevents double delivery
      await supabase
        .from("automation_context_tokens")
        .update({
          status: "access_sent",
          consumed_at: now.toISOString(),
          igsid: senderId,
        } as Record<string, unknown>)
        .eq("id", tokenId);

      // Sync to processed_comments for reporting dashboard
      await supabase
        .from("processed_comments")
        .update({
          igsid: senderId,
          follower_check_result: (followerState === "FB_BYPASS" || followerState === "NOT_REQUIRED") ? "skipped" : "following",
          follower_check_at: now.toISOString(),
          access_sent: true,
          access_sent_at: now.toISOString(),
        })
        .eq("comment_id", ctxToken.comment_id)
        .eq("rule_id", ctxToken.rule_id);

      await enqueueViaBackend({
        accountId: rule.account_id || account.id,
        userId: rule.user_id,
        platform,
        recipientId: senderId,
        messagePayload: { text: dmText, link: dmLink, button_label: rule.action_config?.button_label },
        messageType: "dm",
        automationRuleId: rule.id,
        correlationId,
      });

      if (rule.action_config?.follow_up_enabled && rule.action_config?.follow_up_delay > 0) {
        const fuMsgs = rule.action_config?.follow_up_messages || [];
        const fuText = parseSpintax(fuMsgs[Math.floor(Math.random() * fuMsgs.length)] || "Did you check it out?");
        const scheduledAt = new Date(Date.now() + rule.action_config.follow_up_delay * 60000).toISOString();
        await enqueueViaBackend({
          accountId: rule.account_id || account.id,
          userId: rule.user_id,
          platform,
          recipientId: senderId,
          messagePayload: { text: fuText },
          messageType: "dm",
          automationRuleId: rule.id,
          scheduledSendAt: scheduledAt,
          correlationId,
        });
      }

      await supabase.rpc("increment_trigger_count", { rule_id: rule.id }).catch(() => {
        supabase.from("automation_rules").update({
          trigger_count: (rule.trigger_count || 0) + 1,
          last_triggered: now.toISOString(),
        }).eq("id", rule.id);
      });

      console.log(`[Webhook] AUTO flow complete: rule="${rule.name}" token=${tokenId}`);
    } catch (e: any) {
      console.error(`[Webhook] AUTO access delivery failed: ${e.message}`);
    }
    return;
  }


  // Ã¢â€â‚¬Ã¢â€â‚¬ 2. dm_keyword: fires when message matches keywords Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // This runs BEFORE dm_new_follower so that if a first-time user sends a keyword,
  // the keyword rule fires instead of the generic welcome message.
  let keywordRuleMatched = false;

  const { data: keywordRules } = await supabase
    .from("automation_rules")
    .select("*")
    .or(`account_id.eq.${account.id},account_id.is.null`)
    .eq("user_id", account.user_id)
    .eq("type", "dm_keyword")
    .eq("is_active", true);

  for (const rule of (keywordRules || [])) {
    // Keyword match Ã¢â‚¬â€ use word-boundary regex (not substring includes)
    const keywords: string[] = rule.trigger_config?.keywords || [];
    const matchType: string = rule.trigger_config?.match_type || "any";

    if (keywords.length === 0) continue; // Skip rules with no keywords

    const matched = matchType === "all"
      ? keywords.every(k => keywordMatch(messageText, k))
      : keywords.some(k => keywordMatch(messageText, k));

    if (matched) {
      console.log(`[Webhook] Keyword match Ã¢â‚¬â€ rule: ${rule.name}`);
      keywordRuleMatched = true;

      let isFollowing = false;
      if (rule.action_config?.require_follow && account?.access_token) {
        try {
          const decToken = decryptToken(account.access_token);
          const url = `https://graph.facebook.com/v21.0/${senderId}?fields=is_user_follow_business&access_token=${decToken}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.is_user_follow_business === true) {
             isFollowing = true;
             console.log(`[Webhook] User ${senderId} is already following! Bypassing follow prompt.`);
          }
        } catch (err: any) {
          console.warn(`[Webhook] Follower check failed:`, err.message);
        }
      }

      const bypassFollowPrompt = rule.action_config?.require_follow && isFollowing;

      let dmText = "";
      let dmLink = undefined;
      let quickReplies = undefined;

      if (rule.action_config?.require_follow && !bypassFollowPrompt) {
        const followMsgs = rule.action_config?.follow_prompt_messages || [];
        const randomMsg = followMsgs.length > 0 ? followMsgs[Math.floor(Math.random() * followMsgs.length)] : undefined;
        const customBtn = (rule.action_config?.done_button_text || "DONE Ã¢Å“â€¦").substring(0, 20);
        dmText = parseSpintax(randomMsg || `Please follow me and tap '${customBtn}' to get the link!`);
        dmLink = undefined;
        quickReplies = [{ content_type: "text", title: customBtn, payload: `DONE:${rule.id}` }];
        
        // Log to processed_comments so the "DONE" check can find this rule
        try {
          await supabase.from("processed_comments").insert({
            comment_id: "dm_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
            rule_id: rule.id,
            commentor_id: senderId,
            media_id: "dm_automation",
            processed_at: new Date().toISOString(),
          });
        } catch (e: any) {
          console.warn(`[Webhook] Failed to insert processed_comments for DM requirement: ${e.message}`);
        }
      } else {
        const msgs = rule.action_config?.messages || [];
        const randomMsg = msgs.length > 0 ? msgs[Math.floor(Math.random() * msgs.length)] : undefined;
        dmText = parseSpintax(randomMsg || rule.action_config?.message || rule.action_config?.reply_text || "Namaste! Ã°Å¸â„¢Â");
        dmLink = rule.action_config?.link || undefined;
      }

      await enqueueViaBackend({
        accountId: account.id,
        userId: account.user_id,
        recipientId: senderId,
        messagePayload: {
          text: dmText,
          link: dmLink,
          quick_replies: quickReplies,
        },
        messageType: "dm",
        automationRuleId: rule.id,
      });
      await supabase.from("automation_rules").update({
        trigger_count: (rule.trigger_count || 0) + 1,
        last_triggered: new Date().toISOString(),
      }).eq("id", rule.id);
      break; // First matching rule only
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ 3. dm_new_follower: fires on FIRST message if no keyword matched Ã¢â€â‚¬Ã¢â€â‚¬
  // Only triggers if no keyword rule was already matched above.
  // This ensures keyword intent is always respected over generic welcome.
  if (!keywordRuleMatched && isFirstMessage) {
    const { data: followerRules } = await supabase
      .from("automation_rules")
      .select("*")
      .or(`account_id.eq.${account.id},account_id.is.null`)
      .eq("user_id", account.user_id)
      .eq("type", "dm_new_follower")
      .eq("is_active", true)
      .limit(1);

    if (followerRules?.length > 0) {
      const rule = followerRules[0];
      console.log(`[Webhook] Triggering dm_new_follower rule: ${rule.name}`);
      
      let isFollowing = false;
      if (rule.action_config?.require_follow && account?.access_token) {
        try {
          const decToken = decryptToken(account.access_token);
          const url = `https://graph.facebook.com/v21.0/${senderId}?fields=is_user_follow_business&access_token=${decToken}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.is_user_follow_business === true) {
             isFollowing = true;
             console.log(`[Webhook] User ${senderId} is already following! Bypassing follow prompt.`);
          }
        } catch (err: any) {
          console.warn(`[Webhook] Follower check failed:`, err.message);
        }
      }

      const bypassFollowPrompt = rule.action_config?.require_follow && isFollowing;

      let dmText = "";
      let dmLink = undefined;
      let quickReplies = undefined;

      if (rule.action_config?.require_follow && !bypassFollowPrompt) {
        const followMsgs = rule.action_config?.follow_prompt_messages || [];
        const randomMsg = followMsgs.length > 0 ? followMsgs[Math.floor(Math.random() * followMsgs.length)] : undefined;
        const customBtn = (rule.action_config?.done_button_text || "DONE Ã¢Å“â€¦").substring(0, 20);
        dmText = parseSpintax(randomMsg || `Please follow me and tap '${customBtn}' to get the link!`);
        dmLink = undefined;
        quickReplies = [{ content_type: "text", title: customBtn, payload: `DONE:${rule.id}` }];
      } else {
        const msgs = rule.action_config?.messages || [];
        const randomMsg = msgs.length > 0 ? msgs[Math.floor(Math.random() * msgs.length)] : undefined;
        dmText = parseSpintax(randomMsg || rule.action_config?.message || "Namaste! Ã°Å¸â„¢Â");
        dmLink = rule.action_config?.link || undefined;
      }

      await enqueueViaBackend({
        accountId: account.id,
        userId: account.user_id,
        recipientId: senderId,
        messagePayload: {
          text: dmText,
          link: dmLink,
          button_label: rule.action_config?.button_label,
          quick_replies: quickReplies,
        },
        messageType: "dm",
        automationRuleId: rule.id,
      });
      await supabase.from("automation_rules").update({
        trigger_count: (rule.trigger_count || 0) + 1,
        last_triggered: new Date().toISOString(),
      }).eq("id", rule.id);
    }
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Comment events
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function processCommentEvent(supabase: any, payload: any, pageId: string, platform: "instagram" | "facebook" = "instagram") {
  const commentText = payload?.text?.toLowerCase() || "";
  const commentId = payload?.id;
  const mediaId = payload?.media?.id;
  const commentorId = payload?.from?.id;
  const parentId = payload?.parent_id;

  console.log(`[Webhook] Comment: "${commentText.substring(0, 60)}" on media ${mediaId} by ${commentorId} parent=${parentId} pageId=${pageId}`);

  if (!commentId) {
    console.warn("[Webhook] Comment has no ID — skipping");
    return;
  }

  // ── Skip replies to comments (prevents infinite loop) ──
  if (parentId) {
    console.log(`[Webhook] Skipping reply-to-comment (parent_id=${parentId})`);
    return;
  }

  // ── Find the connected account for this pageId ────────────────────────
  // This is the MASTER token lookup — used as fallback for any rule without account_id
  const { data: pageAccount } = await supabase
    .from("connected_accounts")
    .select("id, user_id, access_token, platform_user_id, page_id, platform_username")
    .or(`platform_user_id.eq.${pageId},page_id.eq.${pageId}`)
    .eq("is_active", true)
    .maybeSingle();

  console.log(`[Webhook] Page account found: ${pageAccount ? 'YES (id=' + pageAccount.id + ')' : 'NO'}`);

  let antiBotEnabled = true;
  if (pageAccount?.user_id) {
    const { data: { user } } = await supabase.auth.admin.getUserById(pageAccount.user_id);
    if (user?.user_metadata?.anti_bot_enabled === false) {
      antiBotEnabled = false;
      console.log(`[Webhook] Anti-bot sleep cycle DISABLED by user settings`);
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Get ALL active comment rules Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Query by BOTH account_id match AND rules with null account_id (for this user)
  let rulesQuery = supabase
    .from("automation_rules")
    .select("*")
    .in("type", ["comment_reply", "comment_to_dm", "hide_comment", "comment_automation"])
    .eq("is_active", true);

  // If we found the page account, filter rules for this user AND account
  if (pageAccount) {
    rulesQuery = rulesQuery
      .eq("user_id", pageAccount.user_id)
      .or(`account_id.eq.${pageAccount.id},account_id.is.null`);
  }

  const { data: rules, error: rulesError } = await rulesQuery;

  if (rulesError) {
    console.error(`[Webhook] Failed to fetch rules: ${rulesError.message}`);
    return;
  }

  console.log(`[Webhook] Found ${(rules || []).length} matching comment rules`);
  // Log each rule for debugging
  for (const r of (rules || [])) {
    const kw = r.trigger_config?.keywords || [];
    console.log(`[Webhook]   Ã¢â€ â€™ Rule "${r.name}" type=${r.type} keywords=[${kw.join(',')}] require_follow=${r.action_config?.require_follow} active=${r.is_active}`);
  }

  if (!rules?.length) {
    console.log("[Webhook] No active comment rules found");
    return;
  }

  for (const rule of rules) {
    // Media filter Ã¢â‚¬â€ skip if rule is for a specific post and this isn't it
    const ruleMediaId = rule.trigger_config?.media_id;
    const ruleMediaIds: any[] = rule.trigger_config?.media_ids || [];
    
    if (ruleMediaIds.length > 0) {
      if (!ruleMediaIds.some(m => m.mediaId === mediaId)) continue;
    } else if (ruleMediaId) {
      if (ruleMediaId !== mediaId) continue;
    }

    // Keyword match Ã¢â‚¬â€ use word-boundary regex (not substring includes)
    const keywords: string[] = rule.trigger_config?.keywords || [];
    const matchType: string = rule.trigger_config?.match_type || "any";

    // IMPORTANT: Skip rules with NO keywords for comment_automation type.
    // An empty keywords array would match EVERY comment, causing false triggers.
    if (keywords.length === 0 && rule.type === "comment_automation") {
      console.log(`[Webhook] Skipping rule "${rule.name}" Ã¢â‚¬â€ no keywords defined (would match everything)`);
      continue;
    }

    const matched = keywords.length === 0
      ? true  // Only for legacy comment_reply/comment_to_dm types
      : matchType === "all"
        ? keywords.every((k: string) => keywordMatch(commentText, k))
        : keywords.some((k: string) => keywordMatch(commentText, k));

    if (!matched) {
      console.log(`[Webhook] Keywords didn't match for rule "${rule.name}" (keywords=${keywords.join(',')}, text="${commentText.substring(0, 30)}")`);
      continue;
    }

    console.log(`[Webhook] Ã¢Å“â€¦ Rule "${rule.name}" matched! Processing...`);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Dedup: try processed_comments (graceful if table doesn't exist) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    let skipDueToDuplicate = false;
    try {
      const { error: dedupError } = await supabase
        .from("processed_comments")
        .insert({
          comment_id: commentId,
          rule_id: rule.id,
          commentor_id: commentorId || null,
          media_id: mediaId || null,
          processed_at: new Date().toISOString(),
        });

      if (dedupError) {
        if (dedupError.code === "23505") {
          console.log(`[Webhook] Comment ${commentId} already processed for rule "${rule.name}" Ã¢â‚¬â€ skipping`);
          skipDueToDuplicate = true;
        } else if (dedupError.code === "42P01") {
          // Table doesn't exist Ã¢â‚¬â€ just log and continue (don't block automation!)
          console.warn(`[Webhook] processed_comments table missing Ã¢â‚¬â€ continuing without dedup`);
        } else {
          console.warn(`[Webhook] Dedup insert error (${dedupError.code}): ${dedupError.message} Ã¢â‚¬â€ continuing anyway`);
        }
      }
    } catch (e: any) {
      console.warn(`[Webhook] Dedup check failed: ${e.message} Ã¢â‚¬â€ continuing anyway`);
    }

    if (skipDueToDuplicate) continue;

    // Ã¢â€â‚¬Ã¢â€â‚¬ Get access token Ã¢â‚¬â€ with FALLBACK to pageAccount Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    let token: string | null = null;

    // Try 1: Get from rule's account_id
    if (rule.account_id) {
      const { data: acc } = await supabase
        .from("connected_accounts")
        .select("access_token, platform_user_id")
        .eq("id", rule.account_id)
        .single();
      token = acc?.access_token || null;
    }

    // Try 2: Fallback to pageAccount (found from webhook pageId)
    if (!token && pageAccount?.access_token) {
      token = pageAccount.access_token;
      console.log(`[Webhook] Using pageAccount token as fallback for rule "${rule.name}"`);
    }

    // CRITICAL: Decrypt the token Ã¢â‚¬â€ it's stored encrypted in DB
    if (token) {
      token = decryptToken(token);
    }

    if (!token) {
      console.error(`[Webhook] Ã¢ÂÅ’ No token available for rule "${rule.name}" Ã¢â‚¬â€ cannot execute`);
      continue;
    }
    
    // Anti-ban check: Rate Limit
    if (!checkDailyLimit(rule.account_id || pageAccount?.id, 100)) {
      console.warn(`[Webhook] Ã¢Å¡Â Ã¯Â¸Â Daily outbound limit reached for account ${rule.account_id || pageAccount?.id}`);
      continue;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Determine which actions to run Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const actionsEnabled = rule.action_config?.actions_enabled;
    const isUnified = rule.type === "comment_automation";

    // For unified rules: prefer explicit actions_enabled flags.
    // FALLBACK: if actions_enabled is null (old rule created before this field),
    // infer intent from whether the action content is set.
    // For unified rules: use explicit boolean columns if available.
    // FALLBACK: action_config.actions_enabled, then finally infer from text existence.
    const shouldReply = isUnified
      ? (rule.reply_enabled ?? (actionsEnabled ? actionsEnabled.reply : !!rule.action_config?.reply_text))
      : rule.type === "comment_reply";
    const shouldDM = isUnified
      ? (rule.dm_enabled ?? (actionsEnabled ? actionsEnabled.dm : !!rule.action_config?.message))
      : rule.type === "comment_to_dm";
    const shouldHide = isUnified
      ? (rule.hide_enabled ?? (actionsEnabled ? actionsEnabled.hide : !!rule.action_config?.hide))
      : rule.type === "hide_comment";

    console.log(`[Webhook] Actions: reply=${shouldReply}, dm=${shouldDM}, hide=${shouldHide} (actions_enabled=${JSON.stringify(actionsEnabled)})`);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Follower check at COMMENT TIME Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // We use a landing page (gate) for follow-gating. The gate page handles:
    //   Follow CTA Ã¢â€ â€™ "I'm Following" confirm Ã¢â€ â€™ reveals link
    // So at comment time, we ALWAYS set isFollowing=false when require_follow is ON.
    // This ensures every commenter gets the gate page URL in their Private Reply.
    // No returning commenter bypass needed Ã¢â‚¬â€ gate page is the enforcement.
    let isFollowing = false;

    // Ã¢â€â‚¬Ã¢â€â‚¬ AUTO-REPLY to comment (public reply) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const replyTexts = rule.action_config?.reply_texts || [];
    const randomReply = replyTexts.length > 0 ? replyTexts[Math.floor(Math.random() * replyTexts.length)] : undefined;
    const finalReplyText = randomReply || rule.action_config?.reply_text;
    
    if (shouldReply && finalReplyText) {
      // Add a short 1-2 second delay Ã¢â‚¬â€ fast response
      const replyDelayMs = randomGaussianDelayMs(1, 2) + getSleepCycleDelayMs(undefined, antiBotEnabled);
      const spunReplyText = parseSpintax(finalReplyText);
      console.log(`[Webhook] Scheduling public reply in ${replyDelayMs / 1000}s`);

      // Enqueue via backend with delay (uses scheduled_send_at)
      const replyEnqueueResult = await enqueueViaBackend({
        accountId: rule.account_id || pageAccount?.id,
        userId: rule.user_id,
        platform,
        recipientId: commentId,          // comment_id for comment_reply type
        messagePayload: { text: spunReplyText },
        messageType: "comment_reply",
        automationRuleId: rule.id,
        scheduledSendAt: scheduledSendAt(replyDelayMs),
      });

      // Fallback: if backend unreachable, send directly after delay
      if (replyEnqueueResult.error && !replyEnqueueResult.queued) {
        console.warn(`[Webhook] Backend unreachable Ã¢â‚¬â€ will send reply directly after delay`);
        try {
          await new Promise(r => setTimeout(r, Math.min(replyDelayMs, 5000))); // cap at 5s for serverless
          const replyRes = await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: spunReplyText, access_token: token }),
          });
          const replyData = await replyRes.json();
          if (!replyRes.ok) {
            console.error(`[Webhook] Ã¢ÂÅ’ Reply failed: ${JSON.stringify(replyData)}`);
          } else {
            console.log(`[Webhook] Ã¢Å“â€¦ Comment reply sent directly`);
          }
        } catch (e: any) {
          console.error(`[Webhook] Ã¢ÂÅ’ Reply error: ${e.message}`);
        }
      } else {
        console.log(`[Webhook] Ã¢Å“â€¦ Reply queued with ${replyDelayMs / 1000}s delay`);
      }
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ SEND Private Reply DM to commenter Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // -- SEND Private Reply DM (Mode B: ALL flows create context token) ----------------
    // Token created BEFORE enqueue for all Mode B CTA flows, regardless of require_follow.
    // require_follow=false: token resolved -> send access directly (no follower API)
    // require_follow=true:  token resolved -> follower check -> TRUE/FALSE/FAIL
    if (shouldDM && commentorId && commentId) {
      // Step 1: Create context token (mandatory for ALL Mode B flows)
      const ctaCorrelationId = newCorrelationId();
      let ctaTokenId: string | null = null;
      {
        const ins = await supabase
          .from("automation_context_tokens")
          .insert({
            user_id: rule.user_id,
            account_id: rule.account_id || pageAccount?.id,
            platform,
            rule_id: rule.id,
            comment_id: commentId,
            commentor_id: commentorId,
            correlation_id: ctaCorrelationId,
            max_recheck_attempts: rule.action_config?.max_recheck_attempts || 3,
          })
          .select("id")
          .single();
        if (ins.error || !ins.data) {
          console.error("[Webhook] CRITICAL: token creation failed:", ins.error?.message, "-- aborting Mode B");
          break;
        }
        ctaTokenId = ins.data.id;
        console.log("[Webhook] AUTO token created:", ctaTokenId, "require_follow=" + (rule.action_config?.require_follow || false));
      }

      // Step 2: Build CTA message (quick_reply captures IGSID via messaging webhook)
      const ctaMsgs = rule.action_config?.follow_prompt_messages || [];
      const ctaRandomMsg = ctaMsgs.length > 0 ? ctaMsgs[Math.floor(Math.random() * ctaMsgs.length)] : undefined;
      const ctaBtnText = (rule.action_config?.cta_button_text || rule.action_config?.done_button_text || "Click here").substring(0, 20);
      const directMsgs = rule.action_config?.messages || [];
      const directRandomMsg = directMsgs.length > 0 ? directMsgs[Math.floor(Math.random() * directMsgs.length)] : undefined;
      const dmText = parseSpintax(
        ctaRandomMsg ||
        directRandomMsg ||
        rule.action_config?.message ||
        "Hey! Tap the button below and I will share the link in just a moment."
      );
      const dmLink: string | undefined = undefined;
      const msgPayloadExtras: Record<string, unknown> = {
        quick_replies: [{
          content_type: "text",
          title: ctaBtnText,
          payload: ("AUTO:" + ctaTokenId),
        }],
      };
      console.log("[Webhook] Mode B CTA:", ctaBtnText, "token=" + ctaTokenId, "require_follow=" + (rule.action_config?.require_follow || false));
      
      // Add a short 1.5-3 second delay Ã¢â‚¬â€ DM comes right after the public reply
      const dmDelayMs = randomGaussianDelayMs(1.5, 3) + getSleepCycleDelayMs(undefined, antiBotEnabled);
      console.log(`[Webhook] Scheduling private reply DM in ${dmDelayMs / 1000}s for comment ${commentId}`);

      // Build message payload
      const msgPayload: any = { 
        text: dmText, 
        link: dmLink, 
        button_label: rule.action_config?.button_label,
        ...(msgPayloadExtras || {}),
      };

      // Generate idempotency key to prevent duplicate messages on webhook retries
      const idempotencyKey = `pr_${commentId}_${rule.id}`;
      const enqueueResult = await enqueueViaBackend({
        accountId: rule.account_id || pageAccount?.id,
        userId: rule.user_id,
        platform,
        recipientId: commentId,          // comment_id Ã¢â‚¬â€ NOT the user's IG ID
        messagePayload: msgPayload,
        messageType: "private_reply",    // Uses recipient: { comment_id } format
        automationRuleId: rule.id,
        scheduledSendAt: scheduledSendAt(dmDelayMs),
        idempotencyKey,
      });

      // Fallback: if backend worker is down, send directly
      if (enqueueResult.error && !enqueueResult.queued) {
        console.warn(`[Webhook] Backend enqueue failed Ã¢â‚¬â€ sending Private Reply directly via Meta API`);
        try {
          const privateReplyBody: any = {
            recipient: { comment_id: commentId },
            message: {
              text: dmText,
            },
          };

          // Use the IG account's user ID as the sender endpoint
          const igSenderId = pageAccount?.platform_user_id || "me";
          const dmRes = await fetch(
            `https://graph.facebook.com/v21.0/${igSenderId}/messages?access_token=${token}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(privateReplyBody),
            }
          );
          const dmData = await dmRes.json();
          if (!dmRes.ok) {
            console.error(`[Webhook] Ã¢ÂÅ’ Direct Private Reply failed: ${JSON.stringify(dmData)}`);
          } else {
            console.log(`[Webhook] Ã¢Å“â€¦ Private Reply sent directly`);
          }
        } catch (e: any) {
          console.error(`[Webhook] Ã¢ÂÅ’ Direct Private Reply error: ${e.message}`);
        }
      } else {
        console.log(`[Webhook] Ã¢Å“â€¦ Private Reply DM queued with ${dmDelayMs / 1000}s delay`);
      }
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ HIDE comment Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    if (shouldHide) {
      try {
        console.log(`[Webhook] Hiding comment ${commentId}`);
        await fetch(`https://graph.facebook.com/v21.0/${commentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_hidden: true, access_token: token }),
        });
      } catch (e: any) {
        console.error(`[Webhook] Ã¢ÂÅ’ Hide comment error: ${e.message}`);
      }
    }

    // Update trigger count Ã¢â‚¬â€ use SQL increment to avoid race condition
    // (reading old value then writing +1 loses increments under concurrency)
    await supabase.rpc("increment_trigger_count", { rule_id: rule.id }).catch(() => {
      // Fallback if RPC doesn't exist yet Ã¢â‚¬â€ still better than nothing
      supabase.from("automation_rules").update({
        trigger_count: (rule.trigger_count || 0) + 1,
        last_triggered: new Date().toISOString(),
      }).eq("id", rule.id);
    });

    console.log(`[Webhook] Ã¢Å“â€¦ Rule "${rule.name}" executed.`);
    
    // Successfully processed a rule for this comment.
    // Stop evaluating other rules to prevent multiple DMs/replies for the same comment.
    break;
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Enqueue message via Backend Send Queue (Compliance Pipeline)
// Replaces direct Meta API calls. All messages now go through:
// Compliance Check Ã¢â€ â€™ Rate Limiter Ã¢â€ â€™ Send Queue Ã¢â€ â€™ Meta API
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function enqueueViaBackend(opts: {
  accountId: string;
  userId: string;
  platform?: string;
  recipientId: string;
  messagePayload: { text: string; link?: string; button_label?: string; quick_replies?: any[]; postback_button?: { title: string; payload: string } };
  messageType: string;
  automationRuleId?: string;
  correlationId?: string;
  scheduledSendAt?: string;   // ISO8601 Ã¢â‚¬â€ when to actually send (enables delays)
  idempotencyKey?: string;    // Prevents duplicate messages on webhook retries
}) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/messaging/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": WORKER_SECRET,
      },
      body: JSON.stringify(opts),
    });

    const data = await res.json();

    if (data.blocked) {
      console.log(`[Webhook] Message blocked by compliance: ${data.blockReason}`);
    } else if (data.queued) {
      console.log(`[Webhook] Ã¢Å“â€¦ Message enqueued: queue=${data.queueId}`);
    } else {
      console.warn(`[Webhook] Enqueue returned unexpected result:`, data);
    }

    return data;
  } catch (err: any) {
    console.error(`[Webhook] Failed to enqueue message:`, err.message);
    // Fallback: log the failure but don't crash the webhook handler
    return { queued: false, error: err.message };
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Signature verification
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function verifySignature(body: string, signature: string): boolean {
  // SECURITY: Signature verification is mandatory in production.
  const secrets = [
    process.env.META_APP_SECRET,
    process.env.META_LOGIN_APP_SECRET,
  ].filter(Boolean) as string[];

  if (secrets.length === 0) {
    console.warn("[Webhook] No META_APP_SECRET set Ã¢â‚¬â€ REJECTING webhook (set META_APP_SECRET in env)");
    if (process.env.NODE_ENV === "production") return false;
    console.warn("[Webhook] Allowing unsigned webhook in development mode ONLY");
    return true;
  }

  if (!signature) {
    console.warn("[Webhook] No signature header received Ã¢â‚¬â€ rejecting");
    return false;
  }

  for (const secret of secrets) {
    try {
      const expected = "sha256=" +
        crypto.createHmac("sha256", secret)
          .update(Buffer.from(body, "utf-8"))
          .digest("hex");

      // Timing-safe comparison
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        return true; // Match found
      }
    } catch (e) {
      console.error("[Webhook] Signature verification error:", e);
    }
  }

  return false; // No secret matched
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Automation step logger Ã¢â‚¬â€ writes to automation_executions table.
// Never throws Ã¢â‚¬â€ observability must not break the automation.
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function logAutomationStep(
  supabase: any,
  params: {
    correlationId: string;
    accountId: string;
    ruleId: string;
    platform: string;
    step: string;
    status: "ok" | "error" | "skipped";
    detail?: Record<string, unknown>;
    errorMessage?: string;
  }
): Promise<void> {
  try {
    await supabase.from("automation_executions").insert({
      correlation_id: params.correlationId,
      account_id: params.accountId,
      rule_id: params.ruleId,
      platform: params.platform,
      step: params.step,
      status: params.status,
      detail: params.detail || null,
      error_message: params.errorMessage || null,
    });
  } catch (e: any) {
    // Log to console but never throw Ã¢â‚¬â€ observability must not break automation
    console.warn(`[Webhook] logAutomationStep failed for step=${params.step}: ${e.message}`);
  }
}
