-- Migration: Add 'comment_automation' to automation_rules type check constraint
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing check constraint
ALTER TABLE automation_rules DROP CONSTRAINT IF EXISTS automation_rules_type_check;

-- Step 2: Re-create with all types including the new unified 'comment_automation'
ALTER TABLE automation_rules ADD CONSTRAINT automation_rules_type_check CHECK (
  type IN (
    'dm_keyword',
    'dm_new_follower',
    'story_reply',
    'story_mention',
    'comment_to_dm',
    'comment_reply',
    'comment_auto_reply',
    'comment_automation',
    'hide_comment',
    'ice_breaker',
    'ai_auto_reply',
    'drip_sequence',
    'conditional_flow',
    'lead_capture',
    'broadcast'
  )
);
