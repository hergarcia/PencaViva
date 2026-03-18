# F1-17: Predictions Screen (Match List) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Predict tab with a group-scoped match list showing upcoming matches with prediction status indicators, grouped by date.

**Architecture:** Zustand group-store holds active group ID. Service layer fetches matches for the group's tournaments + user's predictions in two parallel queries, merges client-side. SectionList groups matches by date. MatchCard components show team info and prediction status badges.

**Tech Stack:** React Native (Expo SDK 55), Zustand, Supabase client, date-fns + @date-fns/tz, NativeWind, Jest + RNTL

---

## File Structure

```
src/
├── stores/
│   └── group-store.ts                          # NEW: activeGroupId Zustand store
├── lib/
│   └── matches-service.ts                      # NEW: fetchGroupMatches(), types, merge logic
├── hooks/
│   ├── use-active-group.ts                     # NEW: active group + group list management
│   └── use-group-matches.ts                    # NEW: match fetching + date sectioning
├── components/
│   └── predictions/
│       ├── MatchCard.tsx                        # NEW: individual match card
│       ├── GroupSelector.tsx                    # NEW: group picker modal
│       ├── DateSectionHeader.tsx                # NEW: date label section header
│       └── PredictionBadge.tsx                  # NEW: status indicator widget
app/
└── (tabs)/
    └── predict.tsx                              # MODIFY: replace placeholder with full screen

src/__tests__/
├── stores/
│   └── group-store.test.ts                     # NEW
├── lib/
│   └── matches-service.test.ts                 # NEW
├── hooks/
│   └── use-group-matches.test.ts               # NEW
└── components/
    └── predictions/
        ├── MatchCard.test.tsx                   # NEW
        ├── PredictionBadge.test.tsx             # NEW
        └── GroupSelector.test.tsx               # NEW
```

---

### Task 1: Install date-fns dependencies

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install date-fns and @date-fns/tz**

```bash
npm install date-fns @date-fns/tz
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('date-fns'); require('@date-fns/tz'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add date-fns and @date-fns/tz for match date grouping"
```

---

### Task 2: Group Store (Zustand)

**Files:**

- Create: `src/stores/group-store.ts`
- Create: `src/__tests__/stores/group-store.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/stores/group-store.test.ts
import { useGroupStore } from "@stores/group-store";

beforeEach(() => {
  useGroupStore.setState({
    activeGroupId: null,
  });
});

describe("useGroupStore", () => {
  it("has null activeGroupId by default", () => {
    expect(useGroupStore.getState().activeGroupId).toBeNull();
  });

  it("sets activeGroupId", () => {
    useGroupStore.getState().setActiveGroupId("group-123");
    expect(useGroupStore.getState().activeGroupId).toBe("group-123");
  });

  it("clears activeGroupId with null", () => {
    useGroupStore.getState().setActiveGroupId("group-123");
    useGroupStore.getState().setActiveGroupId(null);
    expect(useGroupStore.getState().activeGroupId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/stores/group-store.test.ts --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/stores/group-store.ts
import { create } from "zustand";

export type GroupState = {
  activeGroupId: string | null;
};

export type GroupActions = {
  setActiveGroupId: (id: string | null) => void;
};

export type GroupStore = GroupState & GroupActions;

export const useGroupStore = create<GroupStore>()((set) => ({
  activeGroupId: null,

  setActiveGroupId: (id) => {
    set({ activeGroupId: id });
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/__tests__/stores/group-store.test.ts --no-coverage
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/group-store.ts src/__tests__/stores/group-store.test.ts
git commit -m "feat(stores): add group-store with activeGroupId"
```

---

### Task 3: Matches Service — types and fetchGroupMatches

**Files:**

- Create: `src/lib/matches-service.ts`
- Create: `src/__tests__/lib/matches-service.test.ts`

- [ ] **Step 1: Write failing tests**

The test file uses the same chainable mock pattern as `groups-service.test.ts`:

