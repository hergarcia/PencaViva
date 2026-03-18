# F1-18: Prediction Input (Numeric Stepper) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the match detail screen with score prediction steppers, UPSERT submission, animation, and haptic feedback.

**Architecture:** New prediction-service handles fetch + UPSERT via Supabase client. useMatchDetail hook manages state. ScoreStepper component with Reanimated spring animation. SaveConfirmation overlay with scale-in checkmark. expo-haptics for tactile feedback.

**Tech Stack:** expo-haptics (new), react-native-reanimated v4, Supabase client UPSERT, Zustand group-store

---

## File Structure

| Action | Path                                                    | Responsibility                                       |
| ------ | ------------------------------------------------------- | ---------------------------------------------------- |
| Create | `src/lib/prediction-service.ts`                         | fetchMatchDetail + savePrediction (Supabase queries) |
| Create | `src/hooks/use-match-detail.ts`                         | Match detail + prediction state, save action         |
| Create | `src/components/predictions/ScoreStepper.tsx`           | Stepper +/- with animated score, haptic              |
| Create | `src/components/predictions/SaveConfirmation.tsx`       | Checkmark animation overlay on save                  |
| Modify | `app/match/[id].tsx`                                    | Full match detail screen (replace placeholder)       |
| Create | `src/__tests__/lib/prediction-service.test.ts`          | Service unit tests                                   |
| Create | `src/__tests__/hooks/use-match-detail.test.ts`          | Hook unit tests                                      |
| Create | `src/__tests__/components/score-stepper.test.tsx`       | Stepper component tests                              |
| Create | `src/__tests__/navigation/match-detail-screen.test.tsx` | Screen integration tests                             |
| Modify | `src/__mocks__/expo-haptics.ts`                         | Jest mock for expo-haptics                           |

---

### Task 1: Install expo-haptics and create Jest mock

**Files:**

- Modify: `package.json` (install expo-haptics)
- Create: `src/__mocks__/expo-haptics.ts`

- [ ] **Step 1: Install expo-haptics**

```bash
npx expo install expo-haptics
```

- [ ] **Step 2: Create Jest mock for expo-haptics**

```typescript
// src/__mocks__/expo-haptics.ts
export const ImpactFeedbackStyle = {
  Light: "light",
  Medium: "medium",
  Heavy: "heavy",
} as const;

export const NotificationFeedbackType = {
  Success: "success",
  Warning: "warning",
  Error: "error",
} as const;

export const impactAsync = jest.fn();
export const notificationAsync = jest.fn();
export const selectionAsync = jest.fn();
```

- [ ] **Step 3: Register mock in jest.config.js**

Add to `moduleNameMapper`:

```javascript
"^expo-haptics$": "<rootDir>/src/__mocks__/expo-haptics.ts",
```

