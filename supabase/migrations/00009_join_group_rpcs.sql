-- Migration 009: Join group RPC functions
-- Two SECURITY DEFINER RPCs for looking up and joining groups by invite code.
-- SECURITY DEFINER is required because the calling user is not yet a group member,
-- so normal RLS on the groups table would block the invite code lookup.

-- =============================================
-- LOOKUP GROUP BY INVITE CODE
-- Returns group preview info for any authenticated user with a valid invite code.
-- =============================================
CREATE OR REPLACE FUNCTION public.lookup_group_by_invite_code(
  p_invite_code TEXT
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  avatar_url TEXT,
  member_count BIGINT,
  max_members INTEGER,
  scoring_system JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_group_id UUID;
BEGIN
  -- Auth check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find group by invite code (case-insensitive)
  SELECT g.id INTO v_group_id
  FROM groups g
  WHERE LOWER(g.invite_code) = LOWER(p_invite_code);

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'group_not_found';
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.description,
    g.avatar_url,
    (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.is_active = true),
    g.max_members,
    g.scoring_system
  FROM groups g
  WHERE g.id = v_group_id;
END;
$$;

-- =============================================
-- JOIN GROUP BY CODE
-- Atomically validates and inserts a new group member.
-- Uses FOR UPDATE to prevent race conditions on max_members check.
-- =============================================
CREATE OR REPLACE FUNCTION public.join_group_by_code(
  p_invite_code TEXT
)
RETURNS TABLE(id UUID, name TEXT, invite_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_group_id UUID;
  v_group_name TEXT;
  v_invite_code TEXT;
  v_max_members INTEGER;
  v_current_count BIGINT;
  v_existing_active BOOLEAN;
  v_existing_inactive BOOLEAN;
BEGIN
  -- Auth check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the group row to prevent race conditions
  SELECT g.id, g.name, g.invite_code, g.max_members
  INTO v_group_id, v_group_name, v_invite_code, v_max_members
  FROM groups g
  WHERE LOWER(g.invite_code) = LOWER(p_invite_code)
  FOR UPDATE;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'group_not_found';
  END IF;

  -- Check if user is already an active member
  SELECT EXISTS(
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = v_group_id AND gm.user_id = v_user_id AND gm.is_active = true
  ) INTO v_existing_active;

  IF v_existing_active THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  -- Check if user is an inactive member (can rejoin)
  SELECT EXISTS(
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = v_group_id AND gm.user_id = v_user_id AND gm.is_active = false
  ) INTO v_existing_inactive;

  -- Count active members (within locked transaction)
  SELECT COUNT(*) INTO v_current_count
  FROM group_members gm
  WHERE gm.group_id = v_group_id AND gm.is_active = true;

  IF v_current_count >= v_max_members THEN
    RAISE EXCEPTION 'group_full';
  END IF;

  -- Insert or reactivate
  IF v_existing_inactive THEN
    UPDATE group_members gm
    SET is_active = true, role = 'member', joined_at = now()
    WHERE gm.group_id = v_group_id AND gm.user_id = v_user_id;
  ELSE
    INSERT INTO group_members (group_id, user_id, role, is_active)
    VALUES (v_group_id, v_user_id, 'member', true);
  END IF;

  RETURN QUERY SELECT v_group_id, v_group_name, v_invite_code;
END;
$$;
