import {
  calculatePotentialPoints,
  getPredictionStatus,
} from "@lib/scoring-utils";
import type { PredictionStatus } from "@lib/scoring-utils";
import type { ScoringSystem } from "@lib/groups-service";

const DEFAULT_SCORING: ScoringSystem = {
  exact_score: 5,
  correct_result: 3,
  correct_goal_diff: 1,
  wrong: 0,
};

describe("calculatePotentialPoints", () => {
  it("returns exact_score for exact match", () => {
    expect(calculatePotentialPoints(2, 1, 2, 1, DEFAULT_SCORING)).toBe(5);
  });

  it("returns correct_result for right winner only (different goal diff)", () => {
    // Pred 1-0 (diff +1), Actual 3-1 (diff +2): same winner, different diff
    expect(calculatePotentialPoints(1, 0, 3, 1, DEFAULT_SCORING)).toBe(3);
  });

  it("returns correct_result + correct_goal_diff for right winner and diff", () => {
    expect(calculatePotentialPoints(3, 2, 2, 1, DEFAULT_SCORING)).toBe(4);
  });

  it("returns 0 for wrong prediction", () => {
    expect(calculatePotentialPoints(0, 2, 2, 1, DEFAULT_SCORING)).toBe(0);
  });

  it("returns correct_result + diff for draws with same diff (0)", () => {
    // 1-1 vs 0-0: same result (draw), goal diff = 0 for both → bonus applies
    expect(calculatePotentialPoints(1, 1, 0, 0, DEFAULT_SCORING)).toBe(4);
  });

  it("returns exact_score for exact draw", () => {
    expect(calculatePotentialPoints(0, 0, 0, 0, DEFAULT_SCORING)).toBe(5);
  });

  it("uses custom scoring system values", () => {
    const custom: ScoringSystem = {
      exact_score: 10,
      correct_result: 4,
      correct_goal_diff: 2,
      wrong: 0,
    };
    expect(calculatePotentialPoints(2, 1, 2, 1, custom)).toBe(10);
    // Pred 1-0 (diff +1), Actual 3-1 (diff +2): correct result only
    expect(calculatePotentialPoints(1, 0, 3, 1, custom)).toBe(4);
    expect(calculatePotentialPoints(3, 2, 2, 1, custom)).toBe(6);
  });
});

describe("getPredictionStatus", () => {
  it("returns 'exact' for exact match", () => {
    expect(getPredictionStatus(2, 1, 2, 1)).toBe("exact");
  });

  it("returns 'correct_result_and_diff' for right winner and diff", () => {
    expect(getPredictionStatus(3, 2, 2, 1)).toBe("correct_result_and_diff");
  });

  it("returns 'correct_result' for right winner only", () => {
    expect(getPredictionStatus(1, 0, 3, 1)).toBe("correct_result");
  });

  it("returns 'wrong' for wrong prediction", () => {
    expect(getPredictionStatus(0, 2, 2, 1)).toBe("wrong");
  });

  it("returns 'correct_result_and_diff' for draws with same diff", () => {
    // 1-1 vs 2-2: draw, goal diff both 0
    expect(getPredictionStatus(1, 1, 2, 2)).toBe("correct_result_and_diff");
  });
});

// Type assertion: PredictionStatus is usable as a type
const _typeCheck: PredictionStatus = "exact";
void _typeCheck;