```typescript
// src/__tests__/lib/matches-service.test.ts

// ── Mock Supabase with chainable builder ────────────────────────────
// Each from() call gets its own fresh chain so multi-query functions
// don't share mockReturnValueOnce state across chains.
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

// We create per-query chains so each from() call is independent
let chains: ReturnType<typeof createChain>[] = [];
let chainIndex = 0;

const mockFrom = jest.fn(() => {
  const chain = chains[chainIndex] ?? createChain();
  chainIndex++;
  return chain;
});

jest.mock("@lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { fetchGroupMatches } = require("@lib/matches-service");
/* eslint-enable @typescript-eslint/no-require-imports */

import type { MatchWithPrediction } from "@lib/matches-service";

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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/lib/matches-service.test.ts --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/matches-service.ts
import { supabase } from "@lib/supabase";

// ── Types ───────────────────────────────────────────────────────────

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

export type PredictionStatus = "open" | "predicted" | "closed";

export interface MatchWithPrediction {
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
  prediction_status: PredictionStatus;
  predicted_home: number | null;
  predicted_away: number | null;
}

// ── Match window constants ──────────────────────────────────────────

const PAST_DAYS = 3;
const FUTURE_DAYS = 14;

function getMatchWindow(now: string): { from: string; to: string } {
  const d = new Date(now);
  const from = new Date(d);
  from.setDate(from.getDate() - PAST_DAYS);
  const to = new Date(d);
  to.setDate(to.getDate() + FUTURE_DAYS);
  return { from: from.toISOString(), to: to.toISOString() };
}

// ── Prediction status logic ─────────────────────────────────────────

function derivePredictionStatus(
  hasPrediction: boolean,
  kickoffTime: string,
  matchStatus: MatchStatus,
  now: string,
): PredictionStatus {
  if (hasPrediction) return "predicted";
  const isPast =
    new Date(kickoffTime) <= new Date(now) ||
    matchStatus === "live" ||
    matchStatus === "finished";
  return isPast ? "closed" : "open";
}

// ── Main query ──────────────────────────────────────────────────────

/**
 * Fetch matches for a group's tournaments with the user's prediction status.
 * Uses three sequential queries: tournaments → matches → predictions, then
 * merges client-side.
 *
 * @param now - ISO timestamp for "current time" (injectable for testing)
 */
export async function fetchGroupMatches(
  groupId: string,
  userId: string,
  now: string = new Date().toISOString(),
): Promise<MatchWithPrediction[]> {
  // 1. Get tournament IDs for this group
  const { data: gtData, error: gtError } = await supabase
    .from("group_tournaments")
    .select("tournament_id")
    .eq("group_id", groupId);

  if (gtError) throw new Error(gtError.message);

  const tournamentIds = (gtData ?? []).map(
    (r: { tournament_id: string }) => r.tournament_id,
  );
  if (tournamentIds.length === 0) return [];

  // 2. Fetch matches within the time window
  const { from, to } = getMatchWindow(now);

  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select(
      `
      id, tournament_id, home_team_name, away_team_name,
      home_team_logo, away_team_logo, home_score, away_score,
      status, kickoff_time, matchday, venue,
      tournament:tournaments!tournament_id ( name, short_name )
    `,
    )
    .in("tournament_id", tournamentIds)
    .gte("kickoff_time", from)
    .lte("kickoff_time", to)
    .not("status", "eq", "cancelled")
    .order("kickoff_time", { ascending: true });

  if (matchError) throw new Error(matchError.message);

  const matches = matchData ?? [];
  if (matches.length === 0) return [];

  // 3. Fetch user's predictions for this group
  const { data: predData, error: predError } = await supabase
    .from("predictions")
    .select("match_id, home_score_pred, away_score_pred")
    .eq("user_id", userId)
    .eq("group_id", groupId);

  if (predError) throw new Error(predError.message);

  // Build lookup map: match_id → prediction
  const predMap = new Map<string, { home: number; away: number }>();
  for (const p of predData ?? []) {
    predMap.set((p as { match_id: string }).match_id, {
      home: (p as { home_score_pred: number }).home_score_pred,
      away: (p as { away_score_pred: number }).away_score_pred,
    });
  }

  // 4. Merge matches with predictions
  return matches.map((m: Record<string, unknown>) => {
    const tournament = m.tournament as {
      name: string;
      short_name: string | null;
    };
    const pred = predMap.get(m.id as string);
    const status = m.status as MatchStatus;

    return {
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
      status,
      kickoff_time: m.kickoff_time as string,
      matchday: m.matchday as number | null,
      venue: m.venue as string | null,
      prediction_status: derivePredictionStatus(
        !!pred,
        m.kickoff_time as string,
        status,
        now,
      ),
      predicted_home: pred?.home ?? null,
      predicted_away: pred?.away ?? null,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/__tests__/lib/matches-service.test.ts --no-coverage
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/matches-service.ts src/__tests__/lib/matches-service.test.ts
git commit -m "feat(lib): add matches-service with fetchGroupMatches and prediction merge"
```

---

### Task 4: useActiveGroup Hook

**Files:**

