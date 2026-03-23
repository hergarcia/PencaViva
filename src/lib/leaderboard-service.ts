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

// ── Overall leaderboard (from leaderboard_cache) ─────────────────────

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

export type LeaderboardFilter = "overall" | "week" | "month";

// ── Date-range leaderboard (from raw predictions) ─────────────────────

/**
 * Fetch a leaderboard for a group filtered to matches within a date range.
 * Queries predictions directly and aggregates client-side.
 * Position is assigned by total_points descending.
 *
 * NOTE: Client-side aggregation is acceptable for MVP scale (<50 members,
 * <100 matches). Migration path: server-side RPC with GROUP BY when scale
 * requires it.
 */
export async function fetchGroupLeaderboardByDateRange(
  groupId: string,
  from: string,
): Promise<LeaderboardEntry[]> {
  const now = new Date().toISOString();

  // Step 1: Get IDs of finished matches in the date range
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "finished")
    .gte("kickoff_time", from)
    .lte("kickoff_time", now);

  if (matchesError) throw new Error(matchesError.message);
  if (!matches || matches.length === 0) return [];

  const matchIds = matches.map((m: { id: string }) => m.id);

  // Step 2: Get scored predictions for those matches in this group
  type RawPrediction = {
    user_id: string;
    points: number;
    profile: {
      display_name: string;
      username: string;
      avatar_url: string | null;
    };
  };

  const { data: predictions, error: predsError } = await supabase
    .from("predictions")
    .select(
      `user_id, points, profile:profiles!user_id ( display_name, username, avatar_url )`,
    )
    .eq("group_id", groupId)
    .in("match_id", matchIds)
    .not("points", "is", null);

  if (predsError) throw new Error(predsError.message);
  if (!predictions || predictions.length === 0) return [];

  // Step 3: Aggregate by user
  const userMap = new Map<
    string,
    {
      total_points: number;
      matches_played: number;
      display_name: string;
      username: string;
      avatar_url: string | null;
    }
  >();

  for (const pred of predictions as unknown as RawPrediction[]) {
    const existing = userMap.get(pred.user_id);
    if (existing) {
      existing.total_points += pred.points;
      existing.matches_played += 1;
    } else {
      userMap.set(pred.user_id, {
        total_points: pred.points,
        matches_played: 1,
        display_name: pred.profile.display_name,
        username: pred.profile.username,
        avatar_url: pred.profile.avatar_url,
      });
    }
  }

  // Step 4: Sort and assign positions
  const sorted = Array.from(userMap.entries())
    .map(([userId, data]) => ({
      id: `${groupId}:${userId}:range`,
      group_id: groupId,
      user_id: userId,
      total_points: data.total_points,
      position: 0,
      matches_played: data.matches_played,
      exact_scores: 0, // Not available from predictions table; always 0 for date-range views
      correct_results: 0, // LeaderboardRow handles this by showing "N matches played" when both are 0
      display_name: data.display_name,
      username: data.username,
      avatar_url: data.avatar_url,
    }))
    .sort((a, b) => b.total_points - a.total_points);

  sorted.forEach((entry, idx) => {
    entry.position = idx + 1;
  });

  return sorted;
}

// ── Filter dispatcher ──────────────────────────────────────────────────

function getFromDate(filter: LeaderboardFilter): string | null {
  if (filter === "overall") return null;
  const now = Date.now();
  const days = filter === "week" ? 7 : 30;
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function fetchGroupLeaderboardFiltered(
  groupId: string,
  filter: LeaderboardFilter,
): Promise<LeaderboardEntry[]> {
  const from = getFromDate(filter);
  if (from === null) return fetchGroupLeaderboard(groupId);
  return fetchGroupLeaderboardByDateRange(groupId, from);
}
