-- =============================================
-- Migration 002: Functions and Triggers
-- PencaViva - Social Sports Predictions
-- =============================================

-- =============================================
-- FUNCTION: update_updated_at_column
-- Generic trigger function to auto-set updated_at on row update.
-- Applied to all 5 tables with an updated_at column:
--   profiles, matches, groups, predictions, leaderboard_cache
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_matches
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_groups
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_predictions
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_leaderboard_cache
  BEFORE UPDATE ON leaderboard_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCTION: calculate_prediction_points
-- Pure scoring calculation. IMMUTABLE (same inputs = same output).
-- Scoring logic from PLAN_MAESTRO.md section 4.3.
-- =============================================
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
  -- Exact score match
  IF p_home_pred = p_home_real AND p_away_pred = p_away_real THEN
    RETURN (p_scoring->>'exact_score')::INTEGER;
  END IF;

  -- Determine result direction (1=home win, 0=draw, -1=away win)
  pred_result := SIGN(p_home_pred - p_away_pred);
  real_result := SIGN(p_home_real - p_away_real);

  -- Correct result (who wins / draw)
  IF pred_result = real_result THEN
    points := (p_scoring->>'correct_result')::INTEGER;

    -- Bonus: correct goal difference
    IF (p_home_pred - p_away_pred) = (p_home_real - p_away_real) THEN
      points := points + (p_scoring->>'correct_goal_diff')::INTEGER;
    END IF;
  END IF;

  RETURN points;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- FUNCTION: refresh_leaderboard_cache
-- Recalculates leaderboard rankings for all groups that had predictions
-- on the given match. Uses aggregation + UPSERT + RANK().
--
-- SECURITY DEFINER + SET search_path: This function is called from
-- process_match_result() which runs as a trigger. It must INSERT/UPDATE
-- rows in leaderboard_cache for ALL users in affected groups. Without
-- SECURITY DEFINER, RLS would restrict writes to only the triggering user.
-- search_path is hardened to prevent search_path injection attacks.
--
-- NOTE: This function is referenced in PLAN_MAESTRO.md but not defined
-- there. Implementation follows the documented leaderboard architecture.
-- =============================================
CREATE OR REPLACE FUNCTION refresh_leaderboard_cache(p_match_id UUID)
RETURNS VOID AS $$
DECLARE
  v_tournament_id UUID;
BEGIN
  -- Get the tournament for this match
  SELECT tournament_id INTO v_tournament_id
  FROM matches WHERE id = p_match_id;

  IF v_tournament_id IS NULL THEN
    RETURN;
  END IF;

  -- Recalculate stats for every (group, user) with predictions in
  -- this tournament, scoped to groups that had predictions for this match.
  INSERT INTO leaderboard_cache (
    group_id, tournament_id, user_id,
    total_points, matches_played, exact_scores, correct_results,
    position, updated_at
  )
  SELECT
    sub.group_id,
    sub.tournament_id,
    sub.user_id,
    sub.total_points,
    sub.matches_played,
    sub.exact_scores,
    sub.correct_results,
    sub.position,
    now()
  FROM (
    SELECT
      p.group_id,
      m.tournament_id,
      p.user_id,
      COALESCE(SUM(p.points), 0) AS total_points,
      COUNT(*) FILTER (WHERE p.points IS NOT NULL) AS matches_played,
      COUNT(*) FILTER (
        WHERE p.points = (g.scoring_system->>'exact_score')::INTEGER
      ) AS exact_scores,
      COUNT(*) FILTER (
        WHERE p.points >= (g.scoring_system->>'correct_result')::INTEGER
          AND p.points < (g.scoring_system->>'exact_score')::INTEGER
      ) AS correct_results,
      RANK() OVER (
        PARTITION BY p.group_id, m.tournament_id
        ORDER BY COALESCE(SUM(p.points), 0) DESC
      ) AS position
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    JOIN groups g ON g.id = p.group_id
    WHERE m.tournament_id = v_tournament_id
      AND p.group_id IN (
        SELECT DISTINCT pred.group_id
        FROM predictions pred
        WHERE pred.match_id = p_match_id
      )
    GROUP BY p.group_id, m.tournament_id, p.user_id, g.scoring_system
  ) sub
  ON CONFLICT (group_id, tournament_id, user_id)
  DO UPDATE SET
    total_points = EXCLUDED.total_points,
    matches_played = EXCLUDED.matches_played,
    exact_scores = EXCLUDED.exact_scores,
    correct_results = EXCLUDED.correct_results,
    position = EXCLUDED.position,
    updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- FUNCTION: process_match_result (TRIGGER)
-- Fires when a match status changes to 'finished'.
-- Calculates points for ALL predictions on the match, then refreshes
-- the leaderboard cache.
--
-- SECURITY DEFINER + SET search_path: The trigger executes in the context
-- of the user who updated the match row (typically service_role via Edge
-- Function). It must UPDATE predictions.points for ALL users who predicted
-- on this match, across all groups. Without SECURITY DEFINER, RLS on
-- predictions would restrict the UPDATE to only the triggering user's
-- own predictions.
--
-- NOTE on re-scoring: No "AND p.points IS NULL" filter is used, so that
-- re-triggering (e.g., after a score correction) recalculates all
-- predictions. To correct a match result: update scores, set status to
-- a non-finished value, then back to 'finished' to re-trigger.
-- =============================================
CREATE OR REPLACE FUNCTION process_match_result()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'finished' AND OLD.status != 'finished' THEN
    -- Calculate points for ALL predictions on this match
    UPDATE predictions p
    SET points = calculate_prediction_points(
      p.home_score_pred,
      p.away_score_pred,
      NEW.home_score,
      NEW.away_score,
      (SELECT scoring_system FROM groups WHERE id = p.group_id)
    ),
    updated_at = now()
    WHERE p.match_id = NEW.id;

    -- Refresh leaderboard cache for affected groups
    PERFORM refresh_leaderboard_cache(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_match_result_update
  AFTER UPDATE ON matches
  FOR EACH ROW
  WHEN (NEW.status = 'finished' AND OLD.status != 'finished')
  EXECUTE FUNCTION process_match_result();
