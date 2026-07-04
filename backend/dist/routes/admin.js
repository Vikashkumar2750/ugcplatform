"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All admin routes require auth + admin email
router.use(auth_1.requireAuth, auth_1.requireAdmin);
// GET /api/admin/users — list all users with platform API status + usage
router.get("/users", async (_req, res) => {
    const { data: profiles, error } = await supabase_1.supabase
        .from("profiles")
        .select("id, email, full_name, platform_api_allowed, platform_api_disabled_reason, created_at")
        .order("created_at", { ascending: false });
    if (error)
        return res.status(500).json({ error: error.message });
    // Get this month's platform API usage per user
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { data: usageLogs } = await supabase_1.supabase
        .from("api_usage_logs")
        .select("user_id, tokens_total, key_source")
        .eq("key_source", "platform")
        .gte("created_at", startOfMonth.toISOString());
    const usageByUser = {};
    for (const log of usageLogs || []) {
        usageByUser[log.user_id] = (usageByUser[log.user_id] || 0) + (log.tokens_total || 0);
    }
    const enriched = (profiles || []).map((p) => ({
        ...p,
        platform_tokens_this_month: usageByUser[p.id] || 0,
    }));
    return res.json({ users: enriched });
});
// PATCH /api/admin/users/:id/platform-api — toggle platform API access
router.patch("/users/:id/platform-api", async (req, res) => {
    const { id } = req.params;
    const { allowed, reason } = req.body;
    if (typeof allowed !== "boolean") {
        return res.status(400).json({ error: "allowed (boolean) is required" });
    }
    const { error } = await supabase_1.supabase
        .from("profiles")
        .update({
        platform_api_allowed: allowed,
        platform_api_disabled_reason: allowed ? null : (reason || "Disabled by admin"),
    })
        .eq("id", id);
    if (error)
        return res.status(500).json({ error: error.message });
    return res.json({ success: true, userId: id, platform_api_allowed: allowed });
});
exports.default = router;
//# sourceMappingURL=admin.js.map