# F1-19: Save Predictions with Time Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live countdown to kickoff, true optimistic save with rollback, and graceful post-kickoff error handling to the match detail prediction screen.

**Architecture:** New `use-countdown` hook (pure timer, reusable). `use-match-detail` upgraded to set prediction state before save resolves and rollback on failure. Screen updated to compose both hooks, display countdown, and auto-transition to read-only on RLS error.

**Tech Stack:** React Native, TypeScript, Jest + @testing-library/react-native (fake timers for interval tests), renderHook for hook tests.

---

## File Map

| File                                                    | Action     | Responsibility                                                         |
| ------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| `src/hooks/use-countdown.ts`                            | **Create** | Pure timer hook: secondsRemaining, isExpired, formatted                |
| `src/__tests__/hooks/use-countdown.test.ts`             | **Create** | Unit tests for the countdown hook                                      |
| `src/hooks/use-match-detail.ts`                         | **Modify** | Optimistic save, rollback, `isLockedByServer`, background refetch      |
| `src/__tests__/hooks/use-match-detail.test.ts`          | **Modify** | Add/update tests for new save behavior                                 |
| `app/match/[id].tsx`                                    | **Modify** | Compose countdown, update isEditable, countdown label, auto-transition |
| `src/__tests__/navigation/match-detail-screen.test.tsx` | **Modify** | Mock useCountdown, add isLockedByServer tests                          |
| `src/lib/mock/fixtures.ts`                              | **Modify** | Add `scheduledExpired` match fixture                                   |

---

## Task 1: `use-countdown` hook (TDD)

**Files:**

- Create: `src/__tests__/hooks/use-countdown.test.ts`
- Create: `src/hooks/use-countdown.ts`

- [ ] **Step 1.1: Create the test file with failing tests**

Create `src/__tests__/hooks/use-countdown.test.ts`:

```typescript
import { renderHook, act } from "@testing-library/react-native";

/* eslint-disable @typescript-eslint/no-require-imports */
const { useCountdown } = require("@hooks/use-countdown");
/* eslint-enable @typescript-eslint/no-require-imports */

describe("useCountdown", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns expired state when targetDate is null", () => {
    const { result } = renderHook(() => useCountdown(null));
    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.isExpired).toBe(true);
    expect(result.current.formatted).toBe("");
  });

  it("returns expired state when targetDate is in the past", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const { result } = renderHook(() => useCountdown(past));
    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.isExpired).toBe(true);
    expect(result.current.formatted).toBe("");
  });

  it("returns correct secondsRemaining for future date", () => {
    const future = new Date(Date.now() + 7200_000).toISOString(); // 2h
    const { result } = renderHook(() => useCountdown(future));
    expect(result.current.secondsRemaining).toBeGreaterThan(7190);
    expect(result.current.isExpired).toBe(false);
  });

  it("formats > 1h as 'Xh Ym'", () => {
    const future = new Date(
      Date.now() + 2 * 3600_000 + 34 * 60_000,
    ).toISOString();
    const { result } = renderHook(() => useCountdown(future));
    expect(result.current.formatted).toMatch(/^\d+h \d+m$/);
  });

  it("formats exactly 3600s as '1h 0m' not '60m 0s'", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const { result } = renderHook(() => useCountdown(future));
    expect(result.current.formatted).toBe("1h 0m");
  });

  it("formats 1m–1h as 'Xm Ys'", () => {
    const future = new Date(Date.now() + 4 * 60_000 + 23_000).toISOString();
    const { result } = renderHook(() => useCountdown(future));
    expect(result.current.formatted).toMatch(/^\d+m \d+s$/);
  });

  it("formats < 1m as 'Xs'", () => {
    const future = new Date(Date.now() + 42_000).toISOString();
    const { result } = renderHook(() => useCountdown(future));
    expect(result.current.formatted).toBe("42s");
  });

  it("ticks down every second", () => {
    const future = new Date(Date.now() + 10_000).toISOString();
    const { result } = renderHook(() => useCountdown(future));
    const initial = result.current.secondsRemaining;
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.secondsRemaining).toBeLessThanOrEqual(initial - 3);
  });

  it("clears interval on unmount", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const future = new Date(Date.now() + 60_000).toISOString();
    const { unmount } = renderHook(() => useCountdown(future));
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("restarts interval when targetDate changes", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const future1 = new Date(Date.now() + 60_000).toISOString();
    const future2 = new Date(Date.now() + 120_000).toISOString();
    const { rerender } = renderHook(
      ({ date }: { date: string }) => useCountdown(date),
      { initialProps: { date: future1 } },
    );
    const callsBefore = clearIntervalSpy.mock.calls.length;
    rerender({ date: future2 });
    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    clearIntervalSpy.mockRestore();
  });
});
```

