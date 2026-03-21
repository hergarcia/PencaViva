// ── Mock Supabase with chainable builder ────────────────────────────

const mockChain: Record<string, jest.Mock> = {};
mockChain.select = jest.fn(() => mockChain);
mockChain.eq = jest.fn(() => mockChain);
mockChain.is = jest.fn(() => mockChain);
mockChain.order = jest.fn(() => mockChain);

jest.mock("@lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => mockChain),
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { fetchGroupLeaderboard } = require("@lib/leaderboard-service");
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
  mockChain.select = jest.fn(() => mockChain);
  mockChain.eq = jest.fn(() => mockChain);
  mockChain.is = jest.fn(() => mockChain);
  mockChain.order = jest.fn(() => mockChain);
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
