-- ============================================================
-- Insight Tasks System
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Tasks table (current period tasks)
CREATE TABLE IF NOT EXISTS public.insight_tasks (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,                       -- 'instagram' | 'facebook'
  title           TEXT NOT NULL,
  description     TEXT,
  type            TEXT CHECK (type IN ('weekly', 'monthly')),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  period_key      TEXT NOT NULL,                       -- 'YYYY-MM' monthly | 'YYYY-WNN' weekly
  auto_generated  BOOLEAN DEFAULT true,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Task history (archived at month-end, keep 3 months)
CREATE TABLE IF NOT EXISTS public.insight_task_history (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform        TEXT,
  period_key      TEXT NOT NULL,
  tasks_total     INT DEFAULT 0,
  tasks_done      INT DEFAULT 0,
  tasks_skipped   INT DEFAULT 0,
  snapshot        JSONB,         -- insights data at end of period
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insight_tasks_user ON public.insight_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_insight_tasks_period ON public.insight_tasks(user_id, platform, period_key);
CREATE INDEX IF NOT EXISTS idx_insight_task_history_user ON public.insight_task_history(user_id, platform);

-- RLS
ALTER TABLE public.insight_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_task_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tasks"
  ON public.insight_tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own history"
  ON public.insight_task_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
