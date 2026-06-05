import { Router, Response } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// GET /api/credits — token usage summary for current user
router.get("/", async (req, res: Response) => {
  const { userId } = req as AuthenticatedRequest;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("api_usage_logs")
    .select("provider, endpoint, key_source, tokens_total, cost_usd, created_at")
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Aggregate by provider
  const byProvider: Record<
    string,
    { tokens: number; cost: number; calls: number }
  > = {};

  for (const row of data || []) {
    if (!byProvider[row.provider]) {
      byProvider[row.provider] = { tokens: 0, cost: 0, calls: 0 };
    }
    byProvider[row.provider].tokens += row.tokens_total || 0;
    byProvider[row.provider].cost += Number(row.cost_usd) || 0;
    byProvider[row.provider].calls += 1;
  }

  return res.json({
    period: "last_30_days",
    by_provider: byProvider,
    recent: data?.slice(0, 50) || [],
  });
});

export default router;