- [ ] **Step 1.2: Run tests — expect FAIL (module not found)**

```bash
npm run test:unit -- --testPathPattern="use-countdown" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '@hooks/use-countdown'`

- [ ] **Step 1.3: Create the hook implementation**

Create `src/hooks/use-countdown.ts`:

```typescript
import { useState, useEffect } from "react";

function computeSecondsRemaining(targetMs: number): number {
  return Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
}

function formatCountdown(seconds: number): string {
  if (seconds === 0) return "";
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  return `${seconds}s`;
}

export function useCountdown(targetDate: string | Date | null): {
  secondsRemaining: number;
  isExpired: boolean;
  formatted: string;
} {
  const targetMs = targetDate ? new Date(targetDate).getTime() : null;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() =>
    targetMs !== null ? computeSecondsRemaining(targetMs) : 0,
  );

  useEffect(() => {
    if (targetMs === null) {
      setSecondsRemaining(0);
      return;
    }
    // Sync immediately when targetMs changes
    setSecondsRemaining(computeSecondsRemaining(targetMs));

    const id = setInterval(() => {
      setSecondsRemaining(computeSecondsRemaining(targetMs));
    }, 1000);

    return () => clearInterval(id);
  }, [targetMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    secondsRemaining,
    isExpired: secondsRemaining === 0,
    formatted: formatCountdown(secondsRemaining),
  };
}
```

- [ ] **Step 1.4: Run tests — expect GREEN**

```bash
npm run test:unit -- --testPathPattern="use-countdown" --no-coverage 2>&1 | tail -20
```

Expected: PASS — all 9 tests pass

- [ ] **Step 1.5: Commit**

```bash
git add src/hooks/use-countdown.ts src/__tests__/hooks/use-countdown.test.ts
git commit -m "feat(countdown): add use-countdown hook with interval tick and formatted output"
```

---

## Task 2: Add `scheduledExpired` mock fixture

**Files:**

- Modify: `src/lib/mock/fixtures.ts`

- [ ] **Step 2.1: Add the fixture**

In `src/lib/mock/fixtures.ts`, add `scheduledExpired` to `MOCK_MATCH_IDS` and a corresponding match entry.

Find the `MOCK_MATCH_IDS` object:

```typescript
export const MOCK_MATCH_IDS = {
  scheduled1: "mt000001-0000-0000-0000-000000000001",
  // ...
  postponed1: "mt000010-0000-0000-0000-000000000010",
} as const;
```

Replace it with:

```typescript
export const MOCK_MATCH_IDS = {
  scheduled1: "mt000001-0000-0000-0000-000000000001",
  scheduled2: "mt000002-0000-0000-0000-000000000002",
  scheduled3: "mt000003-0000-0000-0000-000000000003",
  scheduled4: "mt000004-0000-0000-0000-000000000004",
  scheduledExpired: "mt000011-0000-0000-0000-000000000011",
  live1: "mt000005-0000-0000-0000-000000000005",
  live2: "mt000006-0000-0000-0000-000000000006",
  finished1: "mt000007-0000-0000-0000-000000000007",
  finished2: "mt000008-0000-0000-0000-000000000008",
  finished3: "mt000009-0000-0000-0000-000000000009",
  postponed1: "mt000010-0000-0000-0000-000000000010",
} as const;
```

Then in the `mockMatches` array, after the `postponed1` entry, add:

```typescript
  {
    id: MOCK_MATCH_IDS.scheduledExpired,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Tigres UANL",
    away_team_name: "Club America",
    home_team_logo: "https://placehold.co/48x48?text=TIG",
    away_team_logo: "https://placehold.co/48x48?text=AME",
    home_score: null,
    away_score: null,
    // status is still "scheduled" — sync lag hasn't updated it yet
    status: "scheduled",
    kickoff_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    matchday: 5,
    venue: "Estadio Universitario",
    api_match_id: 1011,
  },
```

