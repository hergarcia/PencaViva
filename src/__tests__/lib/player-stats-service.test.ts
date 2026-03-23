// ── Mock Supabase ─────────────────────────────────────────────────────────────

const mockChain: Record<string, jest.Mock> = {};
mockChain.select = jest.fn(() => mockChain);
mockChain.eq = jest.fn(() => mockChain);
mockChain.not = jest.fn(() => mockChain);

const mockFrom = jest.fn((_table: string) => mockChain);

jest.mock("@lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...(args as [string])),
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { computeStreaks, fetchPlayerGroupStats } =
  require("@lib/player-stats-service") as typeof import("@lib/player-stats-service");
/* eslint-enable @typescript-eslint/no-require-imports */

// ── Helpers ───────────────────────────────────────────────────────────────────

interface PredictionRecord {
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

function rec(points: number, daysAgo: number): PredictionRecord {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id: `pred-${daysAgo}`,
    home_score_pred: 1,
    away_score_pred: 0,
    points,
    match: {
      id: `match-${daysAgo}`,
      home_team_name: "Team A",
      away_team_name: "Team B",
      home_score: 1,
      away_score: 0,
      kickoff_time: d.toISOString(),
      status: "finished",
      matchday: 1,
      tournament_name: "Cup",
      tournament_short_name: null,
    },
  };
}

// ── computeStreaks ─────────────────────────────────────────────────────────────

describe("computeStreaks", () => {
  it("returns zeros for empty array", () => {
    const result = computeStreaks([]);
    expect(result).toEqual({
      currentStreak: { count: 0, type: "correct" },
      bestStreak: 0,
    });
  });

  it("computes current correct streak from most recent", () => {
    const preds = [rec(3, 1), rec(5, 2), rec(0, 3), rec(3, 4)];
    const result = computeStreaks(preds);
    expect(result.currentStreak).toEqual({ count: 2, type: "correct" });
  });

  it("computes current wrong streak from most recent", () => {
    const preds = [rec(0, 1), rec(0, 2), rec(5, 3)];
    const result = computeStreaks(preds);
    expect(result.currentStreak).toEqual({ count: 2, type: "wrong" });
  });

  it("computes best streak across all predictions", () => {
    const preds = [
      rec(5, 1),
      rec(0, 2),
      rec(3, 3),
      rec(3, 4),
      rec(3, 5),
      rec(5, 6),
    ];
    const result = computeStreaks(preds);
    expect(result.bestStreak).toBe(4);
    expect(result.currentStreak).toEqual({ count: 1, type: "correct" });
  });

  it("handles single prediction (correct)", () => {
    const result = computeStreaks([rec(3, 1)]);
    expect(result.currentStreak).toEqual({ count: 1, type: "correct" });
    expect(result.bestStreak).toBe(1);
  });

  it("handles single prediction (wrong)", () => {
    const result = computeStreaks([rec(0, 1)]);
    expect(result.currentStreak).toEqual({ count: 1, type: "wrong" });
    expect(result.bestStreak).toBe(0);
  });

  it("handles all correct predictions", () => {
    const preds = [rec(5, 1), rec(3, 2), rec(4, 3)];
    const result = computeStreaks(preds);
    expect(result.currentStreak).toEqual({ count: 3, type: "correct" });
    expect(result.bestStreak).toBe(3);
  });

  it("handles all wrong predictions", () => {
    const preds = [rec(0, 1), rec(0, 2), rec(0, 3)];
    const result = computeStreaks(preds);
    expect(result.currentStreak).toEqual({ count: 3, type: "wrong" });
    expect(result.bestStreak).toBe(0);
  });
});

// ── fetchPlayerGroupStats ──────────────────────────────────────────────────────

describe("fetchPlayerGroupStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChain.select.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
  });

  it("fetches predictions with correct query chain", async () => {
    const mockData = [
      {
        id: "p1",
        home_score_pred: 2,
        away_score_pred: 1,
        points: 3,
        match: {
          id: "m1",
          home_team_name: "Team A",
          away_team_name: "Team B",
          home_score: 2,
          away_score: 0,
          kickoff_time: "2026-03-20T20:00:00Z",
          status: "finished",
          matchday: 4,
          tournament: { name: "Copa", short_name: "COP" },
        },
      },
    ];

    mockChain.not.mockResolvedValue({ data: mockData, error: null });

    const result = await fetchPlayerGroupStats("user-1", "group-1");

    expect(mockFrom).toHaveBeenCalledWith("predictions");
    expect(mockChain.select).toHaveBeenCalledWith(
      expect.stringContaining("match:matches!match_id"),
    );
    expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockChain.eq).toHaveBeenCalledWith("group_id", "group-1");
    expect(mockChain.not).toHaveBeenCalledWith("points", "is", null);
    expect(result).toHaveLength(1);
    expect(result[0].points).toBe(3);
    expect(result[0].match.tournament_name).toBe("Copa");
  });

  it("throws on supabase error", async () => {
    mockChain.not.mockResolvedValue({
      data: null,
      error: { message: "RLS denied" },
    });

    await expect(fetchPlayerGroupStats("user-1", "group-1")).rejects.toThrow(
      "RLS denied",
    );
  });
});