- [ ] **Step 4: Verify mock works**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/__mocks__/expo-haptics.ts jest.config.js
git commit -m "chore: install expo-haptics and add Jest mock"
```

---

### Task 2: Prediction service — fetchMatchDetail

**Files:**

- Create: `src/lib/prediction-service.ts`
- Create: `src/__tests__/lib/prediction-service.test.ts`

- [ ] **Step 1: Write failing tests for fetchMatchDetail**

```typescript
// src/__tests__/lib/prediction-service.test.ts

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
    predChain.maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: null, error: null });
    chains = [matchChain, predChain];
    chainIndex = 0;
    mockFrom.mockImplementation(() => chains[chainIndex++]);

    await expect(fetchMatchDetail("m1", "g1", "u1")).rejects.toThrow(
      "not found",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --testPathPattern=prediction-service`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement fetchMatchDetail**

```typescript
// src/lib/prediction-service.ts
import { supabase } from "@lib/supabase";
import type { MatchStatus } from "@lib/matches-service";

export interface MatchDetail {
  id: string;
  tournament_id: string;
  tournament_name: string;
  tournament_short_name: string | null;
  home_team_name: string;
  away_team_name: string;
  home_team_logo: string | null;
  away_team_logo: string | null;
  home_score: number | null;
  away_score: number | null;
  status: MatchStatus;
  kickoff_time: string;
  matchday: number | null;
  venue: string | null;
}

export interface ExistingPrediction {
  id: string;
  home_score_pred: number;
  away_score_pred: number;
}

export async function fetchMatchDetail(
  matchId: string,
  groupId: string,
  userId: string,
): Promise<{ match: MatchDetail; prediction: ExistingPrediction | null }> {
  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select(
      `id, tournament_id, home_team_name, away_team_name,
       home_team_logo, away_team_logo, home_score, away_score,
       status, kickoff_time, matchday, venue,
       tournament:tournaments!tournament_id ( name, short_name )`,
    )
    .eq("id", matchId)
    .single();

  if (matchError) throw new Error(matchError.message);

  const { data: predData, error: predError } = await supabase
    .from("predictions")
    .select("id, home_score_pred, away_score_pred")
    .eq("user_id", userId)
    .eq("match_id", matchId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (predError) throw new Error(predError.message);

  const m = matchData as Record<string, unknown>;
  const tournament = m.tournament as {
    name: string;
    short_name: string | null;
  };

  const match: MatchDetail = {
    id: m.id as string,
    tournament_id: m.tournament_id as string,
    tournament_name: tournament.name,
    tournament_short_name: tournament.short_name,
    home_team_name: m.home_team_name as string,
    away_team_name: m.away_team_name as string,
    home_team_logo: m.home_team_logo as string | null,
    away_team_logo: m.away_team_logo as string | null,
    home_score: m.home_score as number | null,
    away_score: m.away_score as number | null,
    status: m.status as MatchStatus,
    kickoff_time: m.kickoff_time as string,
    matchday: m.matchday as number | null,
    venue: m.venue as string | null,
  };

  const prediction: ExistingPrediction | null = predData
    ? {
        id: (predData as Record<string, unknown>).id as string,
        home_score_pred: (predData as Record<string, unknown>)
          .home_score_pred as number,
        away_score_pred: (predData as Record<string, unknown>)
          .away_score_pred as number,
      }
    : null;

  return { match, prediction };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --testPathPattern=prediction-service`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/prediction-service.ts src/__tests__/lib/prediction-service.test.ts
git commit -m "feat(predictions): add fetchMatchDetail service function"
```

---

### Task 3: Prediction service — savePrediction

**Files:**

- Modify: `src/lib/prediction-service.ts`
- Modify: `src/__tests__/lib/prediction-service.test.ts`

- [ ] **Step 1: Write failing tests for savePrediction**

Add to the test file:

```typescript
describe("savePrediction", () => {
  it("calls upsert with correct shape", async () => {
    const chain = createChain();
    chain.single = jest
      .fn()
      .mockResolvedValue({ data: { id: "p1" }, error: null });
    const upsertMock = jest.fn().mockReturnValue(chain);
    // Override mockFrom for this test to return an object with upsert
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
    chain.single = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: "RLS violation" } });
    mockFrom.mockImplementation(() => ({
      upsert: jest.fn().mockReturnValue(chain),
    }));

    await expect(savePrediction("m1", "g1", "u1", 2, 1)).rejects.toThrow(
      "RLS violation",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --testPathPattern=prediction-service`
Expected: FAIL (savePrediction not found)

- [ ] **Step 3: Implement savePrediction**

Add to `src/lib/prediction-service.ts`:

```typescript
export async function savePrediction(
  matchId: string,
  groupId: string,
  userId: string,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  const { error } = await supabase
    .from("predictions")
    .upsert(
      {
        user_id: userId,
        match_id: matchId,
        group_id: groupId,
        home_score_pred: homeScore,
        away_score_pred: awayScore,
      },
      { onConflict: "user_id,match_id,group_id" },
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --testPathPattern=prediction-service`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/prediction-service.ts src/__tests__/lib/prediction-service.test.ts
git commit -m "feat(predictions): add savePrediction UPSERT service function"
```

---

### Task 4: useMatchDetail hook

**Files:**

- Create: `src/hooks/use-match-detail.ts`
- Create: `src/__tests__/hooks/use-match-detail.test.ts`

- [ ] **Step 1: Write failing tests for the hook**

```typescript
// src/__tests__/hooks/use-match-detail.test.ts
import { renderHook, act, waitFor } from "@testing-library/react-native";

const mockFetchMatchDetail = jest.fn();
const mockSavePrediction = jest.fn();
jest.mock("@lib/prediction-service", () => ({
  fetchMatchDetail: (...args: unknown[]) => mockFetchMatchDetail(...args),
  savePrediction: (...args: unknown[]) => mockSavePrediction(...args),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { useMatchDetail } = require("@hooks/use-match-detail");
/* eslint-enable @typescript-eslint/no-require-imports */

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isInitialized: true }),
}));

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

  it("save returns true and updates prediction on success", async () => {
    mockFetchMatchDetail.mockResolvedValue({
      match: mockMatch,
      prediction: null,
    });
    mockSavePrediction.mockResolvedValue(undefined);

    const { result } = renderHook(() => useMatchDetail("m1", "g1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success: boolean;
    await act(async () => {
      success = await result.current.save(3, 0);
    });

    expect(success!).toBe(true);
    expect(result.current.prediction).toEqual({
      id: "optimistic",
      home_score_pred: 3,
      away_score_pred: 0,
    });
    expect(result.current.isSaving).toBe(false);
  });

  it("save returns false on error", async () => {
    mockFetchMatchDetail.mockResolvedValue({
      match: mockMatch,
      prediction: null,
    });
    mockSavePrediction.mockRejectedValue(new Error("RLS violation"));

    const { result } = renderHook(() => useMatchDetail("m1", "g1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success: boolean;
    await act(async () => {
      success = await result.current.save(3, 0);
    });

    expect(success!).toBe(false);
    expect(result.current.saveError).toBe("RLS violation");
  });

  it("does not fetch when groupId is null", async () => {
    const { result } = renderHook(() => useMatchDetail("m1", null));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchMatchDetail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --testPathPattern=use-match-detail`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement useMatchDetail**

```typescript
// src/hooks/use-match-detail.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@hooks/use-auth";
import { fetchMatchDetail, savePrediction } from "@lib/prediction-service";
import type { MatchDetail, ExistingPrediction } from "@lib/prediction-service";

type UseMatchDetailResult = {
  match: MatchDetail | null;
  prediction: ExistingPrediction | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  save: (home: number, away: number) => Promise<boolean>;
  isSaving: boolean;
  saveError: string | null;
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
  const cancelledRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!user?.id || !matchId || !groupId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

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

      setIsSaving(true);
      setSaveError(null);

      try {
        await savePrediction(matchId, groupId, user.id, home, away);
        setPrediction({
          id: "optimistic",
          home_score_pred: home,
          away_score_pred: away,
        });
        return true;
      } catch (err: unknown) {
        setSaveError(err instanceof Error ? err.message : "Unknown error");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [matchId, groupId, user?.id],
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
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --testPathPattern=use-match-detail`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-match-detail.ts src/__tests__/hooks/use-match-detail.test.ts
git commit -m "feat(predictions): add useMatchDetail hook with save action"
```

---

### Task 5: ScoreStepper component

**Files:**

- Create: `src/components/predictions/ScoreStepper.tsx`
- Create: `src/__tests__/components/score-stepper.test.tsx`

- [ ] **Step 1: Write failing tests for ScoreStepper**

```typescript
// src/__tests__/components/score-stepper.test.tsx
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ScoreStepper } from "@components/predictions/ScoreStepper";

describe("ScoreStepper", () => {
  const defaultProps = {
    teamName: "Team A",
    teamLogo: null,
    score: 0,
    onIncrement: jest.fn(),
    onDecrement: jest.fn(),
  };

  it("renders team name and score", () => {
    const { getByText } = render(<ScoreStepper {...defaultProps} />);
    expect(getByText("Team A")).toBeTruthy();
    expect(getByText("0")).toBeTruthy();
  });

  it("calls onIncrement when plus is pressed", () => {
    const onIncrement = jest.fn();
    const { getByTestId } = render(
      <ScoreStepper {...defaultProps} onIncrement={onIncrement} />,
    );
    fireEvent.press(getByTestId("increment-btn"));
    expect(onIncrement).toHaveBeenCalledTimes(1);
  });

  it("calls onDecrement when minus is pressed", () => {
    const onDecrement = jest.fn();
    const { getByTestId } = render(
      <ScoreStepper {...defaultProps} score={3} onDecrement={onDecrement} />,
    );
    fireEvent.press(getByTestId("decrement-btn"));
    expect(onDecrement).toHaveBeenCalledTimes(1);
  });

  it("disables minus button at score 0", () => {
    const onDecrement = jest.fn();
    const { getByTestId } = render(
      <ScoreStepper {...defaultProps} score={0} onDecrement={onDecrement} />,
    );
    fireEvent.press(getByTestId("decrement-btn"));
    expect(onDecrement).not.toHaveBeenCalled();
  });

  it("disables plus button at maxScore", () => {
    const onIncrement = jest.fn();
    const { getByTestId } = render(
      <ScoreStepper {...defaultProps} score={20} maxScore={20} onIncrement={onIncrement} />,
    );
    fireEvent.press(getByTestId("increment-btn"));
    expect(onIncrement).not.toHaveBeenCalled();
  });

  it("disables both buttons when disabled prop is true", () => {
    const onIncrement = jest.fn();
    const onDecrement = jest.fn();
    const { getByTestId } = render(
      <ScoreStepper
        {...defaultProps}
        score={5}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
        disabled
      />,
    );
    fireEvent.press(getByTestId("increment-btn"));
    fireEvent.press(getByTestId("decrement-btn"));
    expect(onIncrement).not.toHaveBeenCalled();
    expect(onDecrement).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --testPathPattern=score-stepper`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement ScoreStepper**

```typescript
// src/components/predictions/ScoreStepper.tsx
import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors } from "@lib/constants";

type ScoreStepperProps = {
  teamName: string;
  teamLogo: string | null;
  score: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
  minScore?: number;
  maxScore?: number;
};

function TeamLogoSmall({ uri, name }: { uri: string | null; name: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: 28, height: 28, borderRadius: 14 }}
      />
    );
  }
  const initial = name[0]?.toUpperCase() ?? "?";
  return (
    <View
      style={{
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: colors.surfaceBorder,
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>
        {initial}
      </Text>
    </View>
  );
}

export function ScoreStepper({
  teamName,
  teamLogo,
  score,
  onIncrement,
  onDecrement,
  disabled = false,
  minScore = 0,
  maxScore = 20,
}: ScoreStepperProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(1.2, { damping: 8, stiffness: 300 });
    const timeout = setTimeout(() => {
      scale.value = withSpring(1, { damping: 8, stiffness: 300 });
    }, 100);
    return () => clearTimeout(timeout);
  }, [score, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const canDecrement = !disabled && score > minScore;
  const canIncrement = !disabled && score < maxScore;

  const handleDecrement = () => {
    if (!canDecrement) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDecrement();
  };

  const handleIncrement = () => {
    if (!canIncrement) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onIncrement();
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 4,
      }}
    >
      {/* Team */}
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
        <TeamLogoSmall uri={teamLogo} name={teamName} />
        <Text
          style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "500", flex: 1 }}
          numberOfLines={1}
        >
          {teamName}
        </Text>
      </View>

      {/* Stepper controls */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity
          testID="decrement-btn"
          onPress={handleDecrement}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: canDecrement ? colors.surface : colors.surfaceBorder,
            borderWidth: 1,
            borderColor: canDecrement ? colors.textSecondary : colors.surfaceBorder,
            alignItems: "center", justifyContent: "center",
          }}
          activeOpacity={canDecrement ? 0.7 : 1}
        >
          <Text
            style={{
              color: canDecrement ? colors.textPrimary : colors.textSecondary,
              fontSize: 22, fontWeight: "600", marginTop: -2,
            }}
          >
            −
          </Text>
        </TouchableOpacity>

        <Animated.View style={[{ width: 40, alignItems: "center" }, animatedStyle]}>
          <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: "700" }}>
            {score}
          </Text>
        </Animated.View>

        <TouchableOpacity
          testID="increment-btn"
          onPress={handleIncrement}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: canIncrement ? colors.surface : colors.surfaceBorder,
            borderWidth: 1,
            borderColor: canIncrement ? colors.textSecondary : colors.surfaceBorder,
            alignItems: "center", justifyContent: "center",
          }}
          activeOpacity={canIncrement ? 0.7 : 1}
        >
          <Text
            style={{
              color: canIncrement ? colors.textPrimary : colors.textSecondary,
              fontSize: 22, fontWeight: "600", marginTop: -2,
            }}
          >
            +
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --testPathPattern=score-stepper`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/predictions/ScoreStepper.tsx src/__tests__/components/score-stepper.test.tsx
git commit -m "feat(predictions): add ScoreStepper component with animation and haptic"
```

---

### Task 6: SaveConfirmation component

**Files:**

- Create: `src/components/predictions/SaveConfirmation.tsx`

- [ ] **Step 1: Implement SaveConfirmation**

```typescript
// src/components/predictions/SaveConfirmation.tsx
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";

type SaveConfirmationProps = {
  visible: boolean;
  onDismiss: () => void;
};

export function SaveConfirmation({ visible, onDismiss }: SaveConfirmationProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 10, stiffness: 200 });

      // Auto-dismiss after 1.5s
      const timeout = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withDelay(
          0,
          withTiming(0, { duration: 300 }, (finished) => {
            if (finished) runOnJS(onDismiss)();
          }),
        );
      }, 1500);

      return () => clearTimeout(timeout);
    } else {
      scale.value = 0;
      opacity.value = 0;
    }
  }, [visible, scale, opacity, onDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13, 13, 13, 0.7)",
  },
});
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/predictions/SaveConfirmation.tsx
git commit -m "feat(predictions): add SaveConfirmation overlay with checkmark animation"
```

---

### Task 7: Match detail screen — full implementation

**Files:**

- Modify: `app/match/[id].tsx`
- Create: `src/__tests__/navigation/match-detail-screen.test.tsx`

- [ ] **Step 1: Write failing integration tests for the screen**

```typescript
// src/__tests__/navigation/match-detail-screen.test.tsx
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import MatchDetailScreen from "../../../app/match/[id]";

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
let hookReturn: Record<string, unknown>;

jest.mock("@hooks/use-match-detail", () => ({
  useMatchDetail: () => hookReturn,
}));

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
  kickoff_time: "2026-03-20T18:00:00Z",
  matchday: 12,
  venue: "Emirates Stadium",
};