- Create: `src/hooks/use-active-group.ts`
- Create: `src/__tests__/hooks/use-active-group.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/hooks/use-active-group.test.ts
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useGroupStore } from "@stores/group-store";

// Mock groups-service
const mockFetchUserGroups = jest.fn();
jest.mock("@lib/groups-service", () => ({
  fetchUserGroups: (...args: unknown[]) => mockFetchUserGroups(...args),
}));

// Mock use-auth
const mockUseAuth = jest.fn();
jest.mock("@hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Import after mocks
import { useActiveGroup } from "@hooks/use-active-group";

beforeEach(() => {
  jest.clearAllMocks();
  useGroupStore.setState({ activeGroupId: null });
  mockUseAuth.mockReturnValue({ user: { id: "user-1" }, isInitialized: true });
});

describe("useActiveGroup", () => {
  it("fetches groups and sets first as active when activeGroupId is null", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([
      { id: "g1", name: "Group A" },
      { id: "g2", name: "Group B" },
    ]);

    const { result } = renderHook(() => useActiveGroup());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activeGroupId).toBe("g1");
    expect(result.current.groups).toHaveLength(2);
  });

  it("does not refetch when activeGroupId is already set", async () => {
    useGroupStore.setState({ activeGroupId: "g2" });
    mockFetchUserGroups.mockResolvedValueOnce([
      { id: "g1", name: "Group A" },
      { id: "g2", name: "Group B" },
    ]);

    const { result } = renderHook(() => useActiveGroup());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Still fetches groups for the selector, but doesn't override active
    expect(result.current.activeGroupId).toBe("g2");
  });

  it("returns empty groups when user has none", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useActiveGroup());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.groups).toEqual([]);
    expect(result.current.activeGroupId).toBeNull();
  });

  it("allows changing active group", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([
      { id: "g1", name: "Group A" },
      { id: "g2", name: "Group B" },
    ]);

    const { result } = renderHook(() => useActiveGroup());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setActiveGroupId("g2");
    });

    expect(result.current.activeGroupId).toBe("g2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/hooks/use-active-group.test.ts --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/hooks/use-active-group.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@hooks/use-auth";
import { useGroupStore } from "@stores/group-store";
import { fetchUserGroups } from "@lib/groups-service";
import type { UserGroup } from "@lib/groups-service";

type UseActiveGroupResult = {
  activeGroupId: string | null;
  activeGroup: UserGroup | null;
  groups: UserGroup[];
  setActiveGroupId: (id: string) => void;
  isLoading: boolean;
};

export function useActiveGroup(): UseActiveGroupResult {
  const { user, isInitialized } = useAuth();
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const setStoreGroupId = useGroupStore((s) => s.setActiveGroupId);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Use a ref to read activeGroupId inside loadGroups without adding it as
  // a dependency (avoids double-fetch when auto-selecting the first group).
  const activeGroupIdRef = useRef(activeGroupId);
  activeGroupIdRef.current = activeGroupId;

  const loadGroups = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await fetchUserGroups(user.id);
      setGroups(data);

      // Auto-select first group if none active
      if (!activeGroupIdRef.current && data.length > 0) {
        setStoreGroupId(data[0].id);
      }
    } catch {
      // Silently fail — groups list will be empty
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, setStoreGroupId]);

  useEffect(() => {
    if (!isInitialized) return;
    loadGroups();
  }, [isInitialized, loadGroups]);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  return {
    activeGroupId,
    activeGroup,
    groups,
    setActiveGroupId: setStoreGroupId,
    isLoading,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/__tests__/hooks/use-active-group.test.ts --no-coverage
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-active-group.ts src/__tests__/hooks/use-active-group.test.ts
git commit -m "feat(hooks): add useActiveGroup hook with auto-select first group"
```

---

### Task 5: useGroupMatches Hook (date sectioning)

**Files:**

- Create: `src/hooks/use-group-matches.ts`
- Create: `src/__tests__/hooks/use-group-matches.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/hooks/use-group-matches.test.ts
import { renderHook, waitFor } from "@testing-library/react-native";

// Mock matches-service
const mockFetchGroupMatches = jest.fn();
jest.mock("@lib/matches-service", () => ({
  fetchGroupMatches: (...args: unknown[]) => mockFetchGroupMatches(...args),
}));

// Mock use-auth
jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, isInitialized: true }),
}));

import { useGroupMatches } from "@hooks/use-group-matches";
import type { MatchWithPrediction } from "@lib/matches-service";

beforeEach(() => {
  jest.clearAllMocks();
});

const makeMatch = (
  overrides: Partial<MatchWithPrediction>,
): MatchWithPrediction => ({
  id: "m1",
  tournament_id: "t1",
  tournament_name: "PDU",
  tournament_short_name: "PDU",
  home_team_name: "Nacional",
  away_team_name: "Peñarol",
  home_team_logo: null,
  away_team_logo: null,
  home_score: null,
  away_score: null,
  status: "scheduled",
  kickoff_time: "2026-03-18T20:00:00Z",
  matchday: null,
  venue: null,
  prediction_status: "open",
  predicted_home: null,
  predicted_away: null,
  ...overrides,
});

describe("useGroupMatches", () => {
  it("returns loading true initially", () => {
    mockFetchGroupMatches.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useGroupMatches("group-1"));
    expect(result.current.isLoading).toBe(true);
  });

  it("returns empty sections when no matches", async () => {
    mockFetchGroupMatches.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useGroupMatches("group-1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sections).toEqual([]);
    expect(result.current.matches).toEqual([]);
  });

  it("groups matches by date into sections", async () => {
    mockFetchGroupMatches.mockResolvedValueOnce([
      makeMatch({ id: "m1", kickoff_time: "2026-03-18T20:00:00Z" }),
      makeMatch({ id: "m2", kickoff_time: "2026-03-18T22:00:00Z" }),
      makeMatch({ id: "m3", kickoff_time: "2026-03-19T18:00:00Z" }),
    ]);

    const { result } = renderHook(() => useGroupMatches("group-1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sections).toHaveLength(2);
    expect(result.current.sections[0].data).toHaveLength(2);
    expect(result.current.sections[1].data).toHaveLength(1);
  });

  it("does not fetch when groupId is null", async () => {
    const { result } = renderHook(() => useGroupMatches(null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchGroupMatches).not.toHaveBeenCalled();
    expect(result.current.sections).toEqual([]);
  });

  it("returns error on fetch failure", async () => {
    mockFetchGroupMatches.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useGroupMatches("group-1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/hooks/use-group-matches.test.ts --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/hooks/use-group-matches.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@hooks/use-auth";
import { fetchGroupMatches } from "@lib/matches-service";
import type { MatchWithPrediction } from "@lib/matches-service";
import { format, isToday, isTomorrow } from "date-fns";

// ── Types ───────────────────────────────────────────────────────────

export interface DateSection {
  title: string;
  dateKey: string;
  data: MatchWithPrediction[];
}

type UseGroupMatchesResult = {
  matches: MatchWithPrediction[];
  sections: DateSection[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

// ── Date sectioning ─────────────────────────────────────────────────

function formatSectionTitle(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

function groupMatchesByDate(matches: MatchWithPrediction[]): DateSection[] {
  const sectionMap = new Map<string, DateSection>();

  for (const match of matches) {
    const date = new Date(match.kickoff_time);
    const dateKey = format(date, "yyyy-MM-dd");

    if (!sectionMap.has(dateKey)) {
      sectionMap.set(dateKey, {
        title: formatSectionTitle(date),
        dateKey,
        data: [],
      });
    }
    sectionMap.get(dateKey)!.data.push(match);
  }

  return Array.from(sectionMap.values());
}

// ── Hook ────────────────────────────────────────────────────────────

export function useGroupMatches(groupId: string | null): UseGroupMatchesResult {
  const { user, isInitialized } = useAuth();
  const [matches, setMatches] = useState<MatchWithPrediction[]>([]);
  const [sections, setSections] = useState<DateSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const loadMatches = useCallback(async () => {
    if (!user?.id || !groupId) {
      setIsLoading(false);
      setMatches([]);
      setSections([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchGroupMatches(groupId, user.id);
      if (!cancelledRef.current) {
        setMatches(data);
        setSections(groupMatchesByDate(data));
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
  }, [groupId, user?.id]);

  useEffect(() => {
    cancelledRef.current = false;

    if (!isInitialized) return;

    loadMatches();

    return () => {
      cancelledRef.current = true;
    };
  }, [isInitialized, loadMatches]);

  const refetch = useCallback(async () => {
    cancelledRef.current = false;
    await loadMatches();
  }, [loadMatches]);

  return { matches, sections, isLoading, error, refetch };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/__tests__/hooks/use-group-matches.test.ts --no-coverage
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-group-matches.ts src/__tests__/hooks/use-group-matches.test.ts
git commit -m "feat(hooks): add useGroupMatches hook with date sectioning"
```

