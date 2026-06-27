-- Migration: Add audio_name and dm_automation_id columns to scheduled_posts
-- Run this in Supabase SQL Editor

-- Add trending audio metadata field (for Reels)
ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS audio_name TEXT DEFAULT NULL;

-- Add DM automation rule reference (links post to auto-DM on comments)
ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS dm_automation_id UUID DEFAULT NULL;

-- Add index for faster lookups on dm_automation_id
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_dm_automation 
ON scheduled_posts(dm_automation_id) 
WHERE dm_automation_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN scheduled_posts.audio_name IS 'Trending audio/song name for Reels (metadata only)';
COMMENT ON COLUMN scheduled_posts.dm_automation_id IS 'Links to automation_rules.id — triggers auto-DM when someone comments on this post';
