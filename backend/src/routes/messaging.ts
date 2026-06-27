/**
 * messaging.ts — Internal messaging API routes
 *
 * POST /api/messaging/enqueue — Enqueue an outbound message (compliance + rate limit)
 * POST /api/messaging/ai-reply — Generate an AI reply with confidence scoring
 * GET  /api/messaging/queue-stats — Get queue statistics
 * GET  /api/messaging/compliance-logs — Get compliance audit logs
 * GET  /api/messaging/reviews — Get pending human review items
 * POST /api/messaging/reviews/:id/approve — Approve a review item
 * POST /api/messaging/reviews/:id/discard — Discard a review item
 */

import { Router, Request, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { enqueueMessage, getQueueStats } from "../services/send-queue";
import { generateAIReply, getPendingReviews, approveReviewedMessage, discardReviewedMessage } from "../services/ai-reply";
import { getRateLimitStatus } from "../services/rate-limiter";
import { supabase } from "../lib/supabase";

const router = Router();

// ─── POST /api/messaging/enqueue ─────────────────────────────────────────────
// Internal endpoint: called by webhook handler (via worker secret) or by backend cron.
// Also callable by authenticated users for manual sends.
router.post("/enqueue", async (req: Request, res: Response) => {
  // Accept either bearer JWT auth or worker secret
  const workerSecret = req.headers["x-worker-secret"];
  let userId: string;

  if (workerSecret === process.env.WORKER_SECRET) {
    // Internal call from webhook handler
    userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: "userId required for internal calls" });
    }
  } else {
    // JWT auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    // Use the auth middleware inline
    const { createClient } = require("@supabase/supabase-js");
    const anonClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await anonClient.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid token" });
    }
    userId = data.user.id;
  }

  const {
    accountId, recipientId, messagePayload,
    messageType, automationRuleId, messageTag, priority, scheduledSendAt,
  } = req.body;

  if (!accountId || !recipientId || !messagePayload?.text) {
    return res.status(400).json({
      error: "accountId, recipientId, and messagePayload.text are required",
    });
  }

  try {
    const result = await enqueueMessage({
      accountId,
      userId,
      recipientId,
      messagePayload,
      messageType: messageType || "dm",
      automationRuleId,
      messageTag,
      priority,
      scheduledSendAt,
    });

    return res.json(result);
  } catch (err: any) {
    console.error("[/api/messaging/enqueue]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/messaging/ai-reply ────────────────────────────────────────────
// Generate an AI reply with confidence scoring.
router.post("/ai-reply", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const {
    accountId, recipientId, conversationId,
    incomingMessage, conversationHistory,
    businessContext, replyStyle, language,
  } = req.body;

  if (!accountId || !recipientId || !incomingMessage) {
    return res.status(400).json({
      error: "accountId, recipientId, and incomingMessage are required",
    });
  }

  try {
    const result = await generateAIReply({
      userId,
      accountId,
      recipientId,
      conversationId,
      incomingMessage,
      conversationHistory,
      businessContext,
      replyStyle,
      language,
    });

    return res.json(result);
  } catch (err: any) {
    console.error("[/api/messaging/ai-reply]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/messaging/queue-stats ──────────────────────────────────────────
router.get("/queue-stats", requireAuth, async (req: Request, res: Response) => {
  const accountId = req.query.accountId as string | undefined;

  try {
    const stats = await getQueueStats(accountId);
    return res.json(stats);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/messaging/rate-limit-status ────────────────────────────────────
router.get("/rate-limit-status", requireAuth, async (req: Request, res: Response) => {
  const accountId = req.query.accountId as string;
  if (!accountId) {
    return res.status(400).json({ error: "accountId query param required" });
  }

  try {
    const status = await getRateLimitStatus(accountId);
    return res.json(status);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/messaging/compliance-logs ──────────────────────────────────────
router.get("/compliance-logs", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const decision = req.query.decision as string; // 'allowed' | 'blocked'

  try {
    let query = supabase
      .from("compliance_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (decision) {
      query = query.eq("decision", decision);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ logs: data || [], total: data?.length || 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/messaging/reviews ──────────────────────────────────────────────
router.get("/reviews", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const reviews = await getPendingReviews(userId, limit);
    return res.json({ reviews });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/messaging/reviews/:id/approve ─────────────────────────────────
router.post("/reviews/:id/approve", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const id = req.params.id as string;
  const { editedText } = req.body;

  try {
    const result = await approveReviewedMessage(id, userId, editedText);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // If approved, enqueue the message via send pipeline
    // Fetch the review item to get the details
    const { data: review } = await supabase
      .from("human_review_queue")
      .select("*")
      .eq("id", id)
      .single();

    if (review) {
      const finalText = editedText || review.ai_draft_text;
      const enqueueResult = await enqueueMessage({
        accountId: review.account_id,
        userId: review.user_id,
        recipientId: review.recipient_id,
        messagePayload: { text: finalText },
        messageType: "dm",
      });

      // Mark as sent in review queue
      await supabase.from("human_review_queue").update({
        sent_at: enqueueResult.queued ? new Date().toISOString() : null,
        status: enqueueResult.queued ? "sent" : review.status,
      }).eq("id", id);

      return res.json({ ...result, enqueueResult });
    }

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/messaging/reviews/:id/discard ─────────────────────────────────
router.post("/reviews/:id/discard", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const id = req.params.id as string;

  try {
    const result = await discardReviewedMessage(id, userId);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
