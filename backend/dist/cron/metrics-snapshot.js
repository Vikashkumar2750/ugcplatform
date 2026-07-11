"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapshotDailyMetrics = snapshotDailyMetrics;
const supabase_1 = require("../lib/supabase");
async function snapshotDailyMetrics() {
    console.log("[Cron] Starting daily metrics snapshot...");
    try {
        // 1. Fetch all active Instagram accounts
        const { data: accounts, error } = await supabase_1.supabase
            .from("connected_accounts")
            .select("*")
            .eq("platform", "instagram")
            .eq("is_active", true);
        if (error)
            throw error;
        if (!accounts || accounts.length === 0) {
            console.log("[Cron] No active accounts found.");
            return;
        }
        console.log(`[Cron] Found ${accounts.length} active accounts.`);
        const today = new Date().toISOString().split("T")[0];
        // We can chunk by 50 for the Meta Batch API
        for (let i = 0; i < accounts.length; i += 50) {
            const chunk = accounts.slice(i, i + 50);
            // We actually need the access token of each user to query their profile.
            // Wait, Meta Batch API requires a single access token for the batch?
            // Yes, usually you can't mix access tokens in a single batch request unless it's an app access token.
            // Since each account has its own token, we will just fetch them individually or use Promise.all with concurrency control.
            const promises = chunk.map(async (account) => {
                try {
                    const profileUrl = `https://graph.facebook.com/v21.0/${account.platform_user_id}?fields=followers_count,follows_count,media_count&access_token=${account.access_token}`;
                    const res = await fetch(profileUrl);
                    const data = await res.json();
                    if (data.error) {
                        console.error(`[Cron] Error fetching account ${account.id}:`, data.error.message);
                        return null;
                    }
                    return {
                        account,
                        followers_count: data.followers_count || 0,
                        follows_count: data.follows_count || 0,
                        media_count: data.media_count || 0
                    };
                }
                catch (err) {
                    console.error(`[Cron] Error processing account ${account.id}:`, err);
                    return null;
                }
            });
            const results = await Promise.all(promises);
            // Now insert into daily_account_metrics
            for (const result of results) {
                if (!result)
                    continue;
                const { account, followers_count, follows_count, media_count } = result;
                // Fetch yesterday's data to calculate net change
                const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
                const { data: prevData } = await supabase_1.supabase
                    .from("daily_account_metrics")
                    .select("follower_count")
                    .eq("connected_account_id", account.id)
                    .eq("date", yesterday)
                    .single();
                const prevFollowers = prevData?.follower_count || followers_count; // If no prev, change is 0
                const net_followers_change = followers_count - prevFollowers;
                const { error: upsertError } = await supabase_1.supabase
                    .from("daily_account_metrics")
                    .upsert({
                    user_id: account.user_id,
                    connected_account_id: account.id,
                    platform: account.platform,
                    date: today,
                    follower_count: followers_count,
                    following_count: follows_count,
                    media_count: media_count,
                    net_followers_change: net_followers_change
                }, { onConflict: "connected_account_id,date" });
                if (upsertError) {
                    console.error(`[Cron] DB Upsert error for ${account.id}:`, upsertError.message);
                }
            }
        }
        console.log("[Cron] Daily metrics snapshot completed successfully.");
    }
    catch (err) {
        console.error("[Cron] Snapshot failed:", err);
    }
}
//# sourceMappingURL=metrics-snapshot.js.map