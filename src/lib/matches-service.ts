import { supabase } from "@lib/supabase";

// ── Types ───────────────────────────────────────────────────────────

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

export type PredictionStatus = "open" | "predicted" | "closed";

export interface MatchWithPrediction {
  id: string;
  tournament_id: string;
  tournament_name: string;
  tournament_short_name: string | null;
  home_team_name: string;
  away_team_name: string;
  home_team_logo: string | null;
  away_team_logo: string | null;
  home_score: number | null;
  away_score: number | null;
  status: MatchStatus;
  kickoff_time: string;
  matchday: number | null;
  venue: string | null;
  prediction_status: PredictionStatus;
  predicted_home: number | null;
  predicted_away: number | null;
}

// ── Match window constants ──────────────────────────────────────────

const PAST_DAYS = 3;
const FUTURE_DAYS = 14;

function getMatchWindow(now: string): { from: string; to: string } {
  const d = new Date(now);
  const from = new Date(d);
  from.setDate(from.getDate() - PAST_DAYS);
  const to = new Date(d);
  to.setDate(to.getDate() + FUTURE_DAYS);
  return { from: from.toISOString(), to: to.toISOString() };
}

// ── Prediction status logic ─────────────────────────────────────────

function derivePredictionStatus(
  hasPrediction: boolean,
  kickoffTime: string,
  matchStatus: MatchStatus,
  now: string,
): PredictionStatus {
  if (hasPrediction) return "predicted";
  const isPast =
    new Date(kickoffTime) <= new Date(now) ||
    matchStatus === "live" ||
    matchStatus === "finished";
  return isPast ? "closed" : "open";
}

// ── Main query ──────────────────────────────────────────────────────

/**
 * Fetch matches for a group's tournaments with the user's prediction status.
 * Uses three sequential queries: tournaments → matches → predictions, then
 * merges client-side.
 *
 * @param now - ISO timestamp for "current time" (injectable for testing)
 */
export async function fetchGroupMatches(
  groupId: string,
  userId: string,
  now: string = new Date().toISOString(),
): Promise<MatchWithPrediction[]> {
  // 1. Get tournament IDs for this group
  const { data: gtData, error: gtError } = await supabase
    .from("group_tournaments")
    .select("tournament_id")
    .eq("group_id", groupId);

  if (gtError) throw new Error(gtError.message);

  const tournamentIds = (gtData ?? []).map(
    (r: { tournament_id: string }) => r.tournament_id,
  );
  if (tournamentIds.length === 0) return [];

  // 2. Fetch matches within the time window
  const { from, to } = getMatchWindow(now);

  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select(
      `
      id, tournament_id, home_team_name, away_team_name,
      home_team_logo, away_team_logo, home_score, away_score,
      status, kickoff_time, matchday, venue,
      tournament:tournaments!tournament_id ( name, short_name )
    `,
    )
    .in("tournament_id", tournamentIds)
    .gte("kickoff_time", from)
    .lte("kickoff_time", to)
    .not("status", "eq", "cancelled")
    .order("kickoff_time", { ascending: true });

  if (matchError) throw new Error(matchError.message);

  const matches = matchData ?? [];
  if (matches.length === 0) return [];

  // 3. Fetch user's predictions for this group
  const { data: predData, error: predError } = await supabase
    .from("predictions")
    .select("match_id, home_score_pred, away_score_pred")
    .eq("user_id", userId)
    .eq("group_id", groupId);

  if (predError) throw new Error(predError.message);

  // Build lookup map: match_id → prediction
  const predMap = new Map<string, { home: number; away: number }>();
  for (const p of predData ?? []) {
    predMap.set((p as { match_id: string }).match_id, {
      home: (p as { home_score_pred: number }).home_score_pred,
      away: (p as { away_score_pred: number }).away_score_pred,
    });
  }

  // 4. Merge matches with predictions
  return matches.map((m: Record<string, unknown>) => {
    const tournament = m.tournament as {
      name: string;
      short_name: string | null;
    };
    const pred = predMap.get(m.id as string);
    const status = m.status as MatchStatus;

    return {
      id: m.id as string,
      tournament_id: m.tournament_id as string,
      tournament_name: tournament.name,
      tournament_short_name: tournament.short_name,
      home_team_name: m.home_team_name as string,
      away_team_name: m.away_team_name as string,
      home_team_logo: m.home_team_logo as string | null,
      away_team_logo: m.away_team_logo as string | null,
      home_score: m.home_score as number | null,
      away_score: m.away_score as number | null,
      status,
      kickoff_time: m.kickoff_time as string,
      matchday: m.matchday as number | null,
      venue: m.venue as string | null,
      prediction_status: derivePredictionStatus(
        !!pred,
        m.kickoff_time as string,
        status,
        now,
      ),
      predicted_home: pred?.home ?? null,
      predicted_away: pred?.away ?? null,
    };
  });
}
