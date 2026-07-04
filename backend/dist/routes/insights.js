"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
// GET /api/insights/:platform/:accountId
// Proxy for Meta Graph API insights — keeps access tokens server-side
router.get("/:platform/:accountId", async (req, res) => {
    const { platform, accountId } = req.params;
    const { userId } = req;
    const { metric, period } = req.query;
    if (platform !== "instagram" && platform !== "facebook") {
        return res.status(400).json({ error: "Unsupported platform" });
    }
    const { data: account, error: accountError } = await supabase_1.supabase
        .from("connected_accounts")
        .select("access_token")
        .eq("platform_user_id", accountId)
        .eq("user_id", userId)
        .single();
    if (accountError || !account) {
        return res.status(404).json({ error: "Connected account not found" });
    }
    const fields = metric || "impressions,reach,profile_views,follower_count";
    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const until = Math.floor(Date.now() / 1000);
    const apiUrl = `https://graph.facebook.com/v21.0/${accountId}/insights` +
        `?metric=${fields}` +
        `&period=${period || "day"}` +
        `&since=${since}&until=${until}` +
        `&access_token=${account.access_token}`;
    const igRes = await fetch(apiUrl);
    const data = await igRes.json();
    if (data.error) {
        return res.status(400).json({ error: data.error.message });
    }
    return res.json(data);
});
exports.default = router;
//# sourceMappingURL=insights.js.map