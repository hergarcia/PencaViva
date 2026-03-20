# F1-20: View Others' Predictions (Post-Kickoff) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Group Predictions" section to the match detail screen that shows all group members' predictions after kickoff, with live provisional points during matches and ranked final results after.

**Architecture:** Two new components (`GroupPredictions`, `PredictionRow`) render in the match detail screen's `ScrollView`. A new service function fetches predictions + members via two Supabase queries merged client-side. A pure scoring utility computes potential points. A custom hook manages loading state with `useState`/`useEffect` (consistent with existing hooks — no React Query).

**Tech Stack:** React Native, TypeScript, Supabase (PostgREST), Jest, `@testing-library/react-native`

**Spec:** `docs/superpowers/specs/2026-03-20-F1-20-view-others-predictions-design.md`

---

## File Structure

| Action | Path                                                 | Responsibility                                                    |
| ------ | ---------------------------------------------------- | ----------------------------------------------------------------- |
| Create | `src/lib/scoring-utils.ts`                           | Pure functions: `calculatePotentialPoints`, `getPredictionStatus` |
| Create | `src/__tests__/lib/scoring-utils.test.ts`            | Tests for scoring utilities                                       |
| Modify | `src/lib/prediction-service.ts`                      | Add `GroupPrediction` type + `fetchGroupPredictions()`            |
| Create | `src/__tests__/lib/prediction-service-group.test.ts` | Tests for fetchGroupPredictions                                   |
| Create | `src/hooks/use-group-predictions.ts`                 | Hook: loads group predictions, manages state                      |
| Create | `src/__tests__/hooks/use-group-predictions.test.ts`  | Tests for hook                                                    |
| Create | `src/components/predictions/PredictionRow.tsx`       | Single prediction row component                                   |
| Create | `src/components/predictions/GroupPredictions.tsx`    | Section container: header + list of rows                          |
| Modify | `app/match/[id].tsx`                                 | Integrate `GroupPredictions` into match detail                    |
| Modify | `src/lib/mock/fixtures.ts`                           | Add group prediction fixtures for live/finished matches           |

---

### Task 1: Scoring Utilities (Pure Functions)

**Files:**

- Create: `src/lib/scoring-utils.ts`
- Create: `src/__tests__/lib/scoring-utils.test.ts`

- [ ] **Step 1: Write failing tests for `calculatePotentialPoints`**

Create `src/__tests__/lib/scoring-utils.test.ts`:

```typescript
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

  it("returns correct_result for right winner", () => {
    expect(calculatePotentialPoints(1, 0, 2, 1, DEFAULT_SCORING)).toBe(3);
  });

  it("returns correct_result + correct_goal_diff for right winner and diff", () => {
    expect(calculatePotentialPoints(3, 2, 2, 1, DEFAULT_SCORING)).toBe(4);
  });

  it("returns 0 for wrong prediction", () => {
    expect(calculatePotentialPoints(0, 2, 2, 1, DEFAULT_SCORING)).toBe(0);
  });

  it("handles draw correctly", () => {
    expect(calculatePotentialPoints(1, 1, 0, 0, DEFAULT_SCORING)).toBe(3);
  });

  it("returns exact_score for exact draw", () => {
    expect(calculatePotentialPoints(0, 0, 0, 0, DEFAULT_SCORING)).toBe(5);
  });

  it("returns correct_result + diff for draws with same diff (0)", () => {
    // 1-1 vs 0-0: same result (draw), same goal diff (0)
    expect(calculatePotentialPoints(1, 1, 0, 0, DEFAULT_SCORING)).toBe(4);
  });

  it("uses custom scoring system values", () => {
    const custom: ScoringSystem = {
      exact_score: 10,
      correct_result: 4,
      correct_goal_diff: 2,
      wrong: 0,
    };
    expect(calculatePotentialPoints(2, 1, 2, 1, custom)).toBe(10);
    expect(calculatePotentialPoints(1, 0, 2, 1, custom)).toBe(4);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/lib/scoring-utils.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement scoring utilities**

Create `src/lib/scoring-utils.ts`:

```typescript
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

  return 0;
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/lib/scoring-utils.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring-utils.ts src/__tests__/lib/scoring-utils.test.ts
git commit -m "feat(predictions): add scoring utility functions (F1-20)"
```

---

### Task 2: Service Function — `fetchGroupPredictions`

**Files:**

- Modify: `src/lib/prediction-service.ts`
- Create: `src/__tests__/lib/prediction-service-group.test.ts`

- [ ] **Step 1: Write failing tests for `fetchGroupPredictions`**

Create `src/__tests__/lib/prediction-service-group.test.ts`.

Uses the same `createChain` + `chains[]` pattern as `prediction-service.test.ts`. Since `fetchGroupPredictions` doesn't call `.single()` or `.maybeSingle()`, the final `.eq()` must be thenable. We make `.eq()` return an object with a `.then()` method on the last call:

```typescript
// ── Mock Supabase with per-query chainable builders ─────────────────
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
/* eslint-enable @typescript-eslint/no-require-imports */

