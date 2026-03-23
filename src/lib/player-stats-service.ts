import { supabase } from "@lib/supabase";

export interface PlayerPredictionRecord {
  id: string;
  home_score_pred: number;
  away_score_pred: number;
  points: number;
  match: {
    id: string;
    home_team_name: string;
    away_team_name: string;
    home_score: number;
    away_score: number;
    kickoff_time: string;
    status: string;
    matchday: number | null;
    tournament_name: string;
    tournament_short_name: string | null;
  };
}

export interface StreakResult {
  currentStreak: { count: number; type: "correct" | "wrong" };
  bestStreak: number;
}

export function computeStreaks(
  predictions: PlayerPredictionRecord[],
): StreakResult {
  if (predictions.length === 0) {
    return { currentStreak: { count: 0, type: "correct" }, bestStreak: 0 };
  }

  const sorted = [...predictions].sort(
    (a, b) =>
      new Date(a.match.kickoff_time).getTime() -
      new Date(b.match.kickoff_time).getTime(),
  );

  let bestStreak = 0;
  let tempStreak = 0;
  for (const pred of sorted) {
    if (pred.points > 0) {
      tempStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  const last = sorted[sorted.length - 1];
  const isCorrect = last.points > 0;
  let currentCount = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const correct = sorted[i].points > 0;
    if (correct === isCorrect) {
      currentCount++;
    } else {
      break;
    }
  }

  return {
    currentStreak: {
      count: currentCount,
      type: isCorrect ? "correct" : "wrong",
    },
    bestStreak,
  };
}

export async function fetchPlayerGroupStats(
  userId: string,
  groupId: string,
): Promise<PlayerPredictionRecord[]> {
  const { data, error } = await supabase
    .from("predictions")
    .select(
      `id, home_score_pred, away_score_pred, points,
       match:matches!match_id (
         id, home_team_name, away_team_name, home_score, away_score,
         kickoff_time, status, matchday,
         tournament:tournaments ( name, short_name )
       )`,
    )
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .not("points", "is", null);

  if (error) throw new Error(error.message);

  return (data as Record<string, unknown>[]).map((row) => {
    const m = row.match as Record<string, unknown>;
    const t = m.tournament as { name: string; short_name: string | null };
    return {
      id: row.id as string,
      home_score_pred: row.home_score_pred as number,
      away_score_pred: row.away_score_pred as number,
      points: row.points as number,
      match: {
        id: m.id as string,
        home_team_name: m.home_team_name as string,
        away_team_name: m.away_team_name as string,
        home_score: m.home_score as number,
        away_score: m.away_score as number,
        kickoff_time: m.kickoff_time as string,
        status: m.status as string,
        matchday: m.matchday as number | null,
        tournament_name: t.name,
        tournament_short_name: t.short_name,
      },
    };
  });
}
