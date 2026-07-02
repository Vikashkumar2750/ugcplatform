import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

// Anon key client — only used to verify JWT tokens
const anonClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AuthenticatedRequest extends Request {
  userId: string;
  userEmail: string;
}

// ── In-memory rate limiter ──────────────────────────────────────────
// Per-user request counting: userId → { count, windowStart }
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per user

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

// Periodic cleanup of stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.replace("Bearer ", "");

  // Basic token format validation (JWT should have 3 parts)
  if (token.split(".").length !== 3) {
    res.status(401).json({ error: "Malformed token" });
    return;
  }

  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Rate limit check
  if (!checkRateLimit(data.user.id)) {
    res.status(429).json({ error: "Too many requests. Please slow down." });
    return;
  }

  (req as AuthenticatedRequest).userId = data.user.id;
  (req as AuthenticatedRequest).userEmail = data.user.email ?? "";
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const adminEmail = process.env.ADMIN_EMAIL!;
  const userEmail = (req as AuthenticatedRequest).userEmail;
  if (userEmail !== adminEmail) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
