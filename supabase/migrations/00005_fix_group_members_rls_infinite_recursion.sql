-- =============================================
-- Migration 005: Fix group_members RLS infinite recursion
-- =============================================
-- Problem: group_members SELECT policy queries group_members itself,
-- causing "infinite recursion detected in policy for relation group_members"
-- when any RLS policy on any table checks group membership.
--
-- Solution: Create SECURITY DEFINER helper functions that bypass RLS
-- to look up the current user's group memberships. Replace all
-- self-referencing subqueries in policies with calls to these functions.
-- =============================================

-- =============================================
-- 1. Create SECURITY DEFINER helper functions
-- These run as the function owner (postgres), bypassing RLS.
-- STABLE: results don't change within the same statement.
-- =============================================

CREATE OR REPLACE FUNCTION public.get_user_group_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT group_id
  FROM public.group_members
  WHERE user_id = (select auth.uid())
    AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.get_user_admin_group_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT group_id
  FROM public.group_members
  WHERE user_id = (select auth.uid())
    AND role = 'admin'
    AND is_active = true;
$$;

-- =============================================
-- 2. Recreate policies on groups
-- =============================================

DROP POLICY IF EXISTS "Group members can view group" ON groups;
CREATE POLICY "Group members can view group"
  ON groups FOR SELECT
  USING (
    id IN (SELECT get_user_group_ids())
    OR is_public = true
  );

DROP POLICY IF EXISTS "Group admins can update group" ON groups;
CREATE POLICY "Group admins can update group"
  ON groups FOR UPDATE
  USING (
    id IN (SELECT get_user_admin_group_ids())
  );

-- =============================================
-- 3. Recreate policies on group_members (the root cause)
-- =============================================

DROP POLICY IF EXISTS "Members can view members in their groups" ON group_members;
CREATE POLICY "Members can view members in their groups"
  ON group_members FOR SELECT
  USING (
    group_id IN (SELECT get_user_group_ids())
  );

DROP POLICY IF EXISTS "Admins can update group members" ON group_members;
CREATE POLICY "Admins can update group members"
  ON group_members FOR UPDATE
  USING (
    group_id IN (SELECT get_user_admin_group_ids())
  );

DROP POLICY IF EXISTS "Users can leave or admins can remove members" ON group_members;
CREATE POLICY "Users can leave or admins can remove members"
  ON group_members FOR DELETE
  USING (
    (select auth.uid()) = user_id
    OR group_id IN (SELECT get_user_admin_group_ids())
  );

-- =============================================
-- 4. Recreate policies on group_tournaments
-- =============================================

DROP POLICY IF EXISTS "Members can view group tournaments" ON group_tournaments;
CREATE POLICY "Members can view group tournaments"
  ON group_tournaments FOR SELECT
  USING (
    group_id IN (SELECT get_user_group_ids())
  );

DROP POLICY IF EXISTS "Admins can manage group tournaments" ON group_tournaments;
CREATE POLICY "Admins can manage group tournaments"
  ON group_tournaments FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id IN (SELECT get_user_admin_group_ids())
  );

DROP POLICY IF EXISTS "Admins can remove group tournaments" ON group_tournaments;
CREATE POLICY "Admins can remove group tournaments"
  ON group_tournaments FOR DELETE
  USING (
    group_id IN (SELECT get_user_admin_group_ids())
  );

-- =============================================
-- 5. Recreate policies on predictions
-- =============================================

DROP POLICY IF EXISTS "Users can insert predictions before match starts" ON predictions;
CREATE POLICY "Users can insert predictions before match starts"
  ON predictions FOR INSERT
  WITH CHECK (
    (select auth.uid()) = user_id
    AND group_id IN (SELECT get_user_group_ids())
    AND (SELECT kickoff_time FROM matches WHERE id = match_id) > now()
  );

DROP POLICY IF EXISTS "Users can view predictions in their groups" ON predictions;
CREATE POLICY "Users can view predictions in their groups"
  ON predictions FOR SELECT
  USING (
    group_id IN (SELECT get_user_group_ids())
    AND (
      user_id = (select auth.uid())
      OR (SELECT kickoff_time FROM matches WHERE id = match_id) <= now()
    )
  );

-- =============================================
-- 6. Recreate policies on leaderboard_cache
-- =============================================

DROP POLICY IF EXISTS "Group members can view leaderboard" ON leaderboard_cache;
CREATE POLICY "Group members can view leaderboard"
  ON leaderboard_cache FOR SELECT
  USING (
    group_id IN (SELECT get_user_group_ids())
  );
