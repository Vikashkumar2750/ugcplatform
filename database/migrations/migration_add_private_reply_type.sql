-- ============================================================
-- Migration: Add private_reply to message_queue.message_type
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================
-- This fixes the CHECK constraint that was blocking Private Reply
-- DMs from being inserted into the message queue.
-- The constraint previously only allowed: 'dm', 'comment_reply', 'broadcast'
-- We now add 'private_reply' which uses recipient: { comment_id } on Meta API.
-- ============================================================

-- Step 1: Drop the old constraint
ALTER TABLE public.message_queue
  DROP CONSTRAINT IF EXISTS message_queue_message_type_check;

-- Step 2: Add new constraint with private_reply included
ALTER TABLE public.message_queue
  ADD CONSTRAINT message_queue_message_type_check
  CHECK (message_type IN ('dm', 'comment_reply', 'private_reply', 'broadcast'));

-- Verify
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.message_queue'::regclass
  AND conname = 'message_queue_message_type_check';
