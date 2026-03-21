import { supabase } from "@lib/supabase";

// ── Types ───────────────────────────────────────────────────────────

export type LeaderboardEntry = {
  id: string;
  group_id: string;
  user_id: string;
  total_points: number;
  position: number;
  matches_played: number;
  exact_scores: number;
  correct_results: number;
  // Joined from profiles
  display_name: string;
  username: string;
  avatar_url: string | null;
};

// ── Service function ─────────────────────────────────────────────────

/**
 * Fetch the overall leaderboard for a group (tournament_id IS NULL).
 * Joins with profiles to get user display info.
 * Ordered by position ascending (1st = top).
 */
export async function fetchGroupLeaderboard(
  groupId: string,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard_cache")
    .select(
      `
      id, group_id, user_id, total_points, position,
      matches_played, exact_scores, correct_results,
      profile:profiles!user_id ( display_name, username, avatar_url )
    `,
    )
    .eq("group_id", groupId)
    .is("tournament_id", null)
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);

  type RawEntry = {
    id: string;
    group_id: string;
    user_id: string;
    total_points: number;
    position: number;
    matches_played: number;
    exact_scores: number;
    correct_results: number;
    profile: {
      display_name: string;
      username: string;
      avatar_url: string | null;
    };
  };

  return ((data ?? []) as unknown as RawEntry[]).map((row) => ({
    id: row.id,
    group_id: row.group_id,
    user_id: row.user_id,
    total_points: row.total_points,
    position: row.position,
    matches_played: row.matches_played,
    exact_scores: row.exact_scores,
    correct_results: row.correct_results,
    display_name: row.profile.display_name,
    username: row.profile.username,
    avatar_url: row.profile.avatar_url,
  }));
}
