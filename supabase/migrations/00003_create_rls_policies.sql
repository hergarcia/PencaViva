-- =============================================
-- Migration 003: Row Level Security Policies
-- PencaViva - Social Sports Predictions
-- =============================================

-- =============================================
-- PROFILES RLS
-- Public read, self-write only.
-- INSERT policy added (not in PLAN_MAESTRO.md) for profile creation
-- flow before the auto-create trigger (F1-05) is implemented.
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- =============================================
-- TOURNAMENTS RLS
-- Read-only for authenticated users.
-- Writes managed by service_role (Edge Functions / admin).
-- =============================================
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournaments are viewable by authenticated users"
  ON tournaments FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- MATCHES RLS
-- Read-only for authenticated users.
-- Writes managed by service_role (match-sync Edge Function).
-- =============================================
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matches are viewable by authenticated users"
  ON matches FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- GROUPS RLS
-- Members can view their groups. Public groups visible to all authenticated.
-- Admins can update. Authenticated users can create (become admin).
-- INSERT policy added (not in PLAN_MAESTRO.md) for group creation.
-- =============================================
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view group"
  ON groups FOR SELECT
  USING (
    id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    OR is_public = true
  );

CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update group"
  ON groups FOR UPDATE
  USING (
    id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- GROUP_MEMBERS RLS
-- Members can see other members in their groups.
-- Authenticated users can join (insert themselves).
-- Admins can update roles. Admins can remove; users can leave.
-- =============================================
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view members in their groups"
  ON group_members FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can join groups"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update group members"
  ON group_members FOR UPDATE
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE POLICY "Users can leave or admins can remove members"
  ON group_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

-- =============================================
-- GROUP_TOURNAMENTS RLS
-- Members can see their group's tournaments.
-- Admins can assign/remove tournaments.
-- =============================================
ALTER TABLE group_tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view group tournaments"
  ON group_tournaments FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage group tournaments"
  ON group_tournaments FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE POLICY "Admins can remove group tournaments"
  ON group_tournaments FOR DELETE
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

-- =============================================
-- PREDICTIONS RLS
-- Insert/update only before kickoff, for own predictions, in own groups.
-- View own predictions always; view others' after kickoff (within group).
-- Group membership check on INSERT/UPDATE per reviewer recommendation.
-- =============================================
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert predictions before match starts"
  ON predictions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.is_active = true
    )
    AND (SELECT kickoff_time FROM matches WHERE id = match_id) > now()
  );

CREATE POLICY "Users can update own predictions before match starts"
  ON predictions FOR UPDATE
  USING (
    auth.uid() = user_id
    AND (SELECT kickoff_time FROM matches WHERE id = match_id) > now()
  );

CREATE POLICY "Users can view predictions in their groups"
  ON predictions FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR (SELECT kickoff_time FROM matches WHERE id = match_id) <= now()
    )
  );

-- =============================================
-- LEADERBOARD_CACHE RLS
-- Read-only for group members. Writes done by SECURITY DEFINER
-- functions (process_match_result / refresh_leaderboard_cache).
-- =============================================
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view leaderboard"
  ON leaderboard_cache FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()
    )
  );

-- =============================================
-- NOTIFICATIONS RLS
-- Users can only see and mark-as-read their own notifications.
-- Inserts done by service_role (Edge Functions).
-- =============================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
