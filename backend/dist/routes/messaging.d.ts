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
declare const router: import("express-serve-static-core").Router;
export default router;