- [ ] **Step 2.2: Run tests — ensure nothing broken**

```bash
npm run test:unit -- --testPathPattern="mock" --no-coverage 2>&1 | tail -10
```

Expected: PASS (or no tests for fixtures, no failures)

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/mock/fixtures.ts
git commit -m "feat(mock): add scheduledExpired fixture for client-side kickoff lock edge case"
```

---

## Task 3: Update `use-match-detail` (optimistic save + rollback + isLockedByServer)

**Files:**

- Modify: `src/__tests__/hooks/use-match-detail.test.ts`
- Modify: `src/hooks/use-match-detail.ts`

- [ ] **Step 3.1: Update test file with new/updated tests**

Replace the entire contents of `src/__tests__/hooks/use-match-detail.test.ts` with:

```typescript
import { renderHook, act, waitFor } from "@testing-library/react-native";

const mockFetchMatchDetail = jest.fn();
const mockSavePrediction = jest.fn();
jest.mock("@lib/prediction-service", () => ({
  fetchMatchDetail: (...args: unknown[]) => mockFetchMatchDetail(...args),
  savePrediction: (...args: unknown[]) => mockSavePrediction(...args),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isInitialized: true }),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { useMatchDetail } = require("@hooks/use-match-detail");
/* eslint-enable @typescript-eslint/no-require-imports */

const mockMatch = {
  id: "m1",
  tournament_id: "t1",
  tournament_name: "League",
  tournament_short_name: "LG",
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
};

describe("useMatchDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads match and prediction on mount", async () => {
    const pred = { id: "p1", home_score_pred: 2, away_score_pred: 1 };
    mockFetchMatchDetail.mockResolvedValue({
      match: mockMatch,
      prediction: pred,
    });

    const { result } = renderHook(() => useMatchDetail("m1", "g1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.match).toEqual(mockMatch);
    expect(result.current.prediction).toEqual(pred);
    expect(result.current.error).toBeNull();
  });

  it("sets error on fetch failure", async () => {
    mockFetchMatchDetail.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useMatchDetail("m1", "g1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Network error");
    expect(result.current.match).toBeNull();
  });

  it("does not fetch when groupId is null", async () => {
    const { result } = renderHook(() => useMatchDetail("m1", null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchMatchDetail).not.toHaveBeenCalled();
  });

  describe("save — optimistic update", () => {
    it("sets prediction optimistically before save resolves", async () => {
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: null,
      });
      // Delayed save so we can inspect state mid-flight
      let resolveSave!: () => void;
      mockSavePrediction.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
      );

      const { result } = renderHook(() => useMatchDetail("m1", "g1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Start save — do not await yet
      act(() => {
        result.current.save(3, 0);
      });

      // Prediction should be set optimistically before save resolves
      expect(result.current.prediction).toEqual({
        id: "optimistic",
        home_score_pred: 3,
        away_score_pred: 0,
      });

      // Clean up: resolve save and wait for background refetch
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: { id: "p1", home_score_pred: 3, away_score_pred: 0 },
      });
      await act(async () => {
        resolveSave();
      });
    });

    it("returns true on successful save", async () => {
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: null,
      });
      mockSavePrediction.mockResolvedValue(undefined);
      mockFetchMatchDetail.mockResolvedValueOnce({
        match: mockMatch,
        prediction: null,
      });
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: { id: "p1", home_score_pred: 3, away_score_pred: 0 },
      });

      const { result } = renderHook(() => useMatchDetail("m1", "g1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean;
      await act(async () => {
        success = await result.current.save(3, 0);
      });

      expect(success!).toBe(true);
      expect(result.current.isSaving).toBe(false);
    });
  });

  describe("save — rollback on failure", () => {
    it("rolls back prediction to previous value on generic error", async () => {
      const existingPred = { id: "p1", home_score_pred: 1, away_score_pred: 0 };
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: existingPred,
      });
      mockSavePrediction.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useMatchDetail("m1", "g1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.save(3, 0);
      });

      // Should be rolled back to the original prediction
      expect(result.current.prediction).toEqual(existingPred);
      expect(result.current.saveError).toBe("Network error");
      expect(result.current.isLockedByServer).toBe(false);
    });

    it("rolls back and sets isLockedByServer on RLS error", async () => {
      const existingPred = { id: "p1", home_score_pred: 1, away_score_pred: 0 };
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: existingPred,
      });
      mockSavePrediction.mockRejectedValue(
        new Error(
          'new row violates row-level security policy for table "predictions"',
        ),
      );

      const { result } = renderHook(() => useMatchDetail("m1", "g1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean;
      await act(async () => {
        success = await result.current.save(3, 0);
      });

      expect(success!).toBe(false);
      expect(result.current.prediction).toEqual(existingPred); // rolled back
      expect(result.current.saveError).toBe(
        "Predictions are locked — the match has already started.",
      );
      expect(result.current.isLockedByServer).toBe(true);
    });

    it("shows raw error message for non-RLS failures", async () => {
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: null,
      });
      mockSavePrediction.mockRejectedValue(new Error("timeout"));

      const { result } = renderHook(() => useMatchDetail("m1", "g1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.save(3, 0);
      });

      expect(result.current.saveError).toBe("timeout");
      expect(result.current.isLockedByServer).toBe(false);
    });
  });

  describe("isLockedByServer reset", () => {
    it("resets isLockedByServer to false at start of refetch", async () => {
      // Set up: initial load succeeds, save fails with RLS
      mockFetchMatchDetail.mockResolvedValueOnce({
        match: mockMatch,
        prediction: null,
      });
      mockSavePrediction.mockRejectedValue(
        new Error("row-level security policy"),
      );
      // Subsequent fetch (triggered by refetch after RLS error) returns fresh state
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: null,
      });

      const { result } = renderHook(() => useMatchDetail("m1", "g1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.save(3, 0);
      });

      expect(result.current.isLockedByServer).toBe(true);

      // Explicit refetch resets isLockedByServer
      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.isLockedByServer).toBe(false);
    });
  });
});
```

- [ ] **Step 3.2: Run tests — expect FAIL (tests reference `isLockedByServer` which doesn't exist yet)**

```bash
npm run test:unit -- --testPathPattern="use-match-detail" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — tests for `isLockedByServer`, rollback, and optimistic update fail

