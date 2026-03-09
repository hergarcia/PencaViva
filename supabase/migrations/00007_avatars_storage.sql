-- Create avatars storage bucket (public read, owner write)
-- NOTE: bio and avatar_url columns already exist in profiles (migration 00001)

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND name LIKE (auth.uid()::text || '/%')
  );

-- RLS: allow authenticated users to update their own avatar
CREATE POLICY "Users can update their own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE (auth.uid()::text || '/%')
  );

-- RLS: allow authenticated users to delete their own avatar
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE (auth.uid()::text || '/%')
  );

-- RLS: public read access for all avatars
CREATE POLICY "Public can view avatars"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Rollback SQL (for reference):
-- DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
-- DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'avatars';
