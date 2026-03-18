import { supabase } from "@lib/supabase";
import type { MatchStatus } from "@lib/matches-service";

// ── Types ───────────────────────────────────────────────────────────

export interface MatchDetail {
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
}

export interface ExistingPrediction {
  id: string;
  home_score_pred: number;
  away_score_pred: number;
}

// ── Fetch match detail + prediction ─────────────────────────────────

export async function fetchMatchDetail(
  matchId: string,
  groupId: string,
  userId: string,
): Promise<{ match: MatchDetail; prediction: ExistingPrediction | null }> {
  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select(
      `id, tournament_id, home_team_name, away_team_name,
       home_team_logo, away_team_logo, home_score, away_score,
       status, kickoff_time, matchday, venue,
       tournament:tournaments!tournament_id ( name, short_name )`,
    )
    .eq("id", matchId)
    .single();

  if (matchError) throw new Error(matchError.message);

  const { data: predData, error: predError } = await supabase
    .from("predictions")
    .select("id, home_score_pred, away_score_pred")
    .eq("user_id", userId)
    .eq("match_id", matchId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (predError) throw new Error(predError.message);

  const m = matchData as Record<string, unknown>;
  const tournament = m.tournament as {
    name: string;
    short_name: string | null;
  };

  const match: MatchDetail = {
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
    status: m.status as MatchStatus,
    kickoff_time: m.kickoff_time as string,
    matchday: m.matchday as number | null,
    venue: m.venue as string | null,
  };

  const prediction: ExistingPrediction | null = predData
    ? {
        id: (predData as Record<string, unknown>).id as string,
        home_score_pred: (predData as Record<string, unknown>)
          .home_score_pred as number,
        away_score_pred: (predData as Record<string, unknown>)
          .away_score_pred as number,
      }
    : null;

  return { match, prediction };
}

// ── Save prediction (UPSERT) ────────────────────────────────────────

export async function savePrediction(
  matchId: string,
  groupId: string,
  userId: string,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  const { error } = await supabase
    .from("predictions")
    .upsert(
      {
        user_id: userId,
        match_id: matchId,
        group_id: groupId,
        home_score_pred: homeScore,
        away_score_pred: awayScore,
      },
      { onConflict: "user_id,match_id,group_id" },
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);
}
