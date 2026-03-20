# F1-20: View Others' Predictions (Post-Kickoff)

## Overview

Add a "Group Predictions" section to the match detail screen that reveals all group members' predictions after kickoff. During live matches, show provisional points based on the current score. After the match finishes, show final ranked results with actual points.

## Three States

The section is **hidden** when the match is `scheduled`, `postponed`, or `cancelled` (predictions are private before kickoff).

### Live Match (`status === "live"`)

- **Section title**: "GROUP PREDICTIONS"
- **Sorting**: By potential points (descending), then alphabetically
- **Each row shows**:
  - Avatar (letter fallback) + display name
  - Their prediction (e.g., "2 – 1")
  - Live status label: "Exact!", "Correct result", "Result + diff", or "Wrong"
  - Provisional points: "would be +5", "would be +3", etc.
- **Row styling**:
  - "Exact!" row: green tinted background (`#0D2E27`), subtle green border
  - Current user row: violet border, name in violet
  - "No prediction" row: dimmed at 40% opacity
- **Potential points computed client-side** using the same scoring formula as the DB function `calculate_prediction_points`:
  - Exact score: `scoring_system.exact_score` (default 5)
  - Correct result: `scoring_system.correct_result` (default 3)
  - Correct goal difference bonus: `scoring_system.correct_goal_diff` (default 1)
  - Wrong: 0

### Finished Match (`status === "finished"`)

- **Section title**: "GROUP RANKINGS"
- **Sorting**: By `predictions.points` descending (actual DB values), then alphabetically
- **Each row shows**:
  - Rank number (1, 2, 3, 4...) — colored gold/silver/bronze for top 3
  - Avatar + display name
  - Their prediction + scoring label (e.g., "2 – 1 · Exact!")
  - Final points badge: green pill "+5" for rank #1, plain text "+N" for others
- **Row styling**: Same highlighting rules (green tint for top scorer, violet for current user)
- **Members with no prediction**: Shown at bottom, dimmed, rank displayed as "–"

## Data Model

### New Service Function

```typescript
// src/lib/prediction-service.ts

interface GroupPrediction {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  homeScorePred: number | null; // null = no prediction
  awayScorePred: number | null;
  points: number | null; // null during live, number when finished
}

async function fetchGroupPredictions(
  matchId: string,
  groupId: string,
): Promise<GroupPrediction[]>;
```

**Query approach**: Two separate queries merged client-side (PostgREST doesn't support LEFT JOINs across unrelated tables):

1. **Predictions query**: `predictions` joined with `profiles` via `user_id`, filtered by `match_id` and `group_id`. RLS handles post-kickoff visibility — before kickoff, only the current user's own prediction is returned.
2. **Members query**: `group_members` joined with `profiles` via `user_id`, filtered by `group_id`. Returns all members.
3. **Client merge**: Match predictions to members by `user_id`. Members without a prediction get `null` scores.

This avoids needing a new RPC/migration and keeps the logic transparent.

### Scoring System

The group's `scoring_system` JSONB is obtained via `useGroupDetail(groupId)` hook, which is already used in group screens. The match detail screen will call this hook to access `group.scoringSystem`. The client-side potential points calculation reuses the same logic as the DB `calculate_prediction_points` function:

```typescript
function calculatePotentialPoints(
  homePred: number,
  awayPred: number,
  homeReal: number,
  awayReal: number,
  scoring: {
    exact_score: number;
    correct_result: number;
    correct_goal_diff: number;
  },
): number;
```

This is a pure function — same inputs, same output as the DB function. No network call needed.

### Status Label Derivation

```typescript
type PredictionStatus =
  | "exact"
  | "correct_result_and_diff"
  | "correct_result"
  | "wrong";

function getPredictionStatus(
  homePred: number,
  awayPred: number,
  homeReal: number,
  awayReal: number,
): PredictionStatus;
```

**Precedence** (matches DB function logic — early return for exact):

1. If `homePred === homeReal && awayPred === awayReal` → `"exact"` (no bonus stacking)
2. If correct winner/draw AND correct goal difference → `"correct_result_and_diff"`
3. If correct winner/draw only → `"correct_result"`
4. Otherwise → `"wrong"`

## Component Structure

### GroupPredictions (new component)

`src/components/predictions/GroupPredictions.tsx`

Props:

- `matchId: string`
- `groupId: string`
- `matchStatus: MatchStatus`
- `homeScore: number | null` (current/final score)
- `awayScore: number | null`
- `currentUserId: string` (from `useAuth()` in the match detail screen)
- `scoringSystem: ScoringSystem` (from `useGroupDetail(groupId)` in the match detail screen)

Renders:

- Section header ("GROUP PREDICTIONS" or "GROUP RANKINGS")
- List of `PredictionRow` components
- Loading skeleton while fetching

### PredictionRow (new component)

`src/components/predictions/PredictionRow.tsx`

Props:

- `prediction: GroupPrediction`
- `rank: number | null` (null during live)
- `status: PredictionStatus | null`
- `potentialPoints: number | null`
- `isCurrentUser: boolean`
- `isFinished: boolean`

## Data Flow

1. Match detail screen detects `status === "live" || status === "finished"`
2. Calls `fetchGroupPredictions(matchId, groupId)` via React Query
3. For live matches: client computes `calculatePotentialPoints()` for each prediction using current `homeScore`/`awayScore`
4. For finished matches: uses `predictions.points` directly from DB
5. Sorts and renders the list

## Hook

### useGroupPredictions

`src/hooks/use-group-predictions.ts`

```typescript
function useGroupPredictions(
  matchId: string | undefined,
  groupId: string | undefined,
  matchStatus: MatchStatus | undefined
) => {
  predictions: GroupPrediction[];
  isLoading: boolean;
  error: string | null;
}
```

- **Enabled**: Only when `matchStatus` is `"live"` or `"finished"` (hidden for scheduled/postponed/cancelled)
- **Pattern**: Uses `useState` + `useEffect` (consistent with existing `useMatchDetail` hook — no React Query in this codebase yet)
- **Refetch**: `setInterval` at 30s during live matches; single fetch for finished matches (data won't change)

## Mock System Updates

- Add `fetchGroupPredictions` handler to mock client
- Add fixture data: 4-5 mock predictions per match with varied scores
- Mock returns only the current user's own prediction for scheduled matches (matching RLS behavior), but this is irrelevant since the section is hidden for non-live/finished matches

## Edge Cases

- **User not in a group**: Section hidden (no `activeGroupId`)
- **No predictions in group**: Show empty state: "No one predicted this match yet"
- **Single prediction (only current user)**: Show their row, no ranking
- **Tie in points**: Same rank number, next rank skipped (standard ranking, consistent with DB's `RANK()` function), sorted alphabetically within tie
- **Match score is null during live**: Shouldn't happen (live implies scores exist), but guard against it — hide section if scores are null

## Stitch Mockups

- **Live match**: Screen `a80e4b72` in Stitch project `13390158725206896883` — shows provisional status labels and "would be +N"
- **Finished match**: Screen `de24db9f` in Stitch project `13390158725206896883` — shows ranked list with final points

## Scope Boundaries

**In scope:**

- Group predictions list on match detail screen
- Client-side potential points calculation
- Service function to fetch group predictions
- Mock system support

**Out of scope:**

- Realtime updates via Supabase Realtime (F1-24)
- Animated transitions between states (F1-27)
- Tap on user row to see their prediction history (F1-28)