---

### Task 6: PredictionBadge Component

**Files:**

- Create: `src/components/predictions/PredictionBadge.tsx`
- Create: `src/__tests__/components/predictions/PredictionBadge.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/components/predictions/PredictionBadge.test.tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { PredictionBadge } from "@components/predictions/PredictionBadge";

describe("PredictionBadge", () => {
  it("renders 'Predicted' for predicted status", () => {
    const { getByText } = render(<PredictionBadge status="predicted" />);
    expect(getByText("Predicted")).toBeTruthy();
  });

  it("renders 'Open' for open status", () => {
    const { getByText } = render(<PredictionBadge status="open" />);
    expect(getByText("Open")).toBeTruthy();
  });

  it("renders 'Closed' for closed status", () => {
    const { getByText } = render(<PredictionBadge status="closed" />);
    expect(getByText("Closed")).toBeTruthy();
  });

  it("shows predicted score when provided", () => {
    const { getByText } = render(
      <PredictionBadge status="predicted" predictedHome={2} predictedAway={1} />,
    );
    expect(getByText("Your pick: 2-1")).toBeTruthy();
  });

  it("does not show score for open status", () => {
    const { queryByText } = render(<PredictionBadge status="open" />);
    expect(queryByText(/Your pick/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/components/predictions/PredictionBadge.test.tsx --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/components/predictions/PredictionBadge.tsx
import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";
import type { PredictionStatus } from "@lib/matches-service";

type PredictionBadgeProps = {
  status: PredictionStatus;
  predictedHome?: number | null;
  predictedAway?: number | null;
};

const STATUS_CONFIG = {
  predicted: {
    icon: "checkmark-circle" as const,
    color: colors.primary,
    label: "Predicted",
  },
  open: {
    icon: "ellipse-outline" as const,
    color: colors.textSecondary,
    label: "Open",
  },
  closed: {
    icon: "lock-closed" as const,
    color: colors.textSecondary,
    label: "Closed",
  },
} as const;

export function PredictionBadge({
  status,
  predictedHome,
  predictedAway,
}: PredictionBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <View style={{ alignItems: "flex-end" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name={config.icon} size={14} color={config.color} />
        <Text style={{ color: config.color, fontSize: 12, fontWeight: "500" }}>
          {config.label}
        </Text>
      </View>
      {status === "predicted" &&
        predictedHome != null &&
        predictedAway != null && (
          <Text
            style={{
              color: colors.primary,
              fontSize: 11,
              marginTop: 2,
              fontWeight: "600",
            }}
          >
            Your pick: {predictedHome}-{predictedAway}
          </Text>
        )}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/__tests__/components/predictions/PredictionBadge.test.tsx --no-coverage
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/predictions/PredictionBadge.tsx src/__tests__/components/predictions/PredictionBadge.test.tsx
git commit -m "feat(components): add PredictionBadge status indicator"
```

---

### Task 7: MatchCard Component

**Files:**

- Create: `src/components/predictions/MatchCard.tsx`
- Create: `src/__tests__/components/predictions/MatchCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/components/predictions/MatchCard.test.tsx
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { MatchCard } from "@components/predictions/MatchCard";
import type { MatchWithPrediction } from "@lib/matches-service";

const baseMatch: MatchWithPrediction = {
  id: "m1",
  tournament_id: "t1",
  tournament_name: "Primera División",
  tournament_short_name: "PDU",
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
  prediction_status: "open",
  predicted_home: null,
  predicted_away: null,
};

describe("MatchCard", () => {
  it("renders team names", () => {
    const { getByText } = render(
      <MatchCard match={baseMatch} onPress={jest.fn()} />,
    );
    expect(getByText("Nacional")).toBeTruthy();
    expect(getByText("Peñarol")).toBeTruthy();
  });

  it("renders tournament name", () => {
    const { getByText } = render(
      <MatchCard match={baseMatch} onPress={jest.fn()} />,
    );
    expect(getByText("Primera División")).toBeTruthy();
  });

  it("renders venue", () => {
    const { getByText } = render(
      <MatchCard match={baseMatch} onPress={jest.fn()} />,
    );
    expect(getByText(/Estadio Gran Parque Central/)).toBeTruthy();
  });

  it("shows dashes for scheduled match scores", () => {
    const { getAllByText } = render(
      <MatchCard match={baseMatch} onPress={jest.fn()} />,
    );
    expect(getAllByText("-")).toHaveLength(2);
  });

  it("shows actual scores for finished match", () => {
    const finishedMatch = {
      ...baseMatch,
      status: "finished" as const,
      home_score: 2,
      away_score: 1,
    };
    const { getByText } = render(
      <MatchCard match={finishedMatch} onPress={jest.fn()} />,
    );
    expect(getByText("2")).toBeTruthy();
    expect(getByText("1")).toBeTruthy();
  });

  it("calls onPress with match id when tapped", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <MatchCard match={baseMatch} onPress={onPress} />,
    );
    fireEvent.press(getByTestId("match-card-m1"));
    expect(onPress).toHaveBeenCalledWith("m1");
  });

  it("renders LIVE badge for live matches", () => {
    const liveMatch = { ...baseMatch, status: "live" as const };
    const { getByText } = render(
      <MatchCard match={liveMatch} onPress={jest.fn()} />,
    );
    expect(getByText("LIVE")).toBeTruthy();
  });

  it("renders letter fallback when team logo is null", () => {
    const { getByText } = render(
      <MatchCard match={baseMatch} onPress={jest.fn()} />,
    );
    // First letter of team names as fallback
    expect(getByText("N")).toBeTruthy(); // Nacional
    expect(getByText("P")).toBeTruthy(); // Peñarol
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/components/predictions/MatchCard.test.tsx --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/components/predictions/MatchCard.tsx
import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { colors } from "@lib/constants";
import { PredictionBadge } from "./PredictionBadge";
import { format } from "date-fns";
import type { MatchWithPrediction } from "@lib/matches-service";

type MatchCardProps = {
  match: MatchWithPrediction;
  onPress: (matchId: string) => void;
};

function TeamLogo({ uri, teamName }: { uri: string | null; teamName: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: 24, height: 24, borderRadius: 12 }}
      />
    );
  }

  const initial = teamName[0]?.toUpperCase() ?? "?";
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.surfaceBorder,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "600" }}>
        {initial}
      </Text>
    </View>
  );
}

function ScoreDisplay({ score }: { score: number | null }) {
  return (
    <Text
      style={{
        color: colors.textPrimary,
        fontSize: 18,
        fontWeight: "700",
        width: 24,
        textAlign: "center",
      }}
    >
      {score != null ? String(score) : "-"}
    </Text>
  );
}

export function MatchCard({ match, onPress }: MatchCardProps) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const showScores = isLive || isFinished;
  const kickoffTime = format(new Date(match.kickoff_time), "h:mm a");

  return (
    <TouchableOpacity
      testID={`match-card-${match.id}`}
      onPress={() => onPress(match.id)}
      activeOpacity={0.7}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: isLive ? colors.accent + "40" : colors.surfaceBorder,
        opacity: isFinished ? 0.7 : 1,
      }}
    >
      {/* Tournament + Live badge */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <Text
          style={{ color: colors.textSecondary, fontSize: 11, flex: 1 }}
          numberOfLines={1}
        >
          {match.tournament_name}
        </Text>
        {isLive && (
          <View
            style={{
              backgroundColor: "#FF4444",
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>
              LIVE
            </Text>
          </View>
        )}
      </View>

      {/* Teams + Scores */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Teams column */}
        <View style={{ flex: 1, gap: 8 }}>
          {/* Home team */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TeamLogo uri={match.home_team_logo} teamName={match.home_team_name} />
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 14,
                fontWeight: "500",
                flex: 1,
              }}
              numberOfLines={1}
            >
              {match.home_team_name}
            </Text>
            <ScoreDisplay score={showScores ? match.home_score : null} />
          </View>

          {/* Away team */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TeamLogo uri={match.away_team_logo} teamName={match.away_team_name} />
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 14,
                fontWeight: "500",
                flex: 1,
              }}
              numberOfLines={1}
            >
              {match.away_team_name}
            </Text>
            <ScoreDisplay score={showScores ? match.away_score : null} />
          </View>
        </View>
      </View>

      {/* Bottom: Time/Venue + Prediction badge */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          marginTop: 10,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {kickoffTime}
            {match.venue ? ` · ${match.venue}` : ""}
          </Text>
        </View>
        <PredictionBadge
          status={match.prediction_status}
          predictedHome={match.predicted_home}
          predictedAway={match.predicted_away}
        />
      </View>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/__tests__/components/predictions/MatchCard.test.tsx --no-coverage
```

Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/predictions/MatchCard.tsx src/__tests__/components/predictions/MatchCard.test.tsx
git commit -m "feat(components): add MatchCard with team logos, scores, and prediction badge"
```

---

### Task 8: DateSectionHeader and GroupSelector Components

**Files:**

- Create: `src/components/predictions/DateSectionHeader.tsx`
- Create: `src/components/predictions/GroupSelector.tsx`
- Create: `src/__tests__/components/predictions/GroupSelector.test.tsx`

- [ ] **Step 1: Write DateSectionHeader (simple, no separate test needed)**

```typescript
// src/components/predictions/DateSectionHeader.tsx
import React from "react";
import { View, Text } from "react-native";
import { colors } from "@lib/constants";

