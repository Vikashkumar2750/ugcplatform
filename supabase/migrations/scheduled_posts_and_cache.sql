-- ============================================================
-- Scheduled Posts + Insights Daily Cache
-- Safe to run multiple times (idempotent)
-- ============================================================

-- Scheduled posts table
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  caption         TEXT NOT NULL,
  first_comment   TEXT,
  media_url       TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  status          TEXT DEFAULT 'scheduled'
                    CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  published_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user ON public.scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due  ON public.scheduled_posts(scheduled_at, status)
  WHERE status = 'scheduled';

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own posts" ON public.scheduled_posts;
CREATE POLICY "Users manage own posts"
  ON public.scheduled_posts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Insights daily cache table
CREATE TABLE IF NOT EXISTS public.insights_cache (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,
  data            JSONB NOT NULL,
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, platform)
);

ALTER TABLE public.insights_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own cache" ON public.insights_cache;
CREATE POLICY "Users manage own cache"
  ON public.insights_cache FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
