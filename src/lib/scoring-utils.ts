import type { ScoringSystem } from "@lib/groups-service";

export type PredictionStatus =
  | "exact"
  | "correct_result_and_diff"
  | "correct_result"
  | "wrong";

/**
 * Client-side mirror of DB function calculate_prediction_points().
 * Same logic, same output — used for live provisional scoring.
 */
export function calculatePotentialPoints(
  homePred: number,
  awayPred: number,
  homeReal: number,
  awayReal: number,
  scoring: ScoringSystem,
): number {
  // Exact score match (early return, no bonus stacking)
  if (homePred === homeReal && awayPred === awayReal) {
    return scoring.exact_score;
  }

  const predResult = Math.sign(homePred - awayPred);
  const realResult = Math.sign(homeReal - awayReal);

  if (predResult === realResult) {
    let points = scoring.correct_result;
    if (homePred - awayPred === homeReal - awayReal) {
      points += scoring.correct_goal_diff;
    }
    return points;
  }

  return scoring.wrong;
}

/**
 * Derives a human-readable status label from a prediction vs actual score.
 */
export function getPredictionStatus(
  homePred: number,
  awayPred: number,
  homeReal: number,
  awayReal: number,
): PredictionStatus {
  if (homePred === homeReal && awayPred === awayReal) {
    return "exact";
  }

  const predResult = Math.sign(homePred - awayPred);
  const realResult = Math.sign(homeReal - awayReal);

  if (predResult === realResult) {
    if (homePred - awayPred === homeReal - awayReal) {
      return "correct_result_and_diff";
    }
    return "correct_result";
  }

  return "wrong";
}