type DateSectionHeaderProps = {
  title: string;
};

export function DateSectionHeader({ title }: DateSectionHeaderProps) {
  return (
    <View style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: "700",
        }}
      >
        {title}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Write GroupSelector failing tests**

```typescript
// src/__tests__/components/predictions/GroupSelector.test.tsx
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { GroupSelector } from "@components/predictions/GroupSelector";
import type { UserGroup } from "@lib/groups-service";

const groups: UserGroup[] = [
  {
    id: "g1",
    name: "Weekend Warriors",
    description: null,
    avatar_url: null,
    invite_code: "abc12345",
    created_by: "u1",
    member_count: 5,
    scoring_system: { exact_score: 5, correct_result: 3, correct_goal_diff: 1, wrong: 0 },
    role: "admin",
  },
  {
    id: "g2",
    name: "Office League",
    description: null,
    avatar_url: null,
    invite_code: "def67890",
    created_by: "u2",
    member_count: 8,
    scoring_system: { exact_score: 5, correct_result: 3, correct_goal_diff: 1, wrong: 0 },
    role: "member",
  },
];

describe("GroupSelector", () => {
  it("renders active group name", () => {
    const { getByText } = render(
      <GroupSelector
        groups={groups}
        activeGroup={groups[0]}
        onSelect={jest.fn()}
      />,
    );
    expect(getByText("Weekend Warriors")).toBeTruthy();
  });

  it("opens modal and shows all groups when pressed", () => {
    const { getByTestId, getByText } = render(
      <GroupSelector
        groups={groups}
        activeGroup={groups[0]}
        onSelect={jest.fn()}
      />,
    );

    fireEvent.press(getByTestId("group-selector-button"));
    expect(getByText("Office League")).toBeTruthy();
  });

  it("calls onSelect when a group is tapped", () => {
    const onSelect = jest.fn();
    const { getByTestId, getByText } = render(
      <GroupSelector
        groups={groups}
        activeGroup={groups[0]}
        onSelect={onSelect}
      />,
    );

    fireEvent.press(getByTestId("group-selector-button"));
    fireEvent.press(getByText("Office League"));
    expect(onSelect).toHaveBeenCalledWith("g2");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx jest src/__tests__/components/predictions/GroupSelector.test.tsx --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 4: Write GroupSelector implementation**

```typescript
// src/components/predictions/GroupSelector.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";
import type { UserGroup } from "@lib/groups-service";

type GroupSelectorProps = {
  groups: UserGroup[];
  activeGroup: UserGroup | null;
  onSelect: (groupId: string) => void;
};

export function GroupSelector({
  groups,
  activeGroup,
  onSelect,
}: GroupSelectorProps) {
  const [visible, setVisible] = useState(false);

  const handleSelect = (groupId: string) => {
    onSelect(groupId);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        testID="group-selector-button"
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
          gap: 4,
        }}
      >
        <Text
          style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500" }}
          numberOfLines={1}
        >
          {activeGroup?.name ?? "Select group"}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: 24,
          }}
          onPress={() => setVisible(false)}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              maxHeight: 400,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: "700",
                marginBottom: 12,
              }}
            >
              Select Group
            </Text>
            <FlatList
              data={groups}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelect(item.id)}
                  activeOpacity={0.7}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    borderRadius: 8,
                    backgroundColor:
                      item.id === activeGroup?.id
                        ? colors.primary + "15"
                        : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color:
                        item.id === activeGroup?.id
                          ? colors.primary
                          : colors.textPrimary,
                      fontSize: 15,
                      fontWeight: item.id === activeGroup?.id ? "600" : "400",
                    }}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest src/__tests__/components/predictions/GroupSelector.test.tsx --no-coverage
```

Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/predictions/DateSectionHeader.tsx src/components/predictions/GroupSelector.tsx src/__tests__/components/predictions/GroupSelector.test.tsx
git commit -m "feat(components): add DateSectionHeader and GroupSelector for predictions"
```