- [ ] **Step 3.3: Update `use-match-detail.ts` implementation**

Replace the entire contents of `src/hooks/use-match-detail.ts` with:

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@hooks/use-auth";
import { fetchMatchDetail, savePrediction } from "@lib/prediction-service";
import type { MatchDetail, ExistingPrediction } from "@lib/prediction-service";

function isRLSError(message: string): boolean {
  return message.toLowerCase().includes("row-level security");
}

type UseMatchDetailResult = {
  match: MatchDetail | null;
  prediction: ExistingPrediction | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  save: (home: number, away: number) => Promise<boolean>;
  isSaving: boolean;
  saveError: string | null;
  isLockedByServer: boolean;
};

export function useMatchDetail(
  matchId: string | undefined,
  groupId: string | null,
): UseMatchDetailResult {
  const { user, isInitialized } = useAuth();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [prediction, setPrediction] = useState<ExistingPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLockedByServer, setIsLockedByServer] = useState(false);
  const cancelledRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!user?.id || !matchId || !groupId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsLockedByServer(false); // reset on every load/refetch

    try {
      const result = await fetchMatchDetail(matchId, groupId, user.id);
      if (!cancelledRef.current) {
        setMatch(result.match);
        setPrediction(result.prediction);
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
  }, [matchId, groupId, user?.id]);

  useEffect(() => {
    cancelledRef.current = false;
    if (!isInitialized) return;
    loadData();
    return () => {
      cancelledRef.current = true;
    };
  }, [isInitialized, loadData]);

  const refetch = useCallback(async () => {
    cancelledRef.current = false;
    await loadData();
  }, [loadData]);

  const save = useCallback(
    async (home: number, away: number): Promise<boolean> => {
      if (!user?.id || !matchId || !groupId) return false;

      const previousPrediction = prediction; // capture for rollback

      // Optimistic update — show result immediately before network call
      setPrediction({
        id: "optimistic",
        home_score_pred: home,
        away_score_pred: away,
      });
      setIsSaving(true);
      setSaveError(null);

      try {
        await savePrediction(matchId, groupId, user.id, home, away);
        // Background refetch to replace fake optimistic ID with real DB row
        refetch();
        return true;
      } catch (err: unknown) {
        // Rollback to previous state
        setPrediction(previousPrediction);
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (isRLSError(msg)) {
          setSaveError(
            "Predictions are locked — the match has already started.",
          );
          setIsLockedByServer(true);
          refetch(); // background refetch to sync match status
        } else {
          setSaveError(msg);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [matchId, groupId, user?.id, prediction, refetch],
  );

  return {
    match,
    prediction,
    isLoading,
    error,
    refetch,
    save,
    isSaving,
    saveError,
    isLockedByServer,
  };
}
```

- [ ] **Step 3.4: Run tests — expect GREEN**

```bash
npm run test:unit -- --testPathPattern="use-match-detail" --no-coverage 2>&1 | tail -20
```

Expected: PASS — all tests pass

- [ ] **Step 3.5: Commit**

```bash
git add src/hooks/use-match-detail.ts src/__tests__/hooks/use-match-detail.test.ts
git commit -m "feat(predictions): optimistic save with rollback and isLockedByServer on RLS error"
```

---

## Task 4: Update the match detail screen

**Files:**

- Modify: `src/__tests__/navigation/match-detail-screen.test.tsx`
- Modify: `app/match/[id].tsx`

- [ ] **Step 4.1: Update screen test file**

Replace the entire contents of `src/__tests__/navigation/match-detail-screen.test.tsx` with:

```typescript
import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

// Mock expo-router
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "m1" }),
  useRouter: () => ({ back: mockBack }),
}));

