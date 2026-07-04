/**
 * automation.ts — Backend routes for content automation
 * POST /api/automation/schedule     — Schedule a post
 * GET  /api/automation/schedule     — Get scheduled posts
 * DELETE /api/automation/schedule/:id — Cancel scheduled post
 * POST /api/automation/publish/:id  — Manually publish now
 */
declare const router: import("express-serve-static-core").Router;
export default router;