---

### Task 9: PredictScreen — assemble the full screen

**Files:**

- Modify: `app/(tabs)/predict.tsx`

- [ ] **Step 1: Replace the placeholder with the full implementation**

```typescript
// app/(tabs)/predict.tsx
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";
import { useActiveGroup } from "@hooks/use-active-group";
import { useGroupMatches } from "@hooks/use-group-matches";
import { MatchCard } from "@components/predictions/MatchCard";
import { DateSectionHeader } from "@components/predictions/DateSectionHeader";
import { GroupSelector } from "@components/predictions/GroupSelector";
import type { DateSection } from "@hooks/use-group-matches";
import type { MatchWithPrediction } from "@lib/matches-service";

export default function PredictScreen() {
  const router = useRouter();
  const {
    activeGroupId,
    activeGroup,
    groups,
    setActiveGroupId,
    isLoading: groupsLoading,
  } = useActiveGroup();
  const {
    sections,
    isLoading: matchesLoading,
    error,
    refetch,
  } = useGroupMatches(activeGroupId);

  const isLoading = groupsLoading || matchesLoading;

  const handleMatchPress = useCallback(
    (matchId: string) => {
      router.push(`/match/${matchId}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: MatchWithPrediction }) => (
      <MatchCard match={item} onPress={handleMatchPress} />
    ),
    [handleMatchPress],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: DateSection }) => (
      <DateSectionHeader title={section.title} />
    ),
    [],
  );

  // ── Empty states ─────────────────────────────────────────────────

  if (!groupsLoading && groups.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Text
            style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}
          >
            Predict
          </Text>
        </View>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}
        >
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 18,
              fontWeight: "600",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            No groups yet
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            Join or create a group to start predicting
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
            <TouchableOpacity
              testID="join-group-cta"
              onPress={() => router.push("/groups/join")}
              style={{
                backgroundColor: colors.surface,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                Join
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="create-group-cta"
              onPress={() => router.push("/groups/create")}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 20,
              }}
            >
              <Text style={{ color: colors.background, fontWeight: "600" }}>
                Create
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main screen ──────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 8,
        }}
      >
        <Text
          style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}
        >
          Predict
        </Text>
        {groups.length > 1 && (
          <GroupSelector
            groups={groups}
            activeGroup={activeGroup}
            onSelect={setActiveGroupId}
          />
        )}
        {groups.length === 1 && activeGroup && (
          <Text
            style={{ color: colors.textSecondary, fontSize: 14 }}
            numberOfLines={1}
          >
            {activeGroup.name}
          </Text>
        )}
      </View>

      {/* Loading */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        /* Error state */
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
      ) : sections.length === 0 ? (
        /* Empty matches state */
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Ionicons name="football-outline" size={48} color={colors.textSecondary} />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 18,
              fontWeight: "600",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            No upcoming matches
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            Check back later for new fixtures
          </Text>
        </View>
      ) : (
        /* Match list */
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Update tab-screens.test.tsx — remove PredictScreen from placeholder list**

The existing test expects the old placeholder text "Predecir". Remove PredictScreen from the placeholder screens array (same pattern as when GroupsScreen was removed):

In `src/__tests__/navigation/tab-screens.test.tsx`:

- Remove the `PredictScreen` import
- Remove `{ Component: PredictScreen, title: "Predecir" }` from the `screens` array
- Add a comment: `// PredictScreen removed — has its own test suite in predict-screen.test.tsx`

- [ ] **Step 3: Run full test suite to verify nothing is broken**

```bash
npx jest --no-coverage
```

Expected: All existing tests pass.

- [ ] **Step 4: Run linting and type checking**

```bash
npm run lint && npm run typecheck
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/predict.tsx src/__tests__/navigation/tab-screens.test.tsx
git commit -m "feat(predict): assemble full predictions screen with match list"
```

---

### Task 10: Predict screen integration test

**Files:**

- Create: `src/__tests__/navigation/predict-screen.test.tsx`

- [ ] **Step 1: Write screen integration test**

```typescript
// src/__tests__/navigation/predict-screen.test.tsx
import React from "react";
import { render, waitFor } from "@testing-library/react-native";

// Mock use-auth
jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, isInitialized: true }),
}));

// Mock use-active-group
const mockUseActiveGroup = jest.fn();
jest.mock("@hooks/use-active-group", () => ({
  useActiveGroup: () => mockUseActiveGroup(),
}));

// Mock use-group-matches
const mockUseGroupMatches = jest.fn();
jest.mock("@hooks/use-group-matches", () => ({
  useGroupMatches: () => mockUseGroupMatches(),
}));

import PredictScreen from "../../../app/(tabs)/predict";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PredictScreen", () => {
  it("shows empty state when user has no groups", async () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: null,
      activeGroup: null,
      groups: [],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupMatches.mockReturnValue({
      sections: [],
      matches: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<PredictScreen />);
    expect(getByText("No groups yet")).toBeTruthy();
    expect(getByText("Join or create a group to start predicting")).toBeTruthy();
  });

  it("shows loading state while fetching", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: { id: "g1", name: "Test Group" },
      groups: [{ id: "g1", name: "Test Group" }],
      setActiveGroupId: jest.fn(),
      isLoading: true,
    });
    mockUseGroupMatches.mockReturnValue({
      sections: [],
      matches: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { queryByText } = render(<PredictScreen />);
    // While loading, neither empty state nor match list should show
    expect(queryByText("No upcoming matches")).toBeNull();
    expect(queryByText("No groups yet")).toBeNull();
  });

  it("shows error state with retry button", () => {
    const refetch = jest.fn();
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: { id: "g1", name: "Test Group" },
      groups: [{ id: "g1", name: "Test Group" }],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupMatches.mockReturnValue({
      sections: [],
      matches: [],
      isLoading: false,
      error: "Network error",
      refetch,
    });

    const { getByText, getByTestId } = render(<PredictScreen />);
    expect(getByText("Something went wrong")).toBeTruthy();
    expect(getByText("Network error")).toBeTruthy();
  });

  it("shows empty matches state when no fixtures", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: { id: "g1", name: "Test Group" },
      groups: [{ id: "g1", name: "Test Group" }],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupMatches.mockReturnValue({
      sections: [],
      matches: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<PredictScreen />);
    expect(getByText("No upcoming matches")).toBeTruthy();
  });

  it("renders match sections when data is available", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: { id: "g1", name: "Test Group" },
      groups: [{ id: "g1", name: "Test Group" }],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupMatches.mockReturnValue({
      sections: [
        {
          title: "Today",
          dateKey: "2026-03-18",
          data: [
            {
              id: "m1",
              tournament_name: "PDU",
              home_team_name: "Nacional",
              away_team_name: "Peñarol",
              home_team_logo: null,
              away_team_logo: null,
              home_score: null,
              away_score: null,
              status: "scheduled",
              kickoff_time: "2026-03-18T20:00:00Z",
              matchday: 5,
              venue: "Gran Parque Central",
              prediction_status: "open",
              predicted_home: null,
              predicted_away: null,
            },
          ],
        },
      ],
      matches: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<PredictScreen />);
    expect(getByText("Today")).toBeTruthy();
    expect(getByText("Nacional")).toBeTruthy();
    expect(getByText("Peñarol")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npx jest src/__tests__/navigation/predict-screen.test.tsx --no-coverage
```

Expected: 5 tests PASS

- [ ] **Step 3: Run the full test suite**

```bash
npm run test:ci
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/navigation/predict-screen.test.tsx
git commit -m "test(predict): add integration tests for PredictScreen states"
```

---

### Task 11: Formatting, linting, docs update

**Files:**

- Modify: `TAREAS.md` (mark F1-17 as in-progress)
- Modify: `CLAUDE.md` (update project structure if needed)
- Run: formatting + linting + typecheck

- [ ] **Step 1: Format all new/modified files**

```bash
npx prettier --write "src/stores/group-store.ts" "src/lib/matches-service.ts" "src/hooks/use-active-group.ts" "src/hooks/use-group-matches.ts" "src/components/predictions/*.tsx" "app/(tabs)/predict.tsx" "src/__tests__/**/*.test.{ts,tsx}"
```

- [ ] **Step 2: Run full quality checks**

```bash
npm run format:check && npm run lint && npm run typecheck && npm run test:ci
```

Expected: All pass

- [ ] **Step 3: Update TAREAS.md — mark F1-17 as complete**

Change `- [ ] **F1-17**` to `- [x] **F1-17**`

- [ ] **Step 4: Update CLAUDE.md project structure**

Add the new files to the project structure section:

- `src/stores/group-store.ts` — Active group Zustand store
- `src/lib/matches-service.ts` — Match fetching with prediction merge
- `src/hooks/use-active-group.ts`, `use-group-matches.ts` — New hooks
- `src/components/predictions/` — MatchCard, GroupSelector, DateSectionHeader, PredictionBadge

- [ ] **Step 5: Commit docs**

```bash
git add TAREAS.md CLAUDE.md
git commit -m "docs: update TAREAS.md and CLAUDE.md for F1-17 completion"
```

---

### Task 12: Create PR

- [ ] **Step 1: Push branch and create PR**

```bash
git push -u origin feature/F1-17-predictions-match-list
gh pr create --base develop --title "feat(predict): predictions screen with match list (F1-17)" --body "$(cat <<'EOF'
## Summary
- Replace placeholder Predict tab with group-scoped match list
- Add group store (Zustand) for active group selection
- Add matches-service for fetching matches with prediction status merge
- Add MatchCard, PredictionBadge, GroupSelector, DateSectionHeader components
- SectionList grouped by date (Today/Tomorrow/future dates)
- Empty states: no groups, no matches, error with retry
- Pull-to-refresh support

## Test plan
- [ ] Unit tests: group-store, matches-service, hooks, components
- [ ] Integration test: PredictScreen renders all states correctly
- [ ] All existing tests continue to pass
- [ ] `npm run lint`, `npm run typecheck`, `npm run test:ci` all green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Wait for CI to pass**

- [ ] **Step 3: Merge PR**

```bash
gh pr merge --squash --delete-branch
```

- [ ] **Step 4: Checkout develop and pull**

```bash
git checkout develop && git pull
```
