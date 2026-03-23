# F1-28: Detailed Player Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a player stats detail screen accessible from the leaderboard, showing prediction history, accuracy stats, and streaks within a group.

**Architecture:** New root-level screen `app/player-stats/[userId].tsx` with data passed via route params (summary stats from `leaderboard_cache`) and a new service function (`fetchPlayerGroupStats`) for prediction history. Streaks computed client-side in a new hook. `LeaderboardRow` wrapped in `Pressable` for navigation.

**Tech Stack:** React Native, Expo Router, Supabase (PostgREST), date-fns + @date-fns/tz, Jest + React Native Testing Library

---

## File Structure

| Action | File                                                             | Responsibility                                                                               |
| ------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Create | `src/lib/player-stats-service.ts`                                | `fetchPlayerGroupStats()` + `PlayerPredictionRecord` type + `computeStreaks()` pure function |
| Create | `src/hooks/use-player-stats.ts`                                  | Hook: calls service, sorts client-side, computes streaks, returns state                      |
| Create | `src/components/ranking/PlayerStatsHeader.tsx`                   | Avatar, name, position badge, total points                                                   |
| Create | `src/components/ranking/StatsGrid.tsx`                           | 2x2 summary grid                                                                             |
| Create | `src/components/ranking/StreakDisplay.tsx`                       | Current + best streak display                                                                |
| Create | `src/components/ranking/PredictionHistoryRow.tsx`                | Individual prediction row with color coding                                                  |
| Create | `app/player-stats/[userId].tsx`                                  | Screen: assembles header, grid, streaks, SectionList                                         |
| Modify | `src/components/ranking/LeaderboardRow.tsx`                      | Wrap in `Pressable`, add `onPress` prop for navigation                                       |
| Modify | `app/(tabs)/ranking.tsx`                                         | Pass `onPress` handler to `LeaderboardRow` with router navigation                            |
| Modify | `src/lib/mock/fixtures.ts`                                       | Add more predictions for Alice/Bob/Carol with varied points                                  |
| Create | `src/__tests__/lib/player-stats-service.test.ts`                 | Service + streak computation tests                                                           |
| Create | `src/__tests__/hooks/use-player-stats.test.ts`                   | Hook tests                                                                                   |
| Create | `src/__tests__/components/ranking/PlayerStatsHeader.test.tsx`    | Header component tests                                                                       |
| Create | `src/__tests__/components/ranking/StatsGrid.test.tsx`            | Grid component tests                                                                         |
| Create | `src/__tests__/components/ranking/StreakDisplay.test.tsx`        | Streak display tests                                                                         |
| Create | `src/__tests__/components/ranking/PredictionHistoryRow.test.tsx` | History row tests                                                                            |
| Create | `src/__tests__/screens/player-stats-screen.test.tsx`             | Screen integration tests                                                                     |

---

## Task 1: Service Layer — Types + `computeStreaks` Pure Function

**Files:**

- Create: `src/lib/player-stats-service.ts`
- Create: `src/__tests__/lib/player-stats-service.test.ts`

- [ ] **Step 1: Write failing tests for `computeStreaks`**

```typescript
// src/__tests__/lib/player-stats-service.test.ts
import {
  computeStreaks,
  type PlayerPredictionRecord,
} from "@lib/player-stats-service";

// Helper to create a minimal prediction record with just points and kickoff
function rec(points: number, daysAgo: number): PlayerPredictionRecord {
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

describe("computeStreaks", () => {
  it("returns zeros for empty array", () => {
    const result = computeStreaks([]);
    expect(result).toEqual({
      currentStreak: { count: 0, type: "correct" },
      bestStreak: 0,
    });
  });

  it("computes current correct streak from most recent", () => {
    // Most recent first: 3pts, 5pts, 0pts, 3pts (chronological: 3,0,5,3)
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
    // Chronological: 5, 3, 3, 3, 0, 5 → best streak = 4 (first four), current = 1
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="player-stats-service" --no-coverage
```

Expected: FAIL — module `@lib/player-stats-service` not found.

- [ ] **Step 3: Implement types + `computeStreaks`**

```typescript
// src/lib/player-stats-service.ts
import { supabase } from "@lib/supabase";

// ── Types ────────────────────────────────────────────────────────────

export interface PlayerPredictionRecord {
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

export interface StreakResult {
  currentStreak: { count: number; type: "correct" | "wrong" };
  bestStreak: number;
}

// ── Streak computation (pure function) ───────────────────────────────

export function computeStreaks(
  predictions: PlayerPredictionRecord[],
): StreakResult {
  if (predictions.length === 0) {
    return { currentStreak: { count: 0, type: "correct" }, bestStreak: 0 };
  }

  // Sort chronologically (oldest first) by kickoff_time
  const sorted = [...predictions].sort(
    (a, b) =>
      new Date(a.match.kickoff_time).getTime() -
      new Date(b.match.kickoff_time).getTime(),
  );

  // Best streak: longest consecutive run of points > 0
  let bestStreak = 0;
  let tempStreak = 0;
  for (const pred of sorted) {
    if (pred.points > 0) {
      tempStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  // Current streak: from most recent backward
  const last = sorted[sorted.length - 1];
  const isCorrect = last.points > 0;
  let currentCount = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const correct = sorted[i].points > 0;
    if (correct === isCorrect) {
      currentCount++;
    } else {
      break;
    }
  }

  return {
    currentStreak: {
      count: currentCount,
      type: isCorrect ? "correct" : "wrong",
    },
    bestStreak,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="player-stats-service" --no-coverage
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/player-stats-service.ts src/__tests__/lib/player-stats-service.test.ts
git commit -m "feat(player-stats): add types and computeStreaks pure function"
```

