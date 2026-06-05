-- ============================================================
-- Schema V2: Connected Accounts, Automation, Scheduling
-- Run AFTER schema.sql
-- ============================================================

-- ============================================================
-- Table: connected_accounts
-- OAuth tokens for Instagram, Facebook, YouTube
-- ============================================================
CREATE TABLE IF NOT EXISTS public.connected_accounts (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'youtube')),
  platform_user_id  TEXT NOT NULL,
  platform_username TEXT,
  platform_name     TEXT,
  avatar_url        TEXT,
  access_token      TEXT NOT NULL,  -- stored encrypted via pgcrypto
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,
  permissions       TEXT[],  -- scopes granted by user
  page_id           TEXT,    -- for Facebook Pages
  page_name         TEXT,
  account_type      TEXT,    -- 'BUSINESS' | 'CREATOR' | 'PERSONAL'
  is_active         BOOLEAN DEFAULT true,
  connected_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, platform_user_id)
);

-- ============================================================
-- Table: automation_rules
-- DM automation, comment automation rules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id      UUID REFERENCES public.connected_accounts(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('dm_keyword', 'dm_new_follower', 'comment_reply', 'comment_to_dm', 'story_reply')),
  name            TEXT NOT NULL,
  trigger_config  JSONB NOT NULL DEFAULT '{}',
  -- dm_keyword: { keywords: [], match_type: 'any'|'all'|'exact', case_sensitive: false }
  -- comment_reply: { keywords: [], reply_text: '', hide_comment: false }
  -- comment_to_dm: { keywords: [], dm_message: '', dm_link: '' }
  action_config   JSONB NOT NULL DEFAULT '{}',
  -- { message: '', attachment_url: '', link: '', delay_seconds: 0, buttons: [] }
  is_active       BOOLEAN DEFAULT true,
  trigger_count   INTEGER DEFAULT 0,
  last_triggered  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: scheduled_posts
-- Post scheduler across all platforms
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id       UUID REFERENCES public.connected_accounts(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL,
  content_type     TEXT NOT NULL CHECK (content_type IN ('feed', 'reel', 'story', 'carousel', 'youtube_video', 'facebook_post')),
  caption          TEXT,
  hashtags         TEXT[],
  media_urls       TEXT[],       -- Supabase storage URLs
  media_types      TEXT[],       -- 'IMAGE' | 'VIDEO'
  thumbnail_url    TEXT,         -- for videos
  first_comment    TEXT,         -- post hashtags in first comment (best practice)
  location_name    TEXT,
  location_id      TEXT,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  published_at     TIMESTAMPTZ,
  platform_post_id TEXT,         -- ID returned after publish
  status           TEXT DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  error_message    TEXT,
  retry_count      INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: webhook_events
-- All incoming Meta/Google webhook events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  platform      TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  sender_id     TEXT,
  recipient_id  TEXT,
  payload       JSONB NOT NULL,
  rule_matched  UUID REFERENCES public.automation_rules(id),
  processed     BOOLEAN DEFAULT false,
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: dm_conversations
-- Store DM threads for context
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id      UUID REFERENCES public.connected_accounts(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL,     -- external user's platform ID
  sender_name     TEXT,
  sender_username TEXT,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  message_count   INTEGER DEFAULT 0,
  is_automated    BOOLEAN DEFAULT false,
  opted_out       BOOLEAN DEFAULT false,  -- REQUIRED by Meta: respect opt-outs
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user ON public.connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_platform ON public.connected_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_automation_rules_user ON public.automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_account ON public.automation_rules(account_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON public.automation_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user ON public.scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled ON public.scheduled_posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_dm_conversations_account ON public.dm_conversations(account_id);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;

-- connected_accounts
CREATE POLICY "Users manage own accounts" ON public.connected_accounts
  FOR ALL USING (auth.uid() = user_id);

-- automation_rules
CREATE POLICY "Users manage own rules" ON public.automation_rules
  FOR ALL USING (auth.uid() = user_id);

-- scheduled_posts
CREATE POLICY "Users manage own posts" ON public.scheduled_posts
  FOR ALL USING (auth.uid() = user_id);

-- webhook_events: only service role
CREATE POLICY "Service role manages webhooks" ON public.webhook_events
  FOR ALL USING (false);

-- dm_conversations
CREATE POLICY "Users view own conversations" ON public.dm_conversations
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Triggers: updated_at
-- ============================================================
CREATE TRIGGER connected_accounts_updated_at
  BEFORE UPDATE ON public.connected_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER scheduled_posts_updated_at
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
