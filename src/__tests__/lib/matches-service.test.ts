// ── Mock Supabase with per-query chainable builders ─────────────────
// Each from() call gets its own fresh chain so multi-query functions
// don't share mockReturnValueOnce state across chains.
/* eslint-enable @typescript-eslint/no-require-imports */

import type { MatchWithPrediction } from "@lib/matches-service";
function createChain() {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.in = jest.fn(() => chain);
  chain.gte = jest.fn(() => chain);
  chain.lte = jest.fn(() => chain);
  chain.not = jest.fn(() => chain);
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
const { fetchGroupMatches } = require("@lib/matches-service");

beforeEach(() => {
  jest.clearAllMocks();
  chains = [];
  chainIndex = 0;
});

/** Helper: set up chains for the 3 sequential queries. */
function setupChains(
  tournamentsResult: { data: unknown; error: unknown },
  matchesResult: { data: unknown; error: unknown },
  predictionsResult: { data: unknown; error: unknown },
) {
  const gtChain = createChain();
  gtChain.eq.mockReturnValue(tournamentsResult);

  const matchChain = createChain();
  matchChain.order.mockReturnValue(matchesResult);

  const predChain = createChain();
  // predictions query: .eq("user_id",...).eq("group_id",...) — second eq is terminal
  predChain.eq.mockReturnValueOnce(predChain); // first .eq returns chain
  predChain.eq.mockReturnValueOnce(predictionsResult); // second .eq returns result

  chains = [gtChain, matchChain, predChain];
}

const NOW = "2026-03-18T12:00:00Z";

describe("fetchGroupMatches", () => {
  it("returns empty array when group has no tournaments", async () => {
    const gtChain = createChain();
    gtChain.eq.mockReturnValue({ data: [], error: null });
    chains = [gtChain];

    const result = await fetchGroupMatches("group-1", "user-1", NOW);
    expect(result).toEqual([]);
  });

  it("fetches matches and merges with predictions", async () => {
    setupChains(
      { data: [{ tournament_id: "t1" }], error: null },
      {
        data: [
          {
            id: "m1",
            tournament_id: "t1",
            home_team_name: "Nacional",
            away_team_name: "Peñarol",
            home_team_logo: null,
            away_team_logo: null,
            home_score: null,
            away_score: null,
            status: "scheduled",
            kickoff_time: "2026-03-19T20:00:00Z",
            matchday: 5,
            venue: "Estadio Gran Parque Central",
            tournament: { name: "Primera División", short_name: "PDU" },
          },
        ],
        error: null,
      },
      {
        data: [{ match_id: "m1", home_score_pred: 2, away_score_pred: 1 }],
        error: null,
      },
    );

    const result: MatchWithPrediction[] = await fetchGroupMatches(
      "group-1",
      "user-1",
      NOW,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
    expect(result[0].home_team_name).toBe("Nacional");
    expect(result[0].prediction_status).toBe("predicted");
    expect(result[0].predicted_home).toBe(2);
    expect(result[0].predicted_away).toBe(1);
    expect(result[0].tournament_name).toBe("Primera División");
  });

  it("marks match as open when no prediction and kickoff in future", async () => {
    setupChains(
      { data: [{ tournament_id: "t1" }], error: null },
      {
        data: [
          {
            id: "m2",
            tournament_id: "t1",
            home_team_name: "Defensor",
            away_team_name: "Danubio",
            home_team_logo: null,
            away_team_logo: null,
            home_score: null,
            away_score: null,
            status: "scheduled",
            kickoff_time: "2026-03-19T17:30:00Z",
            matchday: null,
            venue: "Franzini",
            tournament: { name: "PDU", short_name: "PDU" },
          },
        ],
        error: null,
      },
      { data: [], error: null },
    );

    const result: MatchWithPrediction[] = await fetchGroupMatches(
      "group-1",
      "user-1",
      NOW,
    );

    expect(result[0].prediction_status).toBe("open");
    expect(result[0].predicted_home).toBeNull();
  });

  it("marks match as closed when no prediction and kickoff in past", async () => {
    setupChains(
      { data: [{ tournament_id: "t1" }], error: null },
      {
        data: [
          {
            id: "m3",
            tournament_id: "t1",
            home_team_name: "Liverpool",
            away_team_name: "Wanderers",
            home_team_logo: null,
            away_team_logo: null,
            home_score: 1,
            away_score: 0,
            status: "finished",
            kickoff_time: "2026-03-17T20:00:00Z",
            matchday: 4,
            venue: "Belvedere",
            tournament: { name: "PDU", short_name: "PDU" },
          },
        ],
        error: null,
      },
      { data: [], error: null },
    );

    const result: MatchWithPrediction[] = await fetchGroupMatches(
      "group-1",
      "user-1",
      NOW,
    );

    expect(result[0].prediction_status).toBe("closed");
  });

  it("throws on supabase error", async () => {
    const gtChain = createChain();
    gtChain.eq.mockReturnValue({
      data: null,
      error: { message: "RLS denied" },
    });
    chains = [gtChain];

    await expect(fetchGroupMatches("group-1", "user-1", NOW)).rejects.toThrow(
      "RLS denied",
    );
  });
});