---

## Task 2: Service Layer — `fetchPlayerGroupStats` Function

**Files:**

- Modify: `src/lib/player-stats-service.ts`
- Modify: `src/__tests__/lib/player-stats-service.test.ts`

- [ ] **Step 1: Write failing test for `fetchPlayerGroupStats`**

Add to `src/__tests__/lib/player-stats-service.test.ts`:

```typescript
import { fetchPlayerGroupStats } from "@lib/player-stats-service";

// Mock supabase
jest.mock("@lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from "@lib/supabase";

const mockFrom = supabase.from as jest.Mock;

describe("fetchPlayerGroupStats", () => {
  beforeEach(() => jest.clearAllMocks());

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

    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockResolvedValue({ data: mockData, error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const result = await fetchPlayerGroupStats("user-1", "group-1");

    expect(mockFrom).toHaveBeenCalledWith("predictions");
    expect(chain.select).toHaveBeenCalledWith(
      expect.stringContaining("match:matches!match_id"),
    );
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(chain.eq).toHaveBeenCalledWith("group_id", "group-1");
    expect(chain.not).toHaveBeenCalledWith("points", "is", null);
    expect(result).toHaveLength(1);
    expect(result[0].points).toBe(3);
    expect(result[0].match.tournament_name).toBe("Copa");
  });

  it("throws on supabase error", async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "RLS denied" },
      }),
    };
    mockFrom.mockReturnValue(chain);

    await expect(fetchPlayerGroupStats("user-1", "group-1")).rejects.toThrow(
      "RLS denied",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="player-stats-service" --no-coverage
```

Expected: FAIL — `fetchPlayerGroupStats` is not exported.

- [ ] **Step 3: Implement `fetchPlayerGroupStats`**

Add to `src/lib/player-stats-service.ts` after `computeStreaks`:

```typescript
// ── Fetch player prediction history ──────────────────────────────────

export async function fetchPlayerGroupStats(
  userId: string,
  groupId: string,
): Promise<PlayerPredictionRecord[]> {
  const { data, error } = await supabase
    .from("predictions")
    .select(
      `id, home_score_pred, away_score_pred, points,
       match:matches!match_id (
         id, home_team_name, away_team_name, home_score, away_score,
         kickoff_time, status, matchday,
         tournament:tournaments ( name, short_name )
       )`,
    )
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .not("points", "is", null);

  if (error) throw new Error(error.message);

  return (data as Record<string, unknown>[]).map((row) => {
    const m = row.match as Record<string, unknown>;
    const t = m.tournament as { name: string; short_name: string | null };
    return {
      id: row.id as string,
      home_score_pred: row.home_score_pred as number,
      away_score_pred: row.away_score_pred as number,
      points: row.points as number,
      match: {
        id: m.id as string,
        home_team_name: m.home_team_name as string,
        away_team_name: m.away_team_name as string,
        home_score: m.home_score as number,
        away_score: m.away_score as number,
        kickoff_time: m.kickoff_time as string,
        status: m.status as string,
        matchday: m.matchday as number | null,
        tournament_name: t.name,
        tournament_short_name: t.short_name,
      },
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="player-stats-service" --no-coverage
```

Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/player-stats-service.ts src/__tests__/lib/player-stats-service.test.ts
git commit -m "feat(player-stats): add fetchPlayerGroupStats service function"
```

---

## Task 3: `usePlayerStats` Hook

**Files:**

- Create: `src/hooks/use-player-stats.ts`
- Create: `src/__tests__/hooks/use-player-stats.test.ts`

- [ ] **Step 1: Write failing tests for the hook**

```typescript
// src/__tests__/hooks/use-player-stats.test.ts
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { usePlayerStats } from "@hooks/use-player-stats";
import * as service from "@lib/player-stats-service";

jest.mock("@lib/player-stats-service");

const mockFetch = service.fetchPlayerGroupStats as jest.MockedFunction<
  typeof service.fetchPlayerGroupStats
>;

const mockPredictions: service.PlayerPredictionRecord[] = [
  {
    id: "p1",
    home_score_pred: 3,
    away_score_pred: 1,
    points: 5,
    match: {
      id: "m1",
      home_team_name: "Team A",
      away_team_name: "Team B",
      home_score: 3,
      away_score: 1,
      kickoff_time: "2026-03-20T20:00:00Z",
      status: "finished",
      matchday: 4,
      tournament_name: "Copa",
      tournament_short_name: "COP",
    },
  },
  {
    id: "p2",
    home_score_pred: 0,
    away_score_pred: 0,
    points: 0,
    match: {
      id: "m2",
      home_team_name: "Team C",
      away_team_name: "Team D",
      home_score: 2,
      away_score: 1,
      kickoff_time: "2026-03-19T20:00:00Z",
      status: "finished",
      matchday: 3,
      tournament_name: "Copa",
      tournament_short_name: "COP",
    },
  },
  {
    id: "p3",
    home_score_pred: 1,
    away_score_pred: 0,
    points: 3,
    match: {
      id: "m3",
      home_team_name: "Team E",
      away_team_name: "Team F",
      home_score: 2,
      away_score: 0,
      kickoff_time: "2026-03-18T20:00:00Z",
      status: "finished",
      matchday: 3,
      tournament_name: "Copa",
      tournament_short_name: null,
    },
  },
];

