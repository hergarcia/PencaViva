import { supabase } from "@lib/supabase";

// ── Types ───────────────────────────────────────────────────────────

export type LeaderboardFilter = "overall" | "week" | "month";

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

// ── Date-range leaderboard (from raw predictions) ─────────────────────

/**
 * Fetch a leaderboard for a group filtered to matches within a date range.
 * Queries predictions directly and aggregates client-side.
 * Position is assigned by total_points descending.
 */
export async function fetchGroupLeaderboardByDateRange(
  groupId: string,
  from: string, // ISO timestamp (start of range)
): Promise<LeaderboardEntry[]> {
  const now = new Date().toISOString();

  // Step 1: Get match IDs with kickoff within the date range
  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .select("id")
    .gte("kickoff_time", from)
    .lte("kickoff_time", now);

  if (matchError) throw new Error(matchError.message);
  if (!matches || matches.length === 0) return [];

  const matchIds = (matches as { id: string }[]).map((m) => m.id);

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

  const { data: predictions, error: predError } = await supabase
    .from("predictions")
    .select(
      `user_id, points, profile:profiles!user_id ( display_name, username, avatar_url )`,
    )
    .eq("group_id", groupId)
    .in("match_id", matchIds)
    .not("points", "is", null);

  if (predError) throw new Error(predError.message);

  // Step 3: Aggregate by user_id client-side
  const aggregated = new Map<
    string,
    {
      user_id: string;
      total_points: number;
      matches_played: number;
      display_name: string;
      username: string;
      avatar_url: string | null;
    }
  >();

  for (const pred of (predictions ?? []) as unknown as RawPrediction[]) {
    const existing = aggregated.get(pred.user_id);
    if (existing) {
      existing.total_points += pred.points;
      existing.matches_played += 1;
    } else {
      aggregated.set(pred.user_id, {
        user_id: pred.user_id,
        total_points: pred.points,
        matches_played: 1,
        display_name: pred.profile.display_name,
        username: pred.profile.username,
        avatar_url: pred.profile.avatar_url,
      });
    }
  }

  // Step 4: Sort by total_points DESC and assign positions
  const sorted = Array.from(aggregated.values()).sort(
    (a, b) => b.total_points - a.total_points,
  );

  return sorted.map((entry, idx) => ({
    id: `${groupId}:${entry.user_id}:range`, // synthetic id for filtered views
    group_id: groupId,
    user_id: entry.user_id,
    total_points: entry.total_points,
    position: idx + 1,
    matches_played: entry.matches_played,
    exact_scores: 0, // not available in predictions table
    correct_results: 0, // not available in predictions table
    display_name: entry.display_name,
    username: entry.username,
    avatar_url: entry.avatar_url,
  }));
}

// ── Filter dispatcher ─────────────────────────────────────────────────

function getFromDate(filter: LeaderboardFilter): string | null {
  if (filter === "overall") return null;
  const days = filter === "week" ? 7 : 30;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export async function fetchGroupLeaderboardFiltered(
  groupId: string,
  filter: LeaderboardFilter,
): Promise<LeaderboardEntry[]> {
  if (filter === "overall") return fetchGroupLeaderboard(groupId);
  const from = getFromDate(filter)!;
  return fetchGroupLeaderboardByDateRange(groupId, from);
}