// Mock group-store
jest.mock("@stores/group-store", () => ({
  useGroupStore: (selector: (s: { activeGroupId: string }) => unknown) =>
    selector({ activeGroupId: "g1" }),
}));

// Mock useMatchDetail hook
const mockSave = jest.fn();
const mockRefetch = jest.fn();
let mockHookReturn: Record<string, unknown>;

jest.mock("@hooks/use-match-detail", () => ({
  useMatchDetail: () => mockHookReturn,
}));

// Mock useCountdown hook
const mockUseCountdown = jest.fn();
jest.mock("@hooks/use-countdown", () => ({
  useCountdown: (...args: unknown[]) => mockUseCountdown(...args),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const MatchDetailScreen = require("../../../app/match/[id]").default;
/* eslint-enable @typescript-eslint/no-require-imports */

const mockMatch = {
  id: "m1",
  tournament_id: "t1",
  tournament_name: "Premier League",
  tournament_short_name: "PL",
  home_team_name: "Arsenal",
  away_team_name: "Chelsea",
  home_team_logo: null,
  away_team_logo: null,
  home_score: null,
  away_score: null,
  status: "scheduled",
  kickoff_time: "2027-03-20T18:00:00Z",
  matchday: 12,
  venue: "Emirates Stadium",
};

const defaultCountdown = {
  secondsRemaining: 7200,
  isExpired: false,
  formatted: "2h 0m",
};

describe("MatchDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseCountdown.mockReturnValue(defaultCountdown);
    mockHookReturn = {
      match: mockMatch,
      prediction: null,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      save: mockSave,
      isSaving: false,
      saveError: null,
      isLockedByServer: false,
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows loading state", () => {
    mockHookReturn = { ...mockHookReturn, isLoading: true, match: null };
    const { getByTestId } = render(<MatchDetailScreen />);
    expect(getByTestId("loading-indicator")).toBeTruthy();
  });

  it("shows error state with retry", () => {
    mockHookReturn = { ...mockHookReturn, error: "Network error", match: null };
    const { getByText, getByTestId } = render(<MatchDetailScreen />);
    expect(getByText("Network error")).toBeTruthy();
    fireEvent.press(getByTestId("retry-button"));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("renders match info and steppers for scheduled match", () => {
    const { getAllByText, getByText } = render(<MatchDetailScreen />);
    expect(getAllByText("Arsenal").length).toBe(2);
    expect(getAllByText("Chelsea").length).toBe(2);
    expect(getByText("Premier League")).toBeTruthy();
    expect(getByText("Your Prediction")).toBeTruthy();
  });

  it("pre-fills steppers with existing prediction", () => {
    mockHookReturn = {
      ...mockHookReturn,
      prediction: { id: "p1", home_score_pred: 2, away_score_pred: 1 },
    };
    const { getAllByText } = render(<MatchDetailScreen />);
    expect(getAllByText("2").length).toBeGreaterThan(0);
    expect(getAllByText("1").length).toBeGreaterThan(0);
  });

  it("shows read-only for finished match with prediction", () => {
    mockHookReturn = {
      ...mockHookReturn,
      match: { ...mockMatch, status: "finished", home_score: 3, away_score: 1 },
      prediction: { id: "p1", home_score_pred: 2, away_score_pred: 1 },
    };
    const { getByText, queryByText } = render(<MatchDetailScreen />);
    expect(getByText(/Your prediction: 2 – 1/i)).toBeTruthy();
    expect(queryByText("Save Prediction")).toBeNull();
  });

  it("calls save when Save Prediction is pressed", async () => {
    mockSave.mockResolvedValue(true);
    const { getByText } = render(<MatchDetailScreen />);
    await act(async () => {
      fireEvent.press(getByText("Save Prediction"));
    });
    expect(mockSave).toHaveBeenCalledWith(0, 0);
  });

  it("navigates back when back button is pressed", () => {
    const { getByTestId } = render(<MatchDetailScreen />);
    fireEvent.press(getByTestId("back-button"));
    expect(mockBack).toHaveBeenCalled();
  });

  describe("countdown display", () => {
    it("shows countdown label when editable and time remaining", () => {
      mockUseCountdown.mockReturnValue({
        secondsRemaining: 7200,
        isExpired: false,
        formatted: "2h 0m",
      });
      const { getByText } = render(<MatchDetailScreen />);
      expect(getByText("Locks in 2h 0m")).toBeTruthy();
    });

    it("does not show countdown label when formatted is empty", () => {
      mockUseCountdown.mockReturnValue({
        secondsRemaining: 0,
        isExpired: true,
        formatted: "",
      });
      const { queryByText } = render(<MatchDetailScreen />);
      expect(queryByText(/Locks in/)).toBeNull();
    });
  });

  describe("isEditable — time-based lock", () => {
    it("locks form when isExpired is true even if status is scheduled", () => {
      mockUseCountdown.mockReturnValue({
        secondsRemaining: 0,
        isExpired: true,
        formatted: "",
      });
      // match is still "scheduled" (DB sync lag)
      const { queryByText } = render(<MatchDetailScreen />);
      expect(queryByText("Save Prediction")).toBeNull();
      expect(queryByText("Update Prediction")).toBeNull();
    });

    it("locks form when isLockedByServer is true", () => {
      mockHookReturn = { ...mockHookReturn, isLockedByServer: true };
      const { queryByText } = render(<MatchDetailScreen />);
      expect(queryByText("Save Prediction")).toBeNull();
    });
  });

  describe("RLS error auto-transition", () => {
    it("shows error in read-only section when isLockedByServer is true", () => {
      mockHookReturn = {
        ...mockHookReturn,
        isLockedByServer: true,
        saveError: "Predictions are locked — the match has already started.",
      };
      const { getByText, queryByText } = render(<MatchDetailScreen />);
      expect(queryByText("Save Prediction")).toBeNull(); // no save button
      expect(getByText("Predictions are locked — the match has already started.")).toBeTruthy();
    });

    it("clears the error banner after 3 seconds", () => {
      mockHookReturn = {
        ...mockHookReturn,
        isLockedByServer: true,
        saveError: "Predictions are locked — the match has already started.",
      };
      const { queryByText } = render(<MatchDetailScreen />);
      expect(
        queryByText("Predictions are locked — the match has already started."),
      ).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(
        queryByText("Predictions are locked — the match has already started."),
      ).toBeNull();
    });
  });
});
```

- [ ] **Step 4.2: Run tests — expect FAIL**

```bash
npm run test:unit -- --testPathPattern="match-detail-screen" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — new tests reference UI elements not yet implemented

- [ ] **Step 4.3: Update `app/match/[id].tsx`**

**Note:** Only two sections of the file change. Everything else (loading state, error state, match info JSX, TeamRow/Header sub-components at the bottom) stays exactly as-is. Make targeted edits:

The key changes are:

1. Add imports for `useCountdown` and `useState` (for `errorBanner`)
2. Add `isLockedByServer` from hook
3. Add `useCountdown` call
4. Update `isEditable` formula
5. Add `useEffect` for 3s error banner
6. Add countdown label JSX
7. Add error banner in read-only section

Replace the top of the file (imports + MatchDetailScreen function body up to the JSX):

```typescript
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import { colors } from "@lib/constants";
import { useGroupStore } from "@stores/group-store";
import { useMatchDetail } from "@hooks/use-match-detail";
import { useCountdown } from "@hooks/use-countdown";
import { ScoreStepper } from "@components/predictions/ScoreStepper";
import { SaveConfirmation } from "@components/predictions/SaveConfirmation";

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const activeGroupId = useGroupStore((s) => s.activeGroupId);

  const {
    match,
    prediction,
    isLoading,
    error,
    refetch,
    save,
    isSaving,
    saveError,
    isLockedByServer,
  } = useMatchDetail(id, activeGroupId);

  const { isExpired, formatted: countdownFormatted } = useCountdown(
    match?.kickoff_time ?? null,
  );

  const [homeScore, setHomeScore] = useState<number | null>(null);
  const [awayScore, setAwayScore] = useState<number | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Show saveError in read-only section for 3s then auto-clear
  useEffect(() => {
    if (!saveError) {
      setErrorBanner(null);
      return;
    }
    setErrorBanner(saveError);
    const id = setTimeout(() => setErrorBanner(null), 3000);
    return () => clearTimeout(id);
  }, [saveError]);

  // Derive displayed scores (stepper state or prediction fallback)
  const displayHome = homeScore ?? prediction?.home_score_pred ?? 0;
  const displayAway = awayScore ?? prediction?.away_score_pred ?? 0;

  const isEditable =
    match?.status === "scheduled" && !isExpired && !isLockedByServer;

  const isChanged =
    prediction != null
      ? displayHome !== prediction.home_score_pred ||
        displayAway !== prediction.away_score_pred
      : homeScore !== null || awayScore !== null;

  const handleSave = useCallback(async () => {
    const success = await save(displayHome, displayAway);
    if (success) {
      setShowConfirmation(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHomeScore(null);
      setAwayScore(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [save, displayHome, displayAway]);
```

Then update the prediction section JSX. Find the `{/* Prediction section */}` block in the screen and replace it:

```typescript
        {/* Prediction section */}
        {activeGroupId && (
          <View style={{ marginTop: 28 }}>
            {isEditable ? (
              <>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 18,
                    fontWeight: "700",
                    marginBottom: 4,
                  }}
                >
                  Your Prediction
                </Text>

                {/* Countdown label */}
                {countdownFormatted !== "" && (
                  <Text
                    style={{
                      color: colors.accent,
                      fontSize: 13,
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    Locks in {countdownFormatted}
                  </Text>
                )}

                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 4,
                  }}
                >
                  <ScoreStepper
                    teamName={match.home_team_name}
                    teamLogo={match.home_team_logo}
                    score={displayHome}
                    onIncrement={() => setHomeScore(displayHome + 1)}
                    onDecrement={() => setHomeScore(displayHome - 1)}
                  />
                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.surfaceBorder,
                      marginHorizontal: 4,
                    }}
                  />
                  <ScoreStepper
                    teamName={match.away_team_name}
                    teamLogo={match.away_team_logo}
                    score={displayAway}
                    onIncrement={() => setAwayScore(displayAway + 1)}
                    onDecrement={() => setAwayScore(displayAway - 1)}
                  />
                </View>

                {/* Save button */}
                <TouchableOpacity
                  testID="save-prediction-btn"
                  onPress={handleSave}
                  disabled={isSaving || (!isChanged && prediction != null)}
                  style={{
                    backgroundColor:
                      isSaving || (!isChanged && prediction != null)
                        ? colors.surfaceBorder
                        : colors.primary,
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: "center",
                    marginTop: 20,
                  }}
                >
                  <Text
                    style={{
                      color:
                        isSaving || (!isChanged && prediction != null)
                          ? colors.textSecondary
                          : colors.background,
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    {isSaving
                      ? "Saving..."
                      : prediction != null
                        ? "Update Prediction"
                        : "Save Prediction"}
                  </Text>
                </TouchableOpacity>

                {/* Save error (editable branch) */}
                {saveError && (
                  <Text
                    style={{
                      color: "#FF4444",
                      fontSize: 13,
                      textAlign: "center",
                      marginTop: 8,
                    }}
                  >
                    {saveError}
                  </Text>
                )}
              </>
            ) : (
              /* Read-only prediction display */
              <View style={{ alignItems: "center", marginTop: 8 }}>
                {prediction ? (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={colors.primary}
                    />
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 16,
                        fontWeight: "600",
                        marginTop: 8,
                      }}
                    >
                      Your prediction: {prediction.home_score_pred} –{" "}
                      {prediction.away_score_pred}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="lock-closed"
                      size={24}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 14,
                        marginTop: 8,
                      }}
                    >
                      No prediction submitted
                    </Text>
                  </>
                )}

                {/* Error banner — auto-clears after 3s (only for RLS transition) */}
                {errorBanner && (
                  <Text
                    style={{
                      color: "#FF4444",
                      fontSize: 13,
                      textAlign: "center",
                      marginTop: 12,
                    }}
                  >
                    {errorBanner}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
```

- [ ] **Step 4.4: Run tests — expect GREEN**

```bash
npm run test:unit -- --testPathPattern="match-detail-screen" --no-coverage 2>&1 | tail -20
```

Expected: PASS — all tests pass (including new countdown and RLS tests)

- [ ] **Step 4.5: Run full unit test suite**

```bash
npm run test:ci 2>&1 | tail -30
```

Expected: PASS — all tests pass, coverage collected

- [ ] **Step 4.6: Commit**

```bash
git add app/match/[id].tsx src/__tests__/navigation/match-detail-screen.test.tsx
git commit -m "feat(predictions): countdown display, time-based lock, and RLS error auto-transition"
```

---

## Task 5: Pre-PR quality checks and TAREAS update

- [ ] **Step 5.1: Run full CI checks**

```bash
npm run format:check && npm run lint && npm run typecheck && npm run test:ci
```

Expected: all pass. If linting or formatting fails:

- Auto-fix format: `npm run format`
- Auto-fix lint: `npm run lint:fix`
- Then re-run checks

- [ ] **Step 5.2: Update TAREAS.md**

In `TAREAS.md`, mark F1-19 as complete (`[x]`) and update the progress summary table:

- Phase 1 Completed: change from `10` to `11`
- Total MVP Completed: change from `22` to `23`
- Overall MVP progress: update to `33.3%` (23/67 × 100 ≈ 33.3%)

Add notes under F1-19:

```
  - Notes: `use-countdown` hook (pure timer, reusable, no drift). True optimistic save — prediction shown before network round-trip, rolled back on failure. `isLockedByServer` flag triggers immediate read-only transition on RLS error. Client-side lock: dual check `status === "scheduled" && !isExpired && !isLockedByServer`. 3s error banner in read-only section auto-clears. `scheduledExpired` mock fixture added (status=scheduled, past kickoff). 14 new unit tests (9 countdown, 8 hook updates, 7 screen updates).
```

- [ ] **Step 5.3: Commit docs update**

```bash
git add TAREAS.md
git commit -m "docs: mark F1-19 complete and update progress summary"
```

---

## Verification Checklist

Before declaring done:

- [ ] `npm run test:ci` passes with no failures
- [ ] `npm run typecheck` passes (no TypeScript errors)
- [ ] `npm run lint` passes (no errors, only existing warnings)
- [ ] `npm run format:check` passes
- [ ] `use-countdown` hook: 9 tests all GREEN
- [ ] `use-match-detail`: all tests GREEN (including new optimistic/rollback tests)
- [ ] `match-detail-screen`: all tests GREEN (including new countdown and RLS tests)
- [ ] TAREAS.md updated with F1-19 marked `[x]`
