-- =============================================
-- Migration 004: Fix search_path and RLS initplan warnings
-- Addresses Supabase advisor warnings:
-- 1. SECURITY: Functions without SET search_path
-- 2. PERFORMANCE: RLS policies using auth.uid() instead of (select auth.uid())
--    which causes per-row re-evaluation instead of once-per-query
-- =============================================

-- =============================================
-- FIX 1: Set search_path on functions without it
-- (process_match_result and refresh_leaderboard_cache already have it)
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION calculate_prediction_points(
  p_home_pred INTEGER,
  p_away_pred INTEGER,
  p_home_real INTEGER,
  p_away_real INTEGER,
  p_scoring JSONB
) RETURNS INTEGER AS $$
DECLARE
  points INTEGER := 0;
  pred_result INTEGER;
  real_result INTEGER;
BEGIN
  IF p_home_pred = p_home_real AND p_away_pred = p_away_real THEN
    RETURN (p_scoring->>'exact_score')::INTEGER;
  END IF;

  pred_result := SIGN(p_home_pred - p_away_pred);
  real_result := SIGN(p_home_real - p_away_real);

  IF pred_result = real_result THEN
    points := (p_scoring->>'correct_result')::INTEGER;

    IF (p_home_pred - p_away_pred) = (p_home_real - p_away_real) THEN
      points := points + (p_scoring->>'correct_goal_diff')::INTEGER;
    END IF;
  END IF;

  RETURN points;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- =============================================
-- FIX 2: Recreate all RLS policies using (select auth.uid())
-- instead of auth.uid() for optimal query performance.
-- This wraps auth.uid() in a subselect so PostgreSQL evaluates
-- it once per query instead of once per row.
-- =============================================

-- PROFILES
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING ((select auth.uid()) = id);

-- GROUPS
DROP POLICY IF EXISTS "Group members can view group" ON groups;
CREATE POLICY "Group members can view group"
  ON groups FOR SELECT
  USING (
    id IN (SELECT group_id FROM group_members WHERE user_id = (select auth.uid()))
    OR is_public = true
  );

DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;
CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS "Group admins can update group" ON groups;
CREATE POLICY "Group admins can update group"
  ON groups FOR UPDATE
  USING (
    id IN (
      SELECT group_id FROM group_members
      WHERE user_id = (select auth.uid()) AND role = 'admin'
    )
  );

-- GROUP_MEMBERS
DROP POLICY IF EXISTS "Members can view members in their groups" ON group_members;
CREATE POLICY "Members can view members in their groups"
  ON group_members FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm WHERE gm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authenticated users can join groups" ON group_members;
CREATE POLICY "Authenticated users can join groups"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can update group members" ON group_members;
CREATE POLICY "Admins can update group members"
  ON group_members FOR UPDATE
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (select auth.uid()) AND gm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can leave or admins can remove members" ON group_members;
CREATE POLICY "Users can leave or admins can remove members"
  ON group_members FOR DELETE
  USING (
    (select auth.uid()) = user_id
    OR group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (select auth.uid()) AND gm.role = 'admin'
    )
  );

-- GROUP_TOURNAMENTS
DROP POLICY IF EXISTS "Members can view group tournaments" ON group_tournaments;
CREATE POLICY "Members can view group tournaments"
  ON group_tournaments FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm WHERE gm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can manage group tournaments" ON group_tournaments;
CREATE POLICY "Admins can manage group tournaments"
  ON group_tournaments FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (select auth.uid()) AND gm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can remove group tournaments" ON group_tournaments;
CREATE POLICY "Admins can remove group tournaments"
  ON group_tournaments FOR DELETE
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (select auth.uid()) AND gm.role = 'admin'
    )
  );

-- PREDICTIONS
DROP POLICY IF EXISTS "Users can insert predictions before match starts" ON predictions;
CREATE POLICY "Users can insert predictions before match starts"
  ON predictions FOR INSERT
  WITH CHECK (
    (select auth.uid()) = user_id
    AND group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = (select auth.uid()) AND gm.is_active = true
    )
    AND (SELECT kickoff_time FROM matches WHERE id = match_id) > now()
  );

DROP POLICY IF EXISTS "Users can update own predictions before match starts" ON predictions;
CREATE POLICY "Users can update own predictions before match starts"
  ON predictions FOR UPDATE
  USING (
    (select auth.uid()) = user_id
    AND (SELECT kickoff_time FROM matches WHERE id = match_id) > now()
  );

DROP POLICY IF EXISTS "Users can view predictions in their groups" ON predictions;
CREATE POLICY "Users can view predictions in their groups"
  ON predictions FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = (select auth.uid())
    )
    AND (
      user_id = (select auth.uid())
      OR (SELECT kickoff_time FROM matches WHERE id = match_id) <= now()
    )
  );

-- LEADERBOARD_CACHE
DROP POLICY IF EXISTS "Group members can view leaderboard" ON leaderboard_cache;
CREATE POLICY "Group members can view leaderboard"
  ON leaderboard_cache FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm WHERE gm.user_id = (select auth.uid())
    )
  );

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING ((select auth.uid()) = user_id);
