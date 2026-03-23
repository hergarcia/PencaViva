// ── Mock Supabase with chainable builder ────────────────────────────

const mockChain: Record<string, jest.Mock> = {};
mockChain.select = jest.fn(() => mockChain);
mockChain.eq = jest.fn(() => mockChain);
mockChain.is = jest.fn(() => mockChain);
mockChain.order = jest.fn(() => mockChain);
mockChain.gte = jest.fn(() => mockChain);
mockChain.lte = jest.fn(() => mockChain);
mockChain.in = jest.fn(() => mockChain);
mockChain.not = jest.fn(() => mockChain);

const mockFrom = jest.fn((_table: string) => {
  return mockChain;
});

jest.mock("@lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...(args as [string])),
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const {
  fetchGroupLeaderboard,
  fetchGroupLeaderboardByDateRange,
  fetchGroupLeaderboardFiltered,
} = require("@lib/leaderboard-service");
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
  mockChain.select = jest.fn(() => mockChain);
  mockChain.eq = jest.fn(() => mockChain);
  mockChain.is = jest.fn(() => mockChain);
  mockChain.order = jest.fn(() => mockChain);
  mockChain.gte = jest.fn(() => mockChain);
  mockChain.lte = jest.fn(() => mockChain);
  mockChain.in = jest.fn(() => mockChain);
  mockChain.not = jest.fn(() => mockChain);
});

describe("fetchGroupLeaderboard", () => {
  it("returns leaderboard entries mapped from raw data", async () => {
    mockChain.order.mockResolvedValueOnce({
      data: [
        {
          id: "lb1",
          group_id: "g1",
          user_id: "u1",
          total_points: 42,
          position: 1,
          matches_played: 15,
          exact_scores: 3,
          correct_results: 8,
          profile: {
            display_name: "Hernan Garcia",
            username: "hernan_uy",
            avatar_url: null,
          },
        },
      ],
      error: null,
    });

    const entries = await fetchGroupLeaderboard("g1");

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "lb1",
      user_id: "u1",
      total_points: 42,
      position: 1,
      matches_played: 15,
      exact_scores: 3,
      correct_results: 8,
      display_name: "Hernan Garcia",
      username: "hernan_uy",
      avatar_url: null,
    });
  });

  it("filters by group_id and tournament_id IS NULL", async () => {
    mockChain.order.mockResolvedValueOnce({ data: [], error: null });

    await fetchGroupLeaderboard("g1");

    expect(mockChain.eq).toHaveBeenCalledWith("group_id", "g1");
    expect(mockChain.is).toHaveBeenCalledWith("tournament_id", null);
  });

  it("orders by position ascending", async () => {
    mockChain.order.mockResolvedValueOnce({ data: [], error: null });

    await fetchGroupLeaderboard("g1");

    expect(mockChain.order).toHaveBeenCalledWith("position", {
      ascending: true,
    });
  });

  it("throws on error", async () => {
    mockChain.order.mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });

    await expect(fetchGroupLeaderboard("g1")).rejects.toThrow("DB error");
  });

  it("returns empty array when no entries", async () => {
    mockChain.order.mockResolvedValueOnce({ data: [], error: null });

    const entries = await fetchGroupLeaderboard("g1");

    expect(entries).toEqual([]);
  });
});

describe("fetchGroupLeaderboardByDateRange", () => {
  it("queries finished matches in date range", async () => {
    // First call: matches query returns empty → early return
    mockChain.lte.mockResolvedValueOnce({ data: [], error: null });

    await fetchGroupLeaderboardByDateRange("g1", "2025-01-01T00:00:00.000Z");

    expect(mockFrom).toHaveBeenCalledWith("matches");
    expect(mockChain.eq).toHaveBeenCalledWith("status", "finished");
    expect(mockChain.gte).toHaveBeenCalledWith(
      "kickoff_time",
      "2025-01-01T00:00:00.000Z",
    );
    expect(mockChain.lte).toHaveBeenCalledWith(
      "kickoff_time",
      expect.any(String),
    );
  });

  it("returns empty array when no finished matches in range", async () => {
    mockChain.lte.mockResolvedValueOnce({ data: [], error: null });

    const result = await fetchGroupLeaderboardByDateRange(
      "g1",
      "2025-01-01T00:00:00.000Z",
    );

    expect(result).toEqual([]);
  });

  it("queries predictions for matched match IDs", async () => {
    // First call: matches
    mockChain.lte.mockResolvedValueOnce({
      data: [{ id: "m1" }, { id: "m2" }],
      error: null,
    });
    // Second call: predictions
    mockChain.not.mockResolvedValueOnce({ data: [], error: null });

    await fetchGroupLeaderboardByDateRange("g1", "2025-01-01T00:00:00.000Z");

    expect(mockFrom).toHaveBeenCalledWith("predictions");
    expect(mockChain.eq).toHaveBeenCalledWith("group_id", "g1");
    expect(mockChain.in).toHaveBeenCalledWith("match_id", ["m1", "m2"]);
    expect(mockChain.not).toHaveBeenCalledWith("points", "is", null);
  });

  it("throws on matches query error", async () => {
    mockChain.lte.mockResolvedValueOnce({
      data: null,
      error: { message: "matches error" },
    });

    await expect(
      fetchGroupLeaderboardByDateRange("g1", "2025-01-01T00:00:00.000Z"),
    ).rejects.toThrow("matches error");
  });

  it("throws on predictions query error", async () => {
    mockChain.lte.mockResolvedValueOnce({
      data: [{ id: "m1" }],
      error: null,
    });
    mockChain.not.mockResolvedValueOnce({
      data: null,
      error: { message: "predictions error" },
    });

    await expect(
      fetchGroupLeaderboardByDateRange("g1", "2025-01-01T00:00:00.000Z"),
    ).rejects.toThrow("predictions error");
  });
});

describe("fetchGroupLeaderboardFiltered", () => {
  it("calls fetchGroupLeaderboard (leaderboard_cache) for overall filter", async () => {
    mockChain.order.mockResolvedValueOnce({ data: [], error: null });

    await fetchGroupLeaderboardFiltered("g1", "overall");

    expect(mockFrom).toHaveBeenCalledWith("leaderboard_cache");
  });

  it("calls fetchGroupLeaderboardByDateRange (matches) for week filter", async () => {
    mockChain.lte.mockResolvedValueOnce({ data: [], error: null });

    await fetchGroupLeaderboardFiltered("g1", "week");

    expect(mockFrom).toHaveBeenCalledWith("matches");
  });

  it("calls fetchGroupLeaderboardByDateRange (matches) for month filter", async () => {
    mockChain.lte.mockResolvedValueOnce({ data: [], error: null });

    await fetchGroupLeaderboardFiltered("g1", "month");

    expect(mockFrom).toHaveBeenCalledWith("matches");
  });
});
