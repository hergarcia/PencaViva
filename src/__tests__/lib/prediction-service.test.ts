// ── Mock Supabase with per-query chainable builders ─────────────────
function createChain() {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  return chain;
}

let chains: ReturnType<typeof createChain>[] = [];
let chainIndex = 0;

const mockFrom = jest.fn(() => {
  const chain = chains[chainIndex] ?? createChain();
  chainIndex++;
  return chain;
});

jest.mock("@lib/supabase", () => ({
  supabase: {
    from: () => mockFrom(),
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { fetchMatchDetail, savePrediction } = require("@lib/prediction-service");
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
  chains = [];
  chainIndex = 0;
});

function setupChains(matchData: unknown, predData: unknown) {
  const matchChain = createChain();
  matchChain.single = jest
    .fn()
    .mockResolvedValue({ data: matchData, error: null });

  const predChain = createChain();
  predChain.maybeSingle = jest
    .fn()
    .mockResolvedValue({ data: predData, error: null });

  chains = [matchChain, predChain];
}

// ── fetchMatchDetail ────────────────────────────────────────────────

describe("fetchMatchDetail", () => {
  it("returns match and null prediction when none exists", async () => {
    const matchRow = {
      id: "m1",
      tournament_id: "t1",
      home_team_name: "Team A",
      away_team_name: "Team B",
      home_team_logo: null,
      away_team_logo: null,
      home_score: null,
      away_score: null,
      status: "scheduled",
      kickoff_time: "2026-03-20T18:00:00Z",
      matchday: 12,
      venue: "Stadium",
      tournament: { name: "League", short_name: "LG" },
    };
    setupChains(matchRow, null);

    const result = await fetchMatchDetail("m1", "g1", "u1");
    expect(result.match.id).toBe("m1");
    expect(result.match.tournament_name).toBe("League");
    expect(result.match.tournament_short_name).toBe("LG");
    expect(result.prediction).toBeNull();
  });

  it("returns match with existing prediction", async () => {
    const matchRow = {
      id: "m1",
      tournament_id: "t1",
      home_team_name: "Team A",
      away_team_name: "Team B",
      home_team_logo: null,
      away_team_logo: null,
      home_score: null,
      away_score: null,
      status: "scheduled",
      kickoff_time: "2026-03-20T18:00:00Z",
      matchday: null,
      venue: null,
      tournament: { name: "League", short_name: null },
    };
    const predRow = { id: "p1", home_score_pred: 2, away_score_pred: 1 };
    setupChains(matchRow, predRow);

    const result = await fetchMatchDetail("m1", "g1", "u1");
    expect(result.prediction).toEqual({
      id: "p1",
      home_score_pred: 2,
      away_score_pred: 1,
    });
  });

  it("throws on match query error", async () => {
    const matchChain = createChain();
    matchChain.single = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: "not found" } });
    const predChain = createChain();
    chains = [matchChain, predChain];

    await expect(fetchMatchDetail("m1", "g1", "u1")).rejects.toThrow(
      "not found",
    );
  });
});

// ── savePrediction ──────────────────────────────────────────────────

describe("savePrediction", () => {
  it("calls upsert with correct shape", async () => {
    const chain = createChain();
    chain.single = jest
      .fn()
      .mockResolvedValue({ data: { id: "p1" }, error: null });
    const upsertMock = jest.fn().mockReturnValue(chain);
    mockFrom.mockImplementation(() => ({ upsert: upsertMock }));

    await savePrediction("m1", "g1", "u1", 2, 1);

    expect(upsertMock).toHaveBeenCalledWith(
      {
        user_id: "u1",
        match_id: "m1",
        group_id: "g1",
        home_score_pred: 2,
        away_score_pred: 1,
      },
      { onConflict: "user_id,match_id,group_id" },
    );
  });

  it("throws on upsert error", async () => {
    const chain = createChain();
    chain.single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "RLS violation" },
    });
    mockFrom.mockImplementation(() => ({
      upsert: jest.fn().mockReturnValue(chain),
    }));

    await expect(savePrediction("m1", "g1", "u1", 2, 1)).rejects.toThrow(
      "RLS violation",
    );
  });
});
