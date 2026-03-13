-- Migration 008: create_group_for_user RPC function
-- Replaces direct groups INSERT (which fails RLS with ES256 JWT tokens)
-- with a SECURITY DEFINER function that handles auth check internally.

CREATE OR REPLACE FUNCTION public.create_group_for_user(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_scoring_system JSONB DEFAULT '{"exact_score":5,"correct_result":3,"correct_goal_diff":1,"wrong":0}'::jsonb,
  p_tournament_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(id UUID, name TEXT, invite_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_group_id UUID;
  v_invite_code TEXT;
  v_group_name TEXT;
BEGIN
  -- Get the calling user's ID from JWT
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify profile exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = v_user_id) THEN
    RAISE EXCEPTION 'Profile not found for user %', v_user_id;
  END IF;

  -- Insert group
  INSERT INTO groups (name, description, created_by, scoring_system, max_members, is_public)
  VALUES (
    trim(p_name),
    NULLIF(trim(COALESCE(p_description, '')), ''),
    v_user_id,
    p_scoring_system,
    50,
    false
  )
  RETURNING groups.id, groups.invite_code, groups.name
  INTO v_group_id, v_invite_code, v_group_name;

  -- Insert creator as admin member
  INSERT INTO group_members (group_id, user_id, role, is_active)
  VALUES (v_group_id, v_user_id, 'admin', true);

  -- Link tournaments if provided
  IF p_tournament_ids IS NOT NULL AND array_length(p_tournament_ids, 1) > 0 THEN
    INSERT INTO group_tournaments (group_id, tournament_id)
    SELECT v_group_id, unnest(p_tournament_ids);
  END IF;

  RETURN QUERY SELECT v_group_id, v_group_name, v_invite_code;
END;
$$;
