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
  points?: number | null;
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
    .select("id, home_score_pred, away_score_pred, points")
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
        points: (predData as Record<string, unknown>).points as
          | number
          | null
          | undefined,
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

// ── Types for group predictions ──────────────────────────────────────

export interface GroupPrediction {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  homeScorePred: number | null;
  awayScorePred: number | null;
  points: number | null;
}

// ── Fetch all group members' predictions for a match ─────────────────

export async function fetchGroupPredictions(
  matchId: string,
  groupId: string,
): Promise<GroupPrediction[]> {
  // 1. Fetch predictions for this match+group (RLS reveals after kickoff)
  const { data: predData, error: predError } = await supabase
    .from("predictions")
    .select(
      "user_id, home_score_pred, away_score_pred, points, profile:profiles!user_id ( display_name, avatar_url )",
    )
    .eq("match_id", matchId)
    .eq("group_id", groupId);

  if (predError) throw new Error(predError.message);

  // 2. Fetch active group members
  const { data: memberData, error: memberError } = await supabase
    .from("group_members")
    .select("user_id, profile:profiles!user_id ( display_name, avatar_url )")
    .eq("group_id", groupId)
    .eq("is_active", true);

  if (memberError) throw new Error(memberError.message);

  // 3. Build prediction map by user_id
  const predMap = new Map<string, Record<string, unknown>>();
  for (const row of predData as Record<string, unknown>[]) {
    predMap.set(row.user_id as string, row);
  }

  // 4. Merge: every member gets a GroupPrediction entry
  return (memberData as Record<string, unknown>[]).map((member) => {
    const userId = member.user_id as string;
    const profile = member.profile as {
      display_name: string;
      avatar_url: string | null;
    };
    const pred = predMap.get(userId);

    if (pred) {
      const predProfile = pred.profile as {
        display_name: string;
        avatar_url: string | null;
      };
      return {
        userId,
        displayName: predProfile.display_name,
        avatarUrl: predProfile.avatar_url,
        homeScorePred: pred.home_score_pred as number,
        awayScorePred: pred.away_score_pred as number,
        points: pred.points as number | null,
      };
    }

    return {
      userId,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      homeScorePred: null,
      awayScorePred: null,
      points: null,
    };
  });
}
