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

const mockFrom = jest.fn((_table: string) => mockChain);

jest.mock("@lib/supabase", () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const {
  fetchGroupLeaderboard,
  fetchGroupLeaderboardByDateRange,
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
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  it("queries finished matches with kickoff_time filter", async () => {
    // Step 1: matches query returns empty → no predictions needed
    mockChain.lte.mockResolvedValueOnce({ data: [], error: null });

    const entries = await fetchGroupLeaderboardByDateRange("g1", from);

    expect(mockFrom).toHaveBeenCalledWith("matches");
    expect(mockChain.eq).toHaveBeenCalledWith("status", "finished");
    expect(mockChain.gte).toHaveBeenCalledWith("kickoff_time", from);
    expect(entries).toEqual([]);
  });

  it("returns empty array when no matches in range", async () => {
    mockChain.lte.mockResolvedValueOnce({ data: [], error: null });

    const entries = await fetchGroupLeaderboardByDateRange("g1", from);

    expect(entries).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalledWith("predictions");
  });

  it("queries predictions for matched match IDs", async () => {
    // Step 1: matches query returns match ids
    mockChain.lte.mockResolvedValueOnce({
      data: [{ id: "match-1" }, { id: "match-2" }],
      error: null,
    });
    // Step 2: predictions query returns empty
    mockChain.not.mockResolvedValueOnce({ data: [], error: null });

    await fetchGroupLeaderboardByDateRange("g1", from);

    expect(mockFrom).toHaveBeenCalledWith("predictions");
    expect(mockChain.eq).toHaveBeenCalledWith("group_id", "g1");
    expect(mockChain.in).toHaveBeenCalledWith("match_id", [
      "match-1",
      "match-2",
    ]);
    expect(mockChain.not).toHaveBeenCalledWith("points", "is", null);
  });

  it("aggregates predictions and returns sorted leaderboard entries", async () => {
    // Step 1: matches
    mockChain.lte.mockResolvedValueOnce({
      data: [{ id: "m1" }, { id: "m2" }],
      error: null,
    });
    // Step 2: predictions with profile join
    mockChain.not.mockResolvedValueOnce({
      data: [
        {
          user_id: "u1",
          points: 5,
          profile: {
            display_name: "Alice",
            username: "alice",
            avatar_url: null,
          },
        },
        {
          user_id: "u2",
          points: 3,
          profile: {
            display_name: "Bob",
            username: "bob",
            avatar_url: null,
          },
        },
        {
          user_id: "u1",
          points: 3,
          profile: {
            display_name: "Alice",
            username: "alice",
            avatar_url: null,
          },
        },
      ],
      error: null,
    });

    const entries = await fetchGroupLeaderboardByDateRange("g1", from);

    expect(entries).toHaveLength(2);
    // Alice: 5 + 3 = 8 pts → position 1
    expect(entries[0]).toMatchObject({
      user_id: "u1",
      total_points: 8,
      position: 1,
      matches_played: 2,
      display_name: "Alice",
    });
    // Bob: 3 pts → position 2
    expect(entries[1]).toMatchObject({
      user_id: "u2",
      total_points: 3,
      position: 2,
      matches_played: 1,
      display_name: "Bob",
    });
  });

  it("throws on matches query error", async () => {
    mockChain.lte.mockResolvedValueOnce({
      data: null,
      error: { message: "Network error" },
    });

    await expect(fetchGroupLeaderboardByDateRange("g1", from)).rejects.toThrow(
      "Network error",
    );
  });

  it("throws on predictions query error", async () => {
    mockChain.lte.mockResolvedValueOnce({
      data: [{ id: "m1" }],
      error: null,
    });
    mockChain.not.mockResolvedValueOnce({
      data: null,
      error: { message: "Prediction error" },
    });

    await expect(fetchGroupLeaderboardByDateRange("g1", from)).rejects.toThrow(
      "Prediction error",
    );
  });
});