describe("usePlayerStats", () => {
  beforeEach(() => jest.clearAllMocks());

  it("starts in loading state", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => usePlayerStats("u1", "g1"));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.predictions).toEqual([]);
  });

  it("fetches and sorts predictions by kickoff_time DESC", async () => {
    mockFetch.mockResolvedValue(mockPredictions);
    const { result } = renderHook(() => usePlayerStats("u1", "g1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.predictions).toHaveLength(3);
    // Most recent first
    expect(result.current.predictions[0].id).toBe("p1");
    expect(result.current.predictions[1].id).toBe("p2");
    expect(result.current.predictions[2].id).toBe("p3");
  });

  it("computes streaks from predictions", async () => {
    mockFetch.mockResolvedValue(mockPredictions);
    const { result } = renderHook(() => usePlayerStats("u1", "g1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Chronological: p3(3pts), p2(0pts), p1(5pts) → current=1 correct, best=1
    expect(result.current.streaks.currentStreak).toEqual({
      count: 1,
      type: "correct",
    });
    expect(result.current.streaks.bestStreak).toBe(1);
  });

  it("sets error on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => usePlayerStats("u1", "g1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Network error");
  });

  it("refetch reloads data", async () => {
    mockFetch.mockResolvedValue([]);
    const { result } = renderHook(() => usePlayerStats("u1", "g1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockResolvedValue(mockPredictions);
    await act(async () => {
      await result.current.refetch();
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.current.predictions).toHaveLength(3);
  });

  it("does not fetch if userId is empty", () => {
    const { result } = renderHook(() => usePlayerStats("", "g1"));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("does not fetch if groupId is empty", () => {
    const { result } = renderHook(() => usePlayerStats("u1", ""));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="use-player-stats" --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```typescript
// src/hooks/use-player-stats.ts
import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchPlayerGroupStats,
  computeStreaks,
  type PlayerPredictionRecord,
  type StreakResult,
} from "@lib/player-stats-service";

interface UsePlayerStatsResult {
  predictions: PlayerPredictionRecord[];
  streaks: StreakResult;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const EMPTY_STREAKS: StreakResult = {
  currentStreak: { count: 0, type: "correct" },
  bestStreak: 0,
};

export function usePlayerStats(
  userId: string,
  groupId: string,
): UsePlayerStatsResult {
  const [predictions, setPredictions] = useState<PlayerPredictionRecord[]>([]);
  const [streaks, setStreaks] = useState<StreakResult>(EMPTY_STREAKS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (!userId || !groupId) return;
    setIsLoading(true);
    setError(null);
    cancelledRef.current = false;

    try {
      const data = await fetchPlayerGroupStats(userId, groupId);
      if (cancelledRef.current) return;

      // Sort by kickoff_time DESC (most recent first) for display
      const sorted = [...data].sort(
        (a, b) =>
          new Date(b.match.kickoff_time).getTime() -
          new Date(a.match.kickoff_time).getTime(),
      );
      setPredictions(sorted);
      setStreaks(computeStreaks(data));
    } catch (err) {
      if (cancelledRef.current) return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  }, [userId, groupId]);

  useEffect(() => {
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  return { predictions, streaks, isLoading, error, refetch: load };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="use-player-stats" --no-coverage
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-player-stats.ts src/__tests__/hooks/use-player-stats.test.ts
git commit -m "feat(player-stats): add usePlayerStats hook with streak computation"
```

---

## Task 4: Presentational Components

**Files:**

- Create: `src/components/ranking/PlayerStatsHeader.tsx`
- Create: `src/components/ranking/StatsGrid.tsx`
- Create: `src/components/ranking/StreakDisplay.tsx`
- Create: `src/components/ranking/PredictionHistoryRow.tsx`
- Create: `src/__tests__/components/ranking/PlayerStatsHeader.test.tsx`
- Create: `src/__tests__/components/ranking/StatsGrid.test.tsx`
- Create: `src/__tests__/components/ranking/StreakDisplay.test.tsx`
- Create: `src/__tests__/components/ranking/PredictionHistoryRow.test.tsx`

### Step 4a: PlayerStatsHeader

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/components/ranking/PlayerStatsHeader.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { PlayerStatsHeader } from "@components/ranking/PlayerStatsHeader";

describe("PlayerStatsHeader", () => {
  const baseProps = {
    displayName: "Alice Rodriguez",
    username: "alice_mvd",
    avatarUrl: null as string | null,
    userId: "u1",
    position: 1,
    totalPoints: 42,
  };

  it("renders display name and username", () => {
    render(<PlayerStatsHeader {...baseProps} />);
    expect(screen.getByText("Alice Rodriguez")).toBeTruthy();
    expect(screen.getByText("@alice_mvd")).toBeTruthy();
  });

  it("renders medal emoji for position 1", () => {
    render(<PlayerStatsHeader {...baseProps} />);
    expect(screen.getByText(/🥇/)).toBeTruthy();
  });

  it("renders position number for rank 4+", () => {
    render(<PlayerStatsHeader {...baseProps} position={4} />);
    expect(screen.getByText("#4")).toBeTruthy();
  });

  it("renders total points", () => {
    render(<PlayerStatsHeader {...baseProps} />);
    expect(screen.getByText(/42/)).toBeTruthy();
  });

  it("renders letter avatar from first char of display name", () => {
    render(<PlayerStatsHeader {...baseProps} />);
    expect(screen.getByText("A")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="PlayerStatsHeader" --no-coverage
```

- [ ] **Step 3: Implement PlayerStatsHeader**

```typescript
// src/components/ranking/PlayerStatsHeader.tsx
import React from "react";
import { View, Text } from "react-native";
import { colors } from "@lib/constants";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const AVATAR_COLORS = [
  colors.primary,
  colors.secondary,
  colors.accent,
  "#E05C7F",
  "#4ECDC4",
];

interface PlayerStatsHeaderProps {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  userId: string;
  position: number;
  totalPoints: number;
}

export function PlayerStatsHeader({
  displayName,
  username,
  userId,
  position,
  totalPoints,
}: PlayerStatsHeaderProps) {
  const letter = displayName.charAt(0).toUpperCase();
  const accentColor =
    AVATAR_COLORS[userId.charCodeAt(userId.length - 1) % AVATAR_COLORS.length];
  const medal = MEDAL[position];

  return (
    <View
      testID="player-stats-header"
      style={{ alignItems: "center", paddingVertical: 24, paddingHorizontal: 16 }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: accentColor + "33",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Text style={{ color: accentColor, fontWeight: "700", fontSize: 28 }}>
          {letter}
        </Text>
      </View>

      {/* Name + username */}
      <Text
        style={{
          color: colors.textPrimary,
          fontWeight: "700",
          fontSize: 20,
        }}
      >
        {displayName}
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 14,
          marginTop: 2,
        }}
      >
        @{username}
      </Text>

      {/* Position + points */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          marginTop: 12,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 14 }}>
            {medal ?? `#${position}`}
          </Text>
        </View>
        <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 24 }}>
          {totalPoints}
          <Text
            style={{
              color: colors.textSecondary,
              fontWeight: "400",
              fontSize: 14,
            }}
          >
            {" "}pts
          </Text>
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="PlayerStatsHeader" --no-coverage
```

### Step 4b: StatsGrid

- [ ] **Step 5: Write failing test**

```typescript
// src/__tests__/components/ranking/StatsGrid.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { StatsGrid } from "@components/ranking/StatsGrid";

describe("StatsGrid", () => {
  it("renders all four stats", () => {
    render(
      <StatsGrid
        matchesPlayed={15}
        exactScores={3}
        correctResults={8}
        totalPoints={42}
      />,
    );
    expect(screen.getByText("15")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("2.8")).toBeTruthy(); // 42/15
  });

  it("renders labels", () => {
    render(
      <StatsGrid
        matchesPlayed={10}
        exactScores={1}
        correctResults={5}
        totalPoints={29}
      />,
    );
    expect(screen.getByText("Matches")).toBeTruthy();
    expect(screen.getByText("Exact")).toBeTruthy();
    expect(screen.getByText("Correct")).toBeTruthy();
    expect(screen.getByText("Avg Pts")).toBeTruthy();
  });

  it("shows 0.0 avg when no matches played", () => {
    render(
      <StatsGrid
        matchesPlayed={0}
        exactScores={0}
        correctResults={0}
        totalPoints={0}
      />,
    );
    expect(screen.getByText("0.0")).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npm test -- --testPathPattern="StatsGrid" --no-coverage
```

- [ ] **Step 7: Implement StatsGrid**

```typescript
// src/components/ranking/StatsGrid.tsx
import React from "react";
import { View, Text } from "react-native";
import { colors } from "@lib/constants";

interface StatsGridProps {
  matchesPlayed: number;
  exactScores: number;
  correctResults: number;
  totalPoints: number;
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: 12,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 20 }}>
        {value}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

export function StatsGrid({
  matchesPlayed,
  exactScores,
  correctResults,
  totalPoints,
}: StatsGridProps) {
  const avg =
    matchesPlayed > 0 ? (totalPoints / matchesPlayed).toFixed(1) : "0.0";

  return (
    <View testID="stats-grid" style={{ paddingHorizontal: 16, gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <StatCell value={String(matchesPlayed)} label="Matches" />
        <StatCell value={String(exactScores)} label="Exact" />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <StatCell value={String(correctResults)} label="Correct" />
        <StatCell value={avg} label="Avg Pts" />
      </View>
    </View>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npm test -- --testPathPattern="StatsGrid" --no-coverage
```

### Step 4c: StreakDisplay

- [ ] **Step 9: Write failing test**

```typescript
// src/__tests__/components/ranking/StreakDisplay.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { StreakDisplay } from "@components/ranking/StreakDisplay";

describe("StreakDisplay", () => {
  it("renders current correct streak", () => {
    render(
      <StreakDisplay
        currentStreak={{ count: 5, type: "correct" }}
        bestStreak={7}
      />,
    );
    expect(screen.getByText(/5 correct in a row/)).toBeTruthy();
  });

  it("renders current wrong streak", () => {
    render(
      <StreakDisplay
        currentStreak={{ count: 3, type: "wrong" }}
        bestStreak={5}
      />,
    );
    expect(screen.getByText(/3 wrong in a row/)).toBeTruthy();
  });

  it("renders best streak", () => {
    render(
      <StreakDisplay
        currentStreak={{ count: 2, type: "correct" }}
        bestStreak={8}
      />,
    );
    expect(screen.getByText(/Best: 8 correct/)).toBeTruthy();
  });

  it("renders no streak message when count is 0", () => {
    render(
      <StreakDisplay
        currentStreak={{ count: 0, type: "correct" }}
        bestStreak={0}
      />,
    );
    expect(screen.getByText(/No streak yet/)).toBeTruthy();
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

```bash
npm test -- --testPathPattern="StreakDisplay" --no-coverage
```

- [ ] **Step 11: Implement StreakDisplay**

```typescript
// src/components/ranking/StreakDisplay.tsx
import React from "react";
import { View, Text } from "react-native";
import { colors } from "@lib/constants";

interface StreakDisplayProps {
  currentStreak: { count: number; type: "correct" | "wrong" };
  bestStreak: number;
}

export function StreakDisplay({
  currentStreak,
  bestStreak,
}: StreakDisplayProps) {
  return (
    <View
      testID="streak-display"
      style={{
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        padding: 16,
        gap: 8,
      }}
    >
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>
        STREAKS
      </Text>
      {currentStreak.count === 0 ? (
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          No streak yet
        </Text>
      ) : (
        <>
          <Text
            style={{
              color:
                currentStreak.type === "correct"
                  ? colors.success
                  : colors.textSecondary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {currentStreak.count} {currentStreak.type} in a row
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Best: {bestStreak} correct in a row
          </Text>
        </>
      )}
    </View>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

```bash
npm test -- --testPathPattern="StreakDisplay" --no-coverage
```

### Step 4d: PredictionHistoryRow

- [ ] **Step 13: Write failing test**

```typescript
// src/__tests__/components/ranking/PredictionHistoryRow.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { PredictionHistoryRow } from "@components/ranking/PredictionHistoryRow";
import type { PlayerPredictionRecord } from "@lib/player-stats-service";

const basePred: PlayerPredictionRecord = {
  id: "p1",
  home_score_pred: 3,
  away_score_pred: 1,
  points: 5,
  match: {
    id: "m1",
    home_team_name: "Cerro Porteno",
    away_team_name: "Olimpia",
    home_score: 3,
    away_score: 1,
    kickoff_time: "2026-03-20T20:00:00Z",
    status: "finished",
    matchday: 4,
    tournament_name: "Copa Libertadores",
    tournament_short_name: "Libertadores",
  },
};

describe("PredictionHistoryRow", () => {
  it("renders team names", () => {
    render(<PredictionHistoryRow prediction={basePred} />);
    expect(screen.getByText(/Cerro Porteno/)).toBeTruthy();
    expect(screen.getByText(/Olimpia/)).toBeTruthy();
  });

  it("renders prediction and actual scores", () => {
    render(<PredictionHistoryRow prediction={basePred} />);
    expect(screen.getByText("3 - 1")).toBeTruthy(); // prediction
    expect(screen.getByText("3 - 1")).toBeTruthy(); // actual (same for exact)
  });

  it("renders points", () => {
    render(<PredictionHistoryRow prediction={basePred} />);
    expect(screen.getByText("+5")).toBeTruthy();
  });

  it("renders tournament short name", () => {
    render(<PredictionHistoryRow prediction={basePred} />);
    expect(screen.getByText("Libertadores")).toBeTruthy();
  });

  it("shows 0 points for wrong prediction", () => {
    render(
      <PredictionHistoryRow prediction={{ ...basePred, points: 0 }} />,
    );
    expect(screen.getByText("+0")).toBeTruthy();
  });

  it("has testID with prediction id", () => {
    render(<PredictionHistoryRow prediction={basePred} />);
    expect(screen.getByTestId("prediction-history-row-p1")).toBeTruthy();
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

```bash
npm test -- --testPathPattern="PredictionHistoryRow" --no-coverage
```

- [ ] **Step 15: Implement PredictionHistoryRow**

```typescript
// src/components/ranking/PredictionHistoryRow.tsx
import React from "react";
import { View, Text } from "react-native";
import { colors } from "@lib/constants";
import type { PlayerPredictionRecord } from "@lib/player-stats-service";

interface PredictionHistoryRowProps {
  prediction: PlayerPredictionRecord;
}

function pointsColor(points: number): string {
  if (points >= 5) return colors.success;
  if (points >= 3) return colors.primary;
  return colors.textSecondary;
}

function rowBg(points: number): string {
  if (points >= 5) return "rgba(0, 196, 140, 0.08)";
  if (points >= 3) return "rgba(0, 212, 170, 0.06)";
  return "transparent";
}

export function PredictionHistoryRow({
  prediction,
}: PredictionHistoryRowProps) {
  const { match, points } = prediction;

  return (
    <View
      testID={`prediction-history-row-${prediction.id}`}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: rowBg(points),
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceBorder,
      }}
    >
      {/* Tournament */}
      {match.tournament_short_name && (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 10,
            marginBottom: 2,
          }}
        >
          {match.tournament_short_name}
        </Text>
      )}

      {/* Match + scores row */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 14,
              fontWeight: "500",
            }}
            numberOfLines={1}
          >
            {match.home_team_name} vs {match.away_team_name}
          </Text>

          {/* Prediction vs Actual */}
          <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Pred:{" "}
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                {prediction.home_score_pred} - {prediction.away_score_pred}
              </Text>
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Result:{" "}
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                {match.home_score} - {match.away_score}
              </Text>
            </Text>
          </View>
        </View>

        {/* Points */}
        <Text
          style={{
            color: pointsColor(points),
            fontWeight: "700",
            fontSize: 16,
            marginLeft: 8,
          }}
        >
          +{points}
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 16: Run all four component tests**

```bash
npm test -- --testPathPattern="(PlayerStatsHeader|StatsGrid|StreakDisplay|PredictionHistoryRow)" --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 17: Commit all components**

```bash
git add src/components/ranking/PlayerStatsHeader.tsx src/components/ranking/StatsGrid.tsx src/components/ranking/StreakDisplay.tsx src/components/ranking/PredictionHistoryRow.tsx src/__tests__/components/ranking/PlayerStatsHeader.test.tsx src/__tests__/components/ranking/StatsGrid.test.tsx src/__tests__/components/ranking/StreakDisplay.test.tsx src/__tests__/components/ranking/PredictionHistoryRow.test.tsx
git commit -m "feat(player-stats): add presentational components with tests"
```

---

## Task 5: Player Stats Screen

**Files:**

- Create: `app/player-stats/[userId].tsx`
- Create: `src/__tests__/screens/player-stats-screen.test.tsx`

- [ ] **Step 1: Write failing screen tests**

```typescript
// src/__tests__/screens/player-stats-screen.test.tsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";

// Mock hooks
jest.mock("@hooks/use-player-stats");
jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u-current" } }),
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({
    userId: "u1",
    groupId: "g1",
    displayName: "Alice Rodriguez",
    username: "alice_mvd",
    avatarUrl: "",
    position: "2",
    totalPoints: "38",
    exactScores: "2",
    correctResults: "9",
    matchesPlayed: "14",
  }),
  useRouter: () => ({ back: jest.fn() }),
}));

import { usePlayerStats } from "@hooks/use-player-stats";
import type { PlayerPredictionRecord, StreakResult } from "@lib/player-stats-service";

const mockUsePlayerStats = usePlayerStats as jest.MockedFunction<
  typeof usePlayerStats
>;

// Lazy-import screen after mocks
const loadScreen = () =>
  require("../../app/player-stats/[userId]").default;

const mockPredictions: PlayerPredictionRecord[] = [
  {
    id: "p1",
    home_score_pred: 3,
    away_score_pred: 1,
    points: 5,
    match: {
      id: "m1",
      home_team_name: "Cerro Porteno",
      away_team_name: "Olimpia",
      home_score: 3,
      away_score: 1,
      kickoff_time: "2026-03-20T20:00:00Z",
      status: "finished",
      matchday: 4,
      tournament_name: "Copa Libertadores",
      tournament_short_name: "Libertadores",
    },
  },
];

const mockStreaks: StreakResult = {
  currentStreak: { count: 3, type: "correct" },
  bestStreak: 5,
};

describe("PlayerStatsScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders loading state", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: [],
      streaks: { currentStreak: { count: 0, type: "correct" }, bestStreak: 0 },
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByTestId("loading-indicator")).toBeTruthy();
  });

  it("renders error state", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: [],
      streaks: { currentStreak: { count: 0, type: "correct" }, bestStreak: 0 },
      isLoading: false,
      error: "Network error",
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByText("Network error")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("renders header with player info from route params", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: mockPredictions,
      streaks: mockStreaks,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByText("Alice Rodriguez")).toBeTruthy();
    expect(screen.getByText("@alice_mvd")).toBeTruthy();
  });

  it("renders stats grid from route params", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: mockPredictions,
      streaks: mockStreaks,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByTestId("stats-grid")).toBeTruthy();
  });

  it("renders streak display", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: mockPredictions,
      streaks: mockStreaks,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByTestId("streak-display")).toBeTruthy();
    expect(screen.getByText(/3 correct in a row/)).toBeTruthy();
  });

  it("renders prediction history rows", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: mockPredictions,
      streaks: mockStreaks,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByTestId("prediction-history-row-p1")).toBeTruthy();
  });

  it("renders empty state when no predictions", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: [],
      streaks: { currentStreak: { count: 0, type: "correct" }, bestStreak: 0 },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByText(/No predictions scored yet/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="player-stats-screen" --no-coverage
```

- [ ] **Step 3: Implement the screen**

```typescript
// app/player-stats/[userId].tsx
import React, { useCallback } from "react";
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { colors } from "@lib/constants";
import { usePlayerStats } from "@hooks/use-player-stats";
import { PlayerStatsHeader } from "@components/ranking/PlayerStatsHeader";
import { StatsGrid } from "@components/ranking/StatsGrid";
import { StreakDisplay } from "@components/ranking/StreakDisplay";
import { PredictionHistoryRow } from "@components/ranking/PredictionHistoryRow";
import type { PlayerPredictionRecord } from "@lib/player-stats-service";

type Section = {
  title: string;
  data: PlayerPredictionRecord[];
};

function groupByDate(predictions: PlayerPredictionRecord[]): Section[] {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const map = new Map<string, PlayerPredictionRecord[]>();

  for (const pred of predictions) {
    const local = new TZDate(pred.match.kickoff_time, tz);
    const key = format(local, "MMM d, yyyy");
    const arr = map.get(key);
    if (arr) {
      arr.push(pred);
    } else {
      map.set(key, [pred]);
    }
  }

  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

export default function PlayerStatsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    userId: string;
    groupId: string;
    displayName: string;
    username: string;
    avatarUrl: string;
    position: string;
    totalPoints: string;
    exactScores: string;
    correctResults: string;
    matchesPlayed: string;
  }>();

  const userId = params.userId;
  const groupId = params.groupId;

  const { predictions, streaks, isLoading, error, refetch } = usePlayerStats(
    userId,
    groupId,
  );

  const sections = groupByDate(predictions);

  const renderItem = useCallback(
    ({ item }: { item: PlayerPredictionRecord }) => (
      <PredictionHistoryRow prediction={item} />
    ),
    [],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View
        style={{
          backgroundColor: colors.background,
          paddingHorizontal: 16,
          paddingVertical: 6,
        }}
      >
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          {section.title}
        </Text>
      </View>
    ),
    [],
  );

  const position = Number(params.position) || 0;
  const totalPoints = Number(params.totalPoints) || 0;
  const exactScores = Number(params.exactScores) || 0;
  const correctResults = Number(params.correctResults) || 0;
  const matchesPlayed = Number(params.matchesPlayed) || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top bar with back button */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <TouchableOpacity
          testID="back-button"
          onPress={() => router.back()}
          style={{ padding: 8 }}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 18,
            fontWeight: "600",
            marginLeft: 4,
          }}
        >
          Player Stats
        </Text>
      </View>

      {isLoading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator
            testID="loading-indicator"
            size="large"
            color={colors.primary}
          />
        </View>
      ) : error ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.accent}
          />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
              marginTop: 12,
              textAlign: "center",
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {error}
          </Text>
          <TouchableOpacity
            testID="retry-button"
            onPress={refetch}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 10,
              borderRadius: 20,
              marginTop: 16,
            }}
          >
            <Text style={{ color: colors.background, fontWeight: "600" }}>
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={
            <>
              <PlayerStatsHeader
                displayName={params.displayName || "Player"}
                username={params.username || "unknown"}
                avatarUrl={params.avatarUrl || null}
                userId={userId}
                position={position}
                totalPoints={totalPoints}
              />
              <StatsGrid
                matchesPlayed={matchesPlayed}
                exactScores={exactScores}
                correctResults={correctResults}
                totalPoints={totalPoints}
              />
              <StreakDisplay
                currentStreak={streaks.currentStreak}
                bestStreak={streaks.bestStreak}
              />
              {/* Section list header for history */}
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  fontWeight: "600",
                  paddingHorizontal: 16,
                  paddingTop: 20,
                  paddingBottom: 8,
                }}
              >
                PREDICTION HISTORY
              </Text>
            </>
          }
          ListEmptyComponent={
            <View
              style={{
                alignItems: "center",
                paddingVertical: 32,
                paddingHorizontal: 32,
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={40}
                color={colors.textSecondary}
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 14,
                  marginTop: 12,
                  textAlign: "center",
                }}
              >
                No predictions scored yet
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="player-stats-screen" --no-coverage
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/player-stats/[userId].tsx src/__tests__/screens/player-stats-screen.test.tsx
git commit -m "feat(player-stats): add player stats screen with SectionList"
```

---

## Task 6: Wire LeaderboardRow Navigation

**Files:**

- Modify: `src/components/ranking/LeaderboardRow.tsx`
- Modify: `app/(tabs)/ranking.tsx`
- Modify: `src/__tests__/components/ranking/LeaderboardRow.test.tsx`

- [ ] **Step 1: Write failing test for `onPress` prop**

Add to `src/__tests__/components/ranking/LeaderboardRow.test.tsx`:

```typescript
import { fireEvent } from "@testing-library/react-native";

// ... existing tests ...

it("calls onPress when row is tapped", () => {
  const onPress = jest.fn();
  render(
    <LeaderboardRow
      entry={baseEntry}
      isCurrentUser={false}
      onPress={onPress}
    />,
  );
  fireEvent.press(screen.getByTestId(`leaderboard-row-${baseEntry.user_id}`));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it("does not crash when onPress is not provided", () => {
  render(<LeaderboardRow entry={baseEntry} isCurrentUser={false} />);
  fireEvent.press(screen.getByTestId(`leaderboard-row-${baseEntry.user_id}`));
  // no crash = pass
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="LeaderboardRow" --no-coverage
```

Expected: FAIL — `onPress` not recognized / `Pressable` not used.

- [ ] **Step 3: Modify LeaderboardRow to add `onPress` prop**

In `src/components/ranking/LeaderboardRow.tsx`:

1. Add `Pressable` to react-native imports
2. Add `onPress?: () => void` to `LeaderboardRowProps`
3. Wrap the outer `<View>` in a `<Pressable>` with the `onPress` handler
4. Move the `testID` to the `Pressable`

Changes:

- Line 2: Add `Pressable` to imports: `import { View, Text, StyleSheet, Pressable } from "react-native";`
- Line 37: Add `onPress?: () => void;` to the interface
- Line 44: Destructure `onPress` from props
- Line 70-84: Replace `<View testID={...} style={{...}}>` with `<Pressable testID={...} onPress={onPress} style={{...}}>`
- Line 214: Change closing `</View>` to `</Pressable>`

The full modified render return should wrap everything in:

```tsx
<Pressable
  testID={`leaderboard-row-${entry.user_id}`}
  onPress={onPress}
  style={{
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: medal ? medal.bg : "transparent",
    borderLeftWidth: isCurrentUser ? 3 : 0,
    borderLeftColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    overflow: "hidden",
  }}
>
  {/* ... all existing children unchanged ... */}
</Pressable>
```

- [ ] **Step 4: Modify ranking.tsx to pass `onPress` with navigation**

In `app/(tabs)/ranking.tsx`, update the `renderItem` callback:

```typescript
const renderItem = useCallback(
  ({ item }: { item: LeaderboardEntry }) => (
    <LeaderboardRow
      entry={item}
      isCurrentUser={item.user_id === user?.id}
      positionChange={positionChanges[item.user_id]}
      onPress={() =>
        router.push({
          pathname: "/player-stats/[userId]",
          params: {
            userId: item.user_id,
            groupId: activeGroupId ?? "",
            displayName: item.display_name,
            username: item.username,
            avatarUrl: item.avatar_url ?? "",
            position: String(item.position),
            totalPoints: String(item.total_points),
            exactScores: String(item.exact_scores),
            correctResults: String(item.correct_results),
            matchesPlayed: String(item.matches_played),
          },
        })
      }
    />
  ),
  [user?.id, positionChanges, activeGroupId, router],
);
```

- [ ] **Step 5: Run LeaderboardRow tests to verify they pass**

```bash
npm test -- --testPathPattern="LeaderboardRow" --no-coverage
```

Expected: All tests PASS (existing + 2 new).

- [ ] **Step 6: Commit**

```bash
git add src/components/ranking/LeaderboardRow.tsx app/\(tabs\)/ranking.tsx src/__tests__/components/ranking/LeaderboardRow.test.tsx
git commit -m "feat(player-stats): wire LeaderboardRow navigation to player stats"
```

---

## Task 7: Mock Data for Player Stats

**Files:**

- Modify: `src/lib/mock/fixtures.ts`

- [ ] **Step 1: Add more mock predictions for group members**

Add to `src/lib/mock/fixtures.ts` — extend `MOCK_PREDICTION_IDS` and `mockPredictions`:

New prediction IDs to add:

```typescript
// Add to MOCK_PREDICTION_IDS:
pred10_alice_fin2: "pr000010-0000-0000-0000-000000000010",
pred11_alice_fin3: "pr000011-0000-0000-0000-000000000011",
pred12_bob_fin2: "pr000012-0000-0000-0000-000000000012",
pred13_bob_fin3: "pr000013-0000-0000-0000-000000000013",
pred14_carol_fin2: "pr000014-0000-0000-0000-000000000014",
pred15_carol_fin3: "pr000015-0000-0000-0000-000000000015",
pred16_user_fin3: "pr000016-0000-0000-0000-000000000016",
```

New predictions to append to `mockPredictions`:

```typescript
// finished2: Universitario 0-0 Alianza Lima
// Alice: wrong (1-0) → 0 pts
{
  id: MOCK_PREDICTION_IDS.pred10_alice_fin2,
  user_id: MOCK_MEMBER_IDS.alice,
  match_id: MOCK_MATCH_IDS.finished2,
  group_id: MOCK_GROUP_IDS.owned,
  home_score_pred: 1,
  away_score_pred: 0,
  points: 0,
  created_at: daysAgo(4),
  updated_at: daysAgo(4),
},
// Alice: correct result (2-1) → 3 pts (Emelec 1-2 Barcelona SC → away win)
{
  id: MOCK_PREDICTION_IDS.pred11_alice_fin3,
  user_id: MOCK_MEMBER_IDS.alice,
  match_id: MOCK_MATCH_IDS.finished3,
  group_id: MOCK_GROUP_IDS.owned,
  home_score_pred: 0,
  away_score_pred: 1,
  points: 3,
  created_at: daysAgo(4),
  updated_at: daysAgo(4),
},
// Bob: exact (0-0) → 5 pts
{
  id: MOCK_PREDICTION_IDS.pred12_bob_fin2,
  user_id: MOCK_MEMBER_IDS.bob,
  match_id: MOCK_MATCH_IDS.finished2,
  group_id: MOCK_GROUP_IDS.owned,
  home_score_pred: 0,
  away_score_pred: 0,
  points: 5,
  created_at: daysAgo(4),
  updated_at: daysAgo(4),
},
// Bob: wrong (2-0) → 0 pts (Emelec 1-2 Barcelona SC)
{
  id: MOCK_PREDICTION_IDS.pred13_bob_fin3,
  user_id: MOCK_MEMBER_IDS.bob,
  match_id: MOCK_MATCH_IDS.finished3,
  group_id: MOCK_GROUP_IDS.owned,
  home_score_pred: 2,
  away_score_pred: 0,
  points: 0,
  created_at: daysAgo(4),
  updated_at: daysAgo(4),
},
// Carol: exact (0-0) → 5 pts
{
  id: MOCK_PREDICTION_IDS.pred14_carol_fin2,
  user_id: MOCK_MEMBER_IDS.carol,
  match_id: MOCK_MATCH_IDS.finished2,
  group_id: MOCK_GROUP_IDS.owned,
  home_score_pred: 0,
  away_score_pred: 0,
  points: 5,
  created_at: daysAgo(4),
  updated_at: daysAgo(4),
},
// Carol: correct result (0-1) → 4 pts (correct result + goal diff)
{
  id: MOCK_PREDICTION_IDS.pred15_carol_fin3,
  user_id: MOCK_MEMBER_IDS.carol,
  match_id: MOCK_MATCH_IDS.finished3,
  group_id: MOCK_GROUP_IDS.owned,
  home_score_pred: 0,
  away_score_pred: 1,
  points: 4,
  created_at: daysAgo(4),
  updated_at: daysAgo(4),
},
// User: wrong (2-0) → 0 pts (Emelec 1-2 Barcelona SC)
{
  id: MOCK_PREDICTION_IDS.pred16_user_fin3,
  user_id: MOCK_USER_ID,
  match_id: MOCK_MATCH_IDS.finished3,
  group_id: MOCK_GROUP_IDS.owned,
  home_score_pred: 2,
  away_score_pred: 0,
  points: 0,
  created_at: daysAgo(4),
  updated_at: daysAgo(4),
},
```

- [ ] **Step 2: Run existing tests to verify nothing breaks**

```bash
npm test -- --no-coverage
```

Expected: All existing tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mock/fixtures.ts
git commit -m "feat(player-stats): add mock predictions for group members"
```

---

## Task 8: Full CI Check + Cleanup

- [ ] **Step 1: Run format check**

```bash
npm run format:check
```

If issues, fix with `npm run format`.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

If issues, fix with `npm run lint:fix`.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Fix any type errors.

- [ ] **Step 4: Run full test suite with coverage**

```bash
npm run test:ci
```

All tests must pass.

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: lint and typecheck fixes for F1-28"
```

---

## Task 9: Documentation Updates

**Files:**

- Modify: `TAREAS.md` — Mark F1-28 as complete
- Modify: `CLAUDE.md` — Update project structure and component inventory

- [ ] **Step 1: Update TAREAS.md**

Change F1-28 from `[ ]` to `[x]` and add implementation notes.

- [ ] **Step 2: Update CLAUDE.md**

Add to the project structure section:

- `app/player-stats/[userId].tsx` — Player stats detail screen
- `src/lib/player-stats-service.ts` — types, fetch, streak computation
- `src/hooks/use-player-stats.ts` — hook for player stats
- `src/components/ranking/` — add `PlayerStatsHeader`, `StatsGrid`, `StreakDisplay`, `PredictionHistoryRow`
- Update `LeaderboardRow` description to mention `onPress` navigation

- [ ] **Step 3: Commit docs**

```bash
git add TAREAS.md CLAUDE.md
git commit -m "docs: update TAREAS.md and CLAUDE.md for F1-28"
```