import type { GroupPrediction } from "@lib/prediction-service";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/lib/prediction-service-group.test.ts --no-coverage`
Expected: FAIL — `fetchGroupPredictions` not found

- [ ] **Step 3: Add `GroupPrediction` type and `fetchGroupPredictions` to prediction-service**

Add to the end of `src/lib/prediction-service.ts` (after the existing `savePrediction` function):

```typescript
// ── Types for group predictions ──────────────────────────────────────

export interface GroupPrediction {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  homeScorePred: number | null;
  awayScorePred: number | null;
  points: number | null;
}

// ── Fetch all group members' predictions for a match ─────────────────

export async function fetchGroupPredictions(
  matchId: string,
  groupId: string,
): Promise<GroupPrediction[]> {
  // 1. Fetch predictions for this match+group (RLS reveals after kickoff)
  const { data: predData, error: predError } = await supabase
    .from("predictions")
    .select(
      "user_id, home_score_pred, away_score_pred, points, profile:profiles!user_id ( display_name, avatar_url )",
    )
    .eq("match_id", matchId)
    .eq("group_id", groupId);

  if (predError) throw new Error(predError.message);

  // 2. Fetch active group members
  const { data: memberData, error: memberError } = await supabase
    .from("group_members")
    .select("user_id, profile:profiles!user_id ( display_name, avatar_url )")
    .eq("group_id", groupId)
    .eq("is_active", true);

  if (memberError) throw new Error(memberError.message);

  // 3. Build prediction map by user_id
  const predMap = new Map<string, Record<string, unknown>>();
  for (const row of predData as Record<string, unknown>[]) {
    predMap.set(row.user_id as string, row);
  }

  // 4. Merge: every member gets a GroupPrediction entry
  return (memberData as Record<string, unknown>[]).map((member) => {
    const userId = member.user_id as string;
    const profile = member.profile as {
      display_name: string;
      avatar_url: string | null;
    };
    const pred = predMap.get(userId);

    if (pred) {
      const predProfile = pred.profile as {
        display_name: string;
        avatar_url: string | null;
      };
      return {
        userId,
        displayName: predProfile.display_name,
        avatarUrl: predProfile.avatar_url,
        homeScorePred: pred.home_score_pred as number,
        awayScorePred: pred.away_score_pred as number,
        points: pred.points as number | null,
      };
    }

    return {
      userId,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      homeScorePred: null,
      awayScorePred: null,
      points: null,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/lib/prediction-service-group.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/prediction-service.ts src/__tests__/lib/prediction-service-group.test.ts
git commit -m "feat(predictions): add fetchGroupPredictions service function (F1-20)"
```

---

### Task 3: Hook — `useGroupPredictions`

**Files:**

- Create: `src/hooks/use-group-predictions.ts`
- Create: `src/__tests__/hooks/use-group-predictions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/hooks/use-group-predictions.test.ts`:

```typescript
import { renderHook, waitFor } from "@testing-library/react-native";

const mockFetchGroupPredictions = jest.fn();
jest.mock("@lib/prediction-service", () => ({
  fetchGroupPredictions: (...args: unknown[]) =>
    mockFetchGroupPredictions(...args),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isInitialized: true }),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { useGroupPredictions } = require("@hooks/use-group-predictions");
/* eslint-enable @typescript-eslint/no-require-imports */

const mockPredictions = [
  {
    userId: "u1",
    displayName: "Alice",
    avatarUrl: null,
    homeScorePred: 2,
    awayScorePred: 1,
    points: null,
  },
];

describe("useGroupPredictions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not fetch when match is scheduled", async () => {
    const { result } = renderHook(() =>
      useGroupPredictions("m1", "g1", "scheduled"),
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.predictions).toEqual([]);
    expect(mockFetchGroupPredictions).not.toHaveBeenCalled();
  });

  it("fetches predictions for live matches", async () => {
    mockFetchGroupPredictions.mockResolvedValue(mockPredictions);

    const { result } = renderHook(() =>
      useGroupPredictions("m1", "g1", "live"),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.predictions).toEqual(mockPredictions);
    expect(mockFetchGroupPredictions).toHaveBeenCalledWith("m1", "g1");
  });

  it("fetches predictions for finished matches", async () => {
    mockFetchGroupPredictions.mockResolvedValue(mockPredictions);

    const { result } = renderHook(() =>
      useGroupPredictions("m1", "g1", "finished"),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.predictions).toEqual(mockPredictions);
  });

  it("sets error on fetch failure", async () => {
    mockFetchGroupPredictions.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useGroupPredictions("m1", "g1", "live"),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Network error");
    expect(result.current.predictions).toEqual([]);
  });

  it("does not fetch without matchId or groupId", async () => {
    const { result } = renderHook(() =>
      useGroupPredictions(undefined, "g1", "live"),
    );

    expect(result.current.isLoading).toBe(false);
    expect(mockFetchGroupPredictions).not.toHaveBeenCalled();
  });

  it("sets up refetch interval for live matches", async () => {
    jest.useFakeTimers();
    mockFetchGroupPredictions.mockResolvedValue(mockPredictions);

    renderHook(() => useGroupPredictions("m1", "g1", "live"));

    await waitFor(() =>
      expect(mockFetchGroupPredictions).toHaveBeenCalledTimes(1),
    );

    // Advance 30s — should refetch
    jest.advanceTimersByTime(30_000);
    await waitFor(() =>
      expect(mockFetchGroupPredictions).toHaveBeenCalledTimes(2),
    );

    jest.useRealTimers();
  });

  it("does not set up interval for finished matches", async () => {
    jest.useFakeTimers();
    mockFetchGroupPredictions.mockResolvedValue(mockPredictions);

    renderHook(() => useGroupPredictions("m1", "g1", "finished"));

    await waitFor(() =>
      expect(mockFetchGroupPredictions).toHaveBeenCalledTimes(1),
    );

    jest.advanceTimersByTime(60_000);
    // Should still be 1 — no interval for finished
    expect(mockFetchGroupPredictions).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/hooks/use-group-predictions.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the hook**

Create `src/hooks/use-group-predictions.ts`:

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchGroupPredictions } from "@lib/prediction-service";
import type { GroupPrediction } from "@lib/prediction-service";
import type { MatchStatus } from "@lib/matches-service";

type UseGroupPredictionsResult = {
  predictions: GroupPrediction[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const LIVE_REFETCH_INTERVAL_MS = 30_000;

export function useGroupPredictions(
  matchId: string | undefined,
  groupId: string | undefined,
  matchStatus: MatchStatus | undefined,
): UseGroupPredictionsResult {
  const [predictions, setPredictions] = useState<GroupPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const isEnabled =
    !!matchId &&
    !!groupId &&
    (matchStatus === "live" || matchStatus === "finished");

  const loadData = useCallback(async () => {
    if (!matchId || !groupId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchGroupPredictions(matchId, groupId);
      if (!cancelledRef.current) {
        setPredictions(data);
      }
    } catch (err: unknown) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      if (!cancelledRef.current) {
        setIsLoading(false);
      }
    }
  }, [matchId, groupId]);

  useEffect(() => {
    cancelledRef.current = false;

    if (!isEnabled) {
      setPredictions([]);
      setIsLoading(false);
      return;
    }

    loadData();

    // Refetch every 30s during live matches
    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (matchStatus === "live") {
      intervalId = setInterval(loadData, LIVE_REFETCH_INTERVAL_MS);
    }

    return () => {
      cancelledRef.current = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isEnabled, matchStatus, loadData]);

  const refetch = useCallback(async () => {
    cancelledRef.current = false;
    await loadData();
  }, [loadData]);

  return { predictions, isLoading, error, refetch };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/hooks/use-group-predictions.test.ts --no-coverage`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-group-predictions.ts src/__tests__/hooks/use-group-predictions.test.ts
git commit -m "feat(predictions): add useGroupPredictions hook (F1-20)"
```

---

### Task 4: PredictionRow Component

**Files:**

- Create: `src/components/predictions/PredictionRow.tsx`

- [ ] **Step 1: Create PredictionRow component**

Create `src/components/predictions/PredictionRow.tsx`:

```typescript
import React from "react";
import { View, Text, Image } from "react-native";
import { colors } from "@lib/constants";
import type { GroupPrediction } from "@lib/prediction-service";
import type { PredictionStatus } from "@lib/scoring-utils";

type PredictionRowProps = {
  prediction: GroupPrediction;
  rank: number | null;
  status: PredictionStatus | null;
  potentialPoints: number | null;
  isCurrentUser: boolean;
  isFinished: boolean;
};

const STATUS_LABELS: Record<PredictionStatus, string> = {
  exact: "Exact!",
  correct_result_and_diff: "Result + diff",
  correct_result: "Correct result",
  wrong: "Wrong",
};

const STATUS_COLORS: Record<PredictionStatus, string> = {
  exact: colors.primary,
  correct_result_and_diff: colors.accent,
  correct_result: colors.accent,
  wrong: "#555555",
};

const RANK_COLORS: Record<number, string> = {
  1: colors.accent,      // gold
  2: "#C0C0C0",          // silver
  3: "#CD7F32",          // bronze
};

export function PredictionRow({
  prediction,
  rank,
  status,
  potentialPoints,
  isCurrentUser,
  isFinished,
}: PredictionRowProps) {
  const hasPrediction =
    prediction.homeScorePred !== null && prediction.awayScorePred !== null;

  const isExact = status === "exact";
  const isNoPrediction = !hasPrediction;

  // Row background
  const rowBg = isExact
    ? "#0D2E27"
    : isCurrentUser
      ? "#1F1F35"
      : colors.surface;

  // Row border
  const borderStyle = isExact
    ? { borderWidth: 1, borderColor: `${colors.primary}33` }
    : isCurrentUser
      ? { borderWidth: 1, borderColor: `${colors.secondary}44` }
      : {};

  const statusColor = status ? STATUS_COLORS[status] : "#555555";

  return (
    <View
      testID={`prediction-row-${prediction.userId}`}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          padding: 10,
          paddingHorizontal: 12,
          backgroundColor: rowBg,
          borderRadius: 10,
          marginBottom: 6,
          opacity: isNoPrediction ? 0.4 : 1,
        },
        borderStyle,
      ]}
    >
      {/* Rank number (finished only) */}
      {isFinished && (
        <Text
          style={{
            width: 20,
            color: rank ? (RANK_COLORS[rank] ?? "#555555") : "#555555",
            fontSize: 13,
            fontWeight: "700",
            marginRight: 8,
          }}
        >
          {rank ?? "–"}
        </Text>
      )}

      {/* Avatar */}
      {prediction.avatarUrl ? (
        <Image
          source={{ uri: prediction.avatarUrl }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            marginRight: 10,
          }}
        />
      ) : (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: isCurrentUser
              ? colors.primary
              : isNoPrediction
                ? "#333333"
                : colors.surfaceBorder,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Text
            style={{
              color: isCurrentUser ? colors.background : colors.textPrimary,
              fontSize: 13,
              fontWeight: "700",
            }}
          >
            {prediction.displayName[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
      )}

      {/* Name + prediction */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: isCurrentUser
              ? colors.secondary
              : isNoPrediction
                ? "#888888"
                : colors.textPrimary,
            fontSize: 14,
            fontWeight: "600",
          }}
          numberOfLines={1}
        >
          {isCurrentUser ? "You" : prediction.displayName}
        </Text>
        <Text
          style={{
            color: isNoPrediction
              ? "#555555"
              : isFinished && status
                ? "#888888"
                : colors.textPrimary,
            fontSize: 13,
            marginTop: 1,
          }}
        >
          {hasPrediction
            ? isFinished && status
              ? `${prediction.homeScorePred} – ${prediction.awayScorePred} · ${STATUS_LABELS[status]}`
              : `${prediction.homeScorePred} – ${prediction.awayScorePred}`
            : "No prediction"}
        </Text>
      </View>

      {/* Points / Status */}
      {hasPrediction && status && (
        <View style={{ alignItems: "flex-end" }}>
          {isFinished ? (
            // Finished: show final points
            rank === 1 ? (
              <View
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    color: colors.background,
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  +{potentialPoints ?? 0}
                </Text>
              </View>
            ) : (
              <Text
                style={{
                  color:
                    (potentialPoints ?? 0) > 0 ? colors.primary : "#555555",
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                +{potentialPoints ?? 0}
              </Text>
            )
          ) : (
            // Live: show status label + "would be +N"
            <>
              <Text
                style={{
                  color: statusColor,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {STATUS_LABELS[status]}
              </Text>
              <Text
                style={{
                  color: statusColor,
                  fontSize: 11,
                  opacity: 0.7,
                  marginTop: 1,
                }}
              >
                would be +{potentialPoints ?? 0}
              </Text>
            </>
          )}
        </View>
      )}

      {/* No prediction indicator */}
      {isNoPrediction && (
        <Text style={{ color: "#555555", fontSize: 13 }}>–</Text>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Run typecheck to verify**

Run: `npm run typecheck`
Expected: No errors in PredictionRow.tsx

- [ ] **Step 3: Commit**

```bash
git add src/components/predictions/PredictionRow.tsx
git commit -m "feat(predictions): add PredictionRow component (F1-20)"
```

---

### Task 5: GroupPredictions Component

**Files:**

- Create: `src/components/predictions/GroupPredictions.tsx`

- [ ] **Step 1: Create GroupPredictions container component**

Create `src/components/predictions/GroupPredictions.tsx`:

```typescript
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { colors } from "@lib/constants";
import { useGroupPredictions } from "@hooks/use-group-predictions";
import { calculatePotentialPoints, getPredictionStatus } from "@lib/scoring-utils";
import { PredictionRow } from "@components/predictions/PredictionRow";
import type { MatchStatus } from "@lib/matches-service";
import type { ScoringSystem } from "@lib/groups-service";
import type { GroupPrediction } from "@lib/prediction-service";
import type { PredictionStatus as PredStatus } from "@lib/scoring-utils";

type GroupPredictionsProps = {
  matchId: string;
  groupId: string;
  matchStatus: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  currentUserId: string;
  scoringSystem: ScoringSystem;
};

type EnrichedPrediction = {
  prediction: GroupPrediction;
  status: PredStatus | null;
  potentialPoints: number | null;
  rank: number | null;
};

export function GroupPredictions({
  matchId,
  groupId,
  matchStatus,
  homeScore,
  awayScore,
  currentUserId,
  scoringSystem,
}: GroupPredictionsProps) {
  const { predictions, isLoading, error } = useGroupPredictions(
    matchId,
    groupId,
    matchStatus,
  );

  // Don't render for non-live/finished matches
  if (matchStatus !== "live" && matchStatus !== "finished") return null;

  // Guard: hide if scores are null during live (shouldn't happen)
  if (homeScore === null || awayScore === null) return null;

  const isFinished = matchStatus === "finished";
  const sectionTitle = isFinished ? "GROUP RANKINGS" : "GROUP PREDICTIONS";

  if (isLoading) {
    return (
      <View style={{ marginTop: 28, alignItems: "center" }}>
        <ActivityIndicator
          testID="group-predictions-loading"
          size="small"
          color={colors.primary}
        />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ marginTop: 28, alignItems: "center" }}>
        <Text style={{ color: "#FF4444", fontSize: 13 }}>{error}</Text>
      </View>
    );
  }

  if (predictions.length === 0) {
    return (
      <View style={{ marginTop: 28, alignItems: "center" }}>
        <Text
          testID="group-predictions-empty"
          style={{ color: colors.textSecondary, fontSize: 14 }}
        >
          No one predicted this match yet
        </Text>
      </View>
    );
  }

  // Enrich predictions with status and points
  const enriched: EnrichedPrediction[] = predictions.map((p) => {
    if (p.homeScorePred === null || p.awayScorePred === null) {
      return { prediction: p, status: null, potentialPoints: null, rank: null };
    }

    const status = getPredictionStatus(
      p.homeScorePred,
      p.awayScorePred,
      homeScore,
      awayScore,
    );

    const points = isFinished
      ? (p.points ?? 0)
      : calculatePotentialPoints(
          p.homeScorePred,
          p.awayScorePred,
          homeScore,
          awayScore,
          scoringSystem,
        );

    return { prediction: p, status, potentialPoints: points, rank: null };
  });

  // Sort: predictions first (by points desc, then name), no-predictions last
  enriched.sort((a, b) => {
    const aHas = a.prediction.homeScorePred !== null;
    const bHas = b.prediction.homeScorePred !== null;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (!aHas && !bHas) {
      return a.prediction.displayName.localeCompare(b.prediction.displayName);
    }

    const pointsDiff = (b.potentialPoints ?? 0) - (a.potentialPoints ?? 0);
    if (pointsDiff !== 0) return pointsDiff;
    return a.prediction.displayName.localeCompare(b.prediction.displayName);
  });

  // Assign ranks (only for finished, standard ranking — skip on ties)
  if (isFinished) {
    let currentRank = 1;
    for (let i = 0; i < enriched.length; i++) {
      if (enriched[i].prediction.homeScorePred === null) {
        enriched[i].rank = null; // no prediction = no rank
        continue;
      }
      if (
        i > 0 &&
        enriched[i].potentialPoints === enriched[i - 1].potentialPoints &&
        enriched[i - 1].rank !== null
      ) {
        enriched[i].rank = enriched[i - 1].rank;
      } else {
        enriched[i].rank = currentRank;
      }
      currentRank = i + 2; // next potential rank (standard ranking skips)
    }
  }

  return (
    <View testID="group-predictions-section" style={{ marginTop: 28 }}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 10,
        }}
      >
        {sectionTitle}
      </Text>

      {enriched.map((item) => (
        <PredictionRow
          key={item.prediction.userId}
          prediction={item.prediction}
          rank={item.rank}
          status={item.status}
          potentialPoints={item.potentialPoints}
          isCurrentUser={item.prediction.userId === currentUserId}
          isFinished={isFinished}
        />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Run typecheck to verify**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/predictions/GroupPredictions.tsx
git commit -m "feat(predictions): add GroupPredictions container component (F1-20)"
```

---

### Task 6: Integrate into Match Detail Screen

**Files:**

- Modify: `app/match/[id].tsx`

- [ ] **Step 1: Add imports to match detail screen**

Add these imports at the top of `app/match/[id].tsx`:

```typescript
import { useAuth } from "@hooks/use-auth";
import { useGroupDetail } from "@hooks/use-group-detail";
import { GroupPredictions } from "@components/predictions/GroupPredictions";
```

- [ ] **Step 2: Add hooks inside the component**

Inside `MatchDetailScreen()`, after the existing `useGroupStore` line, add:

```typescript
const { user } = useAuth();
const { group } = useGroupDetail(activeGroupId ?? "");
```

Note: `useGroupDetail("")` when `activeGroupId` is null will attempt a fetch that returns no data — harmless since the `GroupPredictions` component is guarded by `activeGroupId && user?.id && group`.

- [ ] **Step 3: Add GroupPredictions component to the JSX**

In the `ScrollView`, after the prediction section block (`{activeGroupId && (...)}`) and before the closing `</ScrollView>`, add:

```tsx
{
  /* Group predictions (visible after kickoff) */
}
{
  activeGroupId && user?.id && group && (
    <GroupPredictions
      matchId={id ?? ""}
      groupId={activeGroupId}
      matchStatus={match.status}
      homeScore={match.home_score}
      awayScore={match.away_score}
      currentUserId={user.id}
      scoringSystem={group.scoring_system}
    />
  );
}
```

- [ ] **Step 4: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/match/[id].tsx
git commit -m "feat(predictions): integrate GroupPredictions into match detail (F1-20)"
```

---

### Task 7: Mock System Updates

**Files:**

- Modify: `src/lib/mock/fixtures.ts`

- [ ] **Step 1: Add group prediction fixtures for other members**

In `src/lib/mock/fixtures.ts`, add new prediction IDs and predictions for other group members on live and finished matches.

Add to `MOCK_PREDICTION_IDS`:

```typescript
export const MOCK_PREDICTION_IDS = {
  pred1: "pr000001-0000-0000-0000-000000000001",
  pred2: "pr000002-0000-0000-0000-000000000002",
  pred3: "pr000003-0000-0000-0000-000000000003",
  pred4: "pr000004-0000-0000-0000-000000000004",
  // Group predictions — other members on live1 and finished1
  pred5_alice_live1: "pr000005-0000-0000-0000-000000000005",
  pred6_bob_live1: "pr000006-0000-0000-0000-000000000006",
  pred7_alice_fin1: "pr000007-0000-0000-0000-000000000007",
  pred8_bob_fin1: "pr000008-0000-0000-0000-000000000008",
  pred9_carol_fin1: "pr000009-0000-0000-0000-000000000009",
} as const;
```

Add to `mockPredictions` array (live1 score is 1-0, finished1 score is 3-1):

```typescript
// Alice predicts live1: exact (1-0)
{
  id: MOCK_PREDICTION_IDS.pred5_alice_live1,
  user_id: MOCK_MEMBER_IDS.alice,
  match_id: MOCK_MATCH_IDS.live1,
  group_id: MOCK_GROUP_IDS.owned,
  home_score_pred: 1,
  away_score_pred: 0,
  points: null,
  created_at: daysAgo(1),
  updated_at: daysAgo(1),
},
// Bob predicts live1: wrong (0-2)
{
  id: MOCK_PREDICTION_IDS.pred6_bob_live1,
  user_id: MOCK_MEMBER_IDS.bob,
  match_id: MOCK_MATCH_IDS.live1,
  group_id: MOCK_GROUP_IDS.owned,
  home_score_pred: 0,
  away_score_pred: 2,
  points: null,
  created_at: daysAgo(1),
  updated_at: daysAgo(1),
},
// Alice predicts finished1: exact (3-1) → 5 pts
{
  id: MOCK_PREDICTION_IDS.pred7_alice_fin1,
  user_id: MOCK_MEMBER_IDS.alice,
  match_id: MOCK_MATCH_IDS.finished1,
  group_id: MOCK_GROUP_IDS.owned,
  home_score_pred: 3,
  away_score_pred: 1,
  points: 5,
  created_at: daysAgo(3),
  updated_at: daysAgo(3),
},
// Bob predicts finished1: correct result (2-0) → 3 pts
{
  id: MOCK_PREDICTION_IDS.pred8_bob_fin1,
  user_id: MOCK_MEMBER_IDS.bob,
  match_id: MOCK_MATCH_IDS.finished1,
  group_id: MOCK_GROUP_IDS.owned,
  home_score_pred: 2,
  away_score_pred: 0,
  points: 3,
  created_at: daysAgo(3),
  updated_at: daysAgo(3),
},
// Carol predicts finished1: wrong (0-1) → 0 pts
{
  id: MOCK_PREDICTION_IDS.pred9_carol_fin1,
  user_id: MOCK_MEMBER_IDS.carol,
  match_id: MOCK_MATCH_IDS.finished1,
  group_id: MOCK_GROUP_IDS.owned,
  home_score_pred: 0,
  away_score_pred: 1,
  points: 0,
  created_at: daysAgo(3),
  updated_at: daysAgo(3),
},
```

- [ ] **Step 2: Rename `points_earned` to `points` in existing predictions**

In `src/lib/mock/fixtures.ts`, rename all 4 occurrences of `points_earned` to `points` in the existing predictions (pred1-pred4). This matches the actual DB column name (`predictions.points`).

Then run `grep -r "points_earned" src/` to verify no other references exist. Fix any found.

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `npm run test:ci`
Expected: All existing tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/mock/fixtures.ts
git commit -m "feat(predictions): add group prediction fixtures for mock system (F1-20)"
```

---

### Task 8: CI Checks + Pre-PR Cleanup

**Files:**

- All changed files

- [ ] **Step 1: Run full CI checks**

```bash
npm run format:check && npm run lint && npm run typecheck && npm run test:ci
```

Fix any issues found. Use `npm run format` and `npm run lint:fix` for auto-fixable issues.

- [ ] **Step 2: Update TAREAS.md**

Mark F1-20 as completed (`[x]`). Also mark F1-21 and F1-22 as completed since they were already implemented in migration 00002.

- [ ] **Step 3: Update CLAUDE.md**

Add to the Project Structure section under `src/components/predictions/`:

- `GroupPredictions` — Group members' predictions list (post-kickoff)
- `PredictionRow` — Single prediction row in group predictions

Add to hooks list:

- `useGroupPredictions` — Loads group predictions for a match

Add `scoring-utils.ts` to `src/lib/` description.

- [ ] **Step 4: Final commit**

```bash
git add TAREAS.md CLAUDE.md
git commit -m "docs: update task tracking and project docs for F1-20"
```

- [ ] **Step 5: Push and create PR**

```bash
git push -u origin feature/F1-20-view-others-predictions
```

Create PR to `develop` with title: "feat(predictions): view group predictions post-kickoff (F1-20)"
