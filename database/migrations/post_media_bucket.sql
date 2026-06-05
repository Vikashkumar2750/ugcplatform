-- ============================================================
-- Supabase Storage Bucket for Post Media
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- Create public bucket for post media
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'post-media',
  'post-media',
  true,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/mov'],
  104857600  -- 100MB limit
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage
DROP POLICY IF EXISTS "Public read post media" ON storage.objects;
CREATE POLICY "Public read post media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');

DROP POLICY IF EXISTS "Users upload own post media" ON storage.objects;
CREATE POLICY "Users upload own post media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-media' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users delete own post media" ON storage.objects;
CREATE POLICY "Users delete own post media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'post-media' AND auth.uid() IS NOT NULL);
