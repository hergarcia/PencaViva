import { pool, isSupabaseAvailable, closePool } from "../setup";
import { withTransaction } from "../helpers";

afterAll(closePool);

const describeFn = isSupabaseAvailable ? describe : describe.skip;

// Default scoring config (matches groups.scoring_system schema default)
const defaultScoring = JSON.stringify({
  exact_score: 5,
  correct_result: 3,
  correct_goal_diff: 1,
  wrong: 0,
});

describeFn("calculate_prediction_points", () => {
  it("returns 5 points for exact score prediction", async () => {
    await withTransaction(pool!, async (client) => {
      const result = await client.query(
        `SELECT calculate_prediction_points(2, 1, 2, 1, $1::jsonb) AS points`,
        [defaultScoring],
      );
      expect(result.rows[0].points).toBe(5);
    });
  });

  it("returns 3 points for correct result (home win) with wrong score", async () => {
    await withTransaction(pool!, async (client) => {
      // Predicted 3-0, actual 2-1: both home win, but diff score
      // Diff: predicted=3, actual=1 -> no diff bonus
      const result = await client.query(
        `SELECT calculate_prediction_points(3, 0, 2, 1, $1::jsonb) AS points`,
        [defaultScoring],
      );
      expect(result.rows[0].points).toBe(3);
    });
  });

  it("returns 3 points for correct result (draw) with wrong score", async () => {
    await withTransaction(pool!, async (client) => {
      // Predicted 1-1, actual 0-0: both draws, but diff=0 in both -> diff bonus too!
      // Actually diff is 0 in both cases, so this gets 3 + 1 = 4
      // Let's use 2-2 vs 0-0 (diff=0 both) -> 3 + 1 = 4
      // For pure correct result without diff bonus: predicted 2-2, actual 1-1 (diff=0, diff=0 -> same diff!)
      // All draws have diff=0 so diff bonus always applies for draws.
      // Use a case where diff differs: impossible for draws (all diffs = 0).
      // So draws always get exact_score (5) or correct_result + correct_goal_diff (3+1=4).
      const result = await client.query(
        `SELECT calculate_prediction_points(2, 2, 1, 1, $1::jsonb) AS points`,
        [defaultScoring],
      );
      expect(result.rows[0].points).toBe(4); // Draw correct (3) + diff bonus (1)
    });
  });

  it("returns 3 points for correct result (away win) with wrong score", async () => {
    await withTransaction(pool!, async (client) => {
      // Predicted 0-1 (diff=-1), actual 1-3 (diff=-2): both away win, different diff
      const result = await client.query(
        `SELECT calculate_prediction_points(0, 1, 1, 3, $1::jsonb) AS points`,
        [defaultScoring],
      );
      expect(result.rows[0].points).toBe(3);
    });
  });

  it("returns 4 points for correct result plus correct goal difference", async () => {
    await withTransaction(pool!, async (client) => {
      // Predicted 3-1 (diff=+2), actual 2-0 (diff=+2): both home win, same diff
      const result = await client.query(
        `SELECT calculate_prediction_points(3, 1, 2, 0, $1::jsonb) AS points`,
        [defaultScoring],
      );
      expect(result.rows[0].points).toBe(4); // Correct result (3) + diff bonus (1)
    });
  });

  it("returns 0 points for wrong result", async () => {
    await withTransaction(pool!, async (client) => {
      // Predicted home win (2-1), actual away win (0-1)
      const result = await client.query(
        `SELECT calculate_prediction_points(2, 1, 0, 1, $1::jsonb) AS points`,
        [defaultScoring],
      );
      expect(result.rows[0].points).toBe(0);
    });
  });

  it("returns 5 points for exact 0-0 prediction", async () => {
    await withTransaction(pool!, async (client) => {
      const result = await client.query(
        `SELECT calculate_prediction_points(0, 0, 0, 0, $1::jsonb) AS points`,
        [defaultScoring],
      );
      expect(result.rows[0].points).toBe(5);
    });
  });

  it("works with custom scoring config", async () => {
    const customScoring = JSON.stringify({
      exact_score: 10,
      correct_result: 5,
      correct_goal_diff: 2,
      wrong: 0,
    });
    await withTransaction(pool!, async (client) => {
      const result = await client.query(
        `SELECT calculate_prediction_points(1, 0, 1, 0, $1::jsonb) AS points`,
        [customScoring],
      );
      expect(result.rows[0].points).toBe(10);
    });
  });

  it("returns 0 for NULL predicted scores", async () => {
    await withTransaction(pool!, async (client) => {
      const result = await client.query(
        `SELECT calculate_prediction_points(NULL, NULL, 1, 0, $1::jsonb) AS points`,
        [defaultScoring],
      );
      // NULL comparisons return NULL/false, so no points awarded
      expect(result.rows[0].points).toBe(0);
    });
  });
});