describe("MatchDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hookReturn = {
      match: mockMatch,
      prediction: null,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      save: mockSave,
      isSaving: false,
      saveError: null,
    };
  });

  it("shows loading state", () => {
    hookReturn = { ...hookReturn, isLoading: true, match: null };
    const { getByTestId } = render(<MatchDetailScreen />);
    expect(getByTestId("loading-indicator")).toBeTruthy();
  });

  it("shows error state with retry", () => {
    hookReturn = { ...hookReturn, error: "Network error", match: null };
    const { getByText, getByTestId } = render(<MatchDetailScreen />);
    expect(getByText("Network error")).toBeTruthy();
    fireEvent.press(getByTestId("retry-button"));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("renders match info and steppers for scheduled match", () => {
    const { getByText } = render(<MatchDetailScreen />);
    expect(getByText("Arsenal")).toBeTruthy();
    expect(getByText("Chelsea")).toBeTruthy();
    expect(getByText("Premier League")).toBeTruthy();
    expect(getByText("Your Prediction")).toBeTruthy();
  });

  it("pre-fills steppers with existing prediction", () => {
    hookReturn = {
      ...hookReturn,
      prediction: { id: "p1", home_score_pred: 2, away_score_pred: 1 },
    };
    const { getAllByText } = render(<MatchDetailScreen />);
    expect(getAllByText("2").length).toBeGreaterThan(0);
    expect(getAllByText("1").length).toBeGreaterThan(0);
  });

  it("shows read-only for finished match with prediction", () => {
    hookReturn = {
      ...hookReturn,
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
    fireEvent.press(getByText("Save Prediction"));
    expect(mockSave).toHaveBeenCalledWith(0, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --testPathPattern=match-detail-screen`
Expected: FAIL

- [ ] **Step 3: Implement match detail screen**

Replace `app/match/[id].tsx` with the full implementation:

```typescript
// app/match/[id].tsx
import React, { useState, useCallback } from "react";
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
  } = useMatchDetail(id, activeGroupId);

  const [homeScore, setHomeScore] = useState<number | null>(null);
  const [awayScore, setAwayScore] = useState<number | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Derive displayed scores (stepper state or prediction fallback)
  const displayHome = homeScore ?? prediction?.home_score_pred ?? 0;
  const displayAway = awayScore ?? prediction?.away_score_pred ?? 0;

  const isEditable =
    match?.status === "scheduled" && !!activeGroupId;
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
      // Reset local state since prediction is now saved
      setHomeScore(null);
      setAwayScore(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [save, displayHome, displayAway]);

  // ── Loading ──
  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator
            testID="loading-indicator"
            size="large"
            color={colors.primary}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──
  if (error || !match) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header onBack={() => router.back()} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Ionicons name="alert-circle-outline" size={48} color={colors.accent} />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
              marginTop: 12,
              textAlign: "center",
            }}
          >
            {error ?? "Match not found"}
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
      </SafeAreaView>
    );
  }

  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const showScores = isLive || isFinished;
  const kickoffFormatted = format(new Date(match.kickoff_time), "EEE, MMM d · h:mm a");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        onBack={() => router.back()}
        title={match.tournament_short_name ?? "Match Detail"}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        {/* Tournament */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {match.tournament_name}
          </Text>
          {isLive && (
            <View
              style={{
                backgroundColor: "#FF4444",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                marginLeft: 8,
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>
                LIVE
              </Text>
            </View>
          )}
        </View>

        {/* Matchday */}
        {match.matchday != null && (
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            Matchday {match.matchday}
          </Text>
        )}

        {/* Teams + Scores */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            marginTop: 16,
            alignItems: "center",
          }}
        >
          <TeamRow
            name={match.home_team_name}
            logo={match.home_team_logo}
            score={showScores ? match.home_score : null}
          />
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              fontWeight: "600",
              marginVertical: 8,
            }}
          >
            {showScores ? "" : "vs"}
          </Text>
          <TeamRow
            name={match.away_team_name}
            logo={match.away_team_logo}
            score={showScores ? match.away_score : null}
          />
        </View>

        {/* Time + Venue */}
        <View style={{ marginTop: 12, alignItems: "center" }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {kickoffFormatted}
          </Text>
          {match.venue && (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              {match.venue}
            </Text>
          )}
        </View>

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
                    marginBottom: 8,
                  }}
                >
                  Your Prediction
                </Text>

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

                {/* Save error */}
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
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <SaveConfirmation
        visible={showConfirmation}
        onDismiss={() => setShowConfirmation(false)}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function Header({
  onBack,
  title = "Match Detail",
}: {
  onBack: () => void;
  title?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <TouchableOpacity
        testID="back-button"
        onPress={onBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 18,
          fontWeight: "600",
          marginLeft: 12,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function TeamRow({
  name,
  logo,
  score,
}: {
  name: string;
  logo: string | null;
  score: number | null;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
      {logo ? (
        <Image
          source={{ uri: logo }}
          style={{ width: 32, height: 32, borderRadius: 16 }}
        />
      ) : (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.surfaceBorder,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "600" }}>
            {name[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
      )}
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: "600",
          marginLeft: 12,
          flex: 1,
        }}
        numberOfLines={1}
      >
        {name}
      </Text>
      {score != null && (
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>
          {score}
        </Text>
      )}
    </View>
  );
}
```

Note: `Image` is already imported at the top. The `TeamRow` code above already uses `Image` correctly for the `logo` case.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --testPathPattern=match-detail-screen`
Expected: PASS (6 tests)

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/match/\\[id\\].tsx src/__tests__/navigation/match-detail-screen.test.tsx
git commit -m "feat(predictions): match detail screen with score steppers and save"
```

---

### Task 8: Run full test suite and quality checks

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm run test:ci`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run format check**

Run: `npm run format:check`
Expected: No issues (run `npm run format` if needed)

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

---

### Task 9: Update documentation

**Files:**

- Modify: `TAREAS.md` — Mark F1-18 as `[~]` (in progress)
- Modify: `CLAUDE.md` — Update project structure (new files)

- [ ] **Step 1: Update TAREAS.md**

Change F1-18 from `[ ]` to `[~]` with implementation notes.

- [ ] **Step 2: Update CLAUDE.md project structure**

Add new files to the project structure section:

- `src/lib/prediction-service.ts`
- `src/hooks/use-match-detail.ts`
- `src/components/predictions/ScoreStepper.tsx`
- `src/components/predictions/SaveConfirmation.tsx`

- [ ] **Step 3: Commit**

```bash
git add TAREAS.md CLAUDE.md
git commit -m "docs: update task tracking and project structure for F1-18"
```

---

### Task 10: Final verification and PR

- [ ] **Step 1: Run all pre-commit checks**

```bash
npm run format:check && npm run lint && npm run typecheck && npm run test:ci
```

Expected: All pass

- [ ] **Step 2: Mark F1-18 as complete in TAREAS.md**

Change from `[~]` to `[x]`

- [ ] **Step 3: Push and create PR**

```bash
git push -u origin feature/F1-18-prediction-input-stepper
gh pr create --base develop --title "feat(predictions): score prediction stepper with haptic feedback (F1-18)" --body "..."
```

- [ ] **Step 4: Wait for CI green, then merge**

```bash
gh pr merge --squash --admin
```
