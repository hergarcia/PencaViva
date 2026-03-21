// ── Mock Supabase with per-query chainable builders ─────────────────
/* eslint-enable @typescript-eslint/no-require-imports */

import type { GroupPrediction } from "@lib/prediction-service";
function createChain(
  resolvedData: unknown = [],
  resolvedError: unknown = null,
) {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  // Make the chain thenable (awaitable) — resolves like Supabase PostgREST
  chain.then = jest.fn((resolve) =>
    resolve({ data: resolvedData, error: resolvedError }),
  );
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
const { fetchGroupPredictions } = require("@lib/prediction-service");

beforeEach(() => {
  jest.clearAllMocks();
  chains = [];
  chainIndex = 0;
});

describe("fetchGroupPredictions", () => {
  it("merges predictions with active group members", async () => {
    const predsChain = createChain([
      {
        user_id: "u1",
        home_score_pred: 2,
        away_score_pred: 1,
        points: 5,
        profile: { display_name: "Alice", avatar_url: null },
      },
    ]);
    const membersChain = createChain([
      {
        user_id: "u1",
        profile: { display_name: "Alice", avatar_url: null },
      },
      {
        user_id: "u2",
        profile: { display_name: "Bob", avatar_url: "http://img" },
      },
    ]);
    chains = [predsChain, membersChain];

    const result: GroupPrediction[] = await fetchGroupPredictions("m1", "g1");

    expect(result).toHaveLength(2);
    expect(
      result.find((p: GroupPrediction) => p.userId === "u1")?.homeScorePred,
    ).toBe(2);
    expect(
      result.find((p: GroupPrediction) => p.userId === "u2")?.homeScorePred,
    ).toBeNull();
  });

  it("throws on predictions query error", async () => {
    chains = [createChain(null, { message: "DB error" })];

    await expect(fetchGroupPredictions("m1", "g1")).rejects.toThrow("DB error");
  });

  it("throws on members query error", async () => {
    chains = [
      createChain([]), // predictions OK
      createChain(null, { message: "Members error" }),
    ];

    await expect(fetchGroupPredictions("m1", "g1")).rejects.toThrow(
      "Members error",
    );
  });

  it("returns member with null scores when they have no prediction", async () => {
    chains = [
      createChain([]), // no predictions
      createChain([
        {
          user_id: "u1",
          profile: { display_name: "Alice", avatar_url: null },
        },
      ]),
    ];

    const result: GroupPrediction[] = await fetchGroupPredictions("m1", "g1");

    expect(result).toHaveLength(1);
    expect(result[0].homeScorePred).toBeNull();
    expect(result[0].awayScorePred).toBeNull();
    expect(result[0].points).toBeNull();
  });
});
