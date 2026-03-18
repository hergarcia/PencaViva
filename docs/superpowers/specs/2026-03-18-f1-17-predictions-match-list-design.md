# F1-17: Predictions Screen (Match List) — Design Spec

## Overview

Replace the placeholder Predict tab with a group-scoped match list that shows upcoming, live, and recent matches with prediction status indicators. Users see which matches need predictions and tap through to the match detail screen (F1-18) for score entry.

## Architecture

### Group Context

The predict tab needs to know which group to display matches for. We introduce a **group store** (`src/stores/group-store.ts`) — a small Zustand store holding `activeGroupId`. The predict screen reads this value and fetches matches scoped to that group's tournaments.

- `activeGroupId: string | null` — in-memory only (no AsyncStorage persistence), defaults to the user's first group on initial load
- `setActiveGroupId(id)` — called from a group selector dropdown at the top of the predict screen
- Separate from `auth-store.ts` to keep concerns clean (auth vs. app state)

### Data Flow

```
User opens Predict tab
  → Read activeGroupId from group-store
  → If null, fetch user's groups → set first group as active
  → Fetch matches for active group's tournaments + user's predictions
  → Group matches by date → render SectionList
```

### Service Layer

New file: `src/lib/matches-service.ts`

**`fetchGroupMatches(groupId: string, userId: string): Promise<MatchWithPrediction[]>`**

Two-query approach (simpler than complex joins through PostgREST):

1. Fetch the group's tournament IDs via `group_tournaments`
2. Fetch matches for those tournaments, ordered by `kickoff_time ASC`
3. Fetch user's predictions for this group (all at once, filter client-side)
4. Merge: attach `hasPrediction` boolean and `predictedHome`/`predictedAway` scores to each match

This avoids complex embedded resource queries and keeps the service easy to test.

### Types

```typescript
// src/lib/matches-service.ts

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
  kickoff_time: string; // ISO 8601
  matchday: number | null;
  venue: string | null;
  // Prediction data
  prediction_status: PredictionStatus;
  predicted_home: number | null;
  predicted_away: number | null;
}
```

**`PredictionStatus` logic:**

- `"predicted"` — user has a prediction for this match+group
- `"open"` — no prediction yet AND kickoff is in the future
- `"closed"` — no prediction AND kickoff is in the past (or match is live/finished)

### Hook

New file: `src/hooks/use-group-matches.ts`

```typescript
function useGroupMatches(groupId: string | null): {
  matches: MatchWithPrediction[];
  sections: DateSection[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};
```

Groups matches into `DateSection[]` for the SectionList:

```typescript
interface DateSection {
  title: string; // "Today", "Tomorrow", "Sat, Mar 21"
  dateKey: string; // "2026-03-18" (for keying)
  data: MatchWithPrediction[];
}
```

Date grouping uses the device's local timezone via `@date-fns/tz` (`TZDate`).

### Group Selector Hook

New file: `src/hooks/use-active-group.ts`

Wraps group-store + initial load logic:

```typescript
function useActiveGroup(): {
  activeGroupId: string | null;
  activeGroup: UserGroup | null;
  groups: UserGroup[];
  setActiveGroupId: (id: string) => void;
  isLoading: boolean;
};
```

On mount: if `activeGroupId` is null, fetches user's groups via `fetchUserGroups()` from `groups-service.ts` and sets the first one as active. Note: this duplicates the groups tab's fetch — acceptable for MVP; a shared cache (React Query) would deduplicate in a future task.

## UI Design

### Screen Layout

```
┌─────────────────────────────────────────┐
│  SafeAreaView (background: #0D0D0D)     │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Predict          [Group ▾]      │    │ ← Header row
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─ Section: "Today" ──────────────┐    │
│  │                                 │    │
│  │  ┌─ MatchCard ────────────────┐ │    │
│  │  │ 🏆 Copa Libertadores      │ │    │
│  │  │                            │ │    │
│  │  │ [logo] Nacional  2 - 1     │ │    │
│  │  │ [logo] Peñarol            │ │    │
│  │  │                            │ │    │
│  │  │ 8:00 PM · Estadio Gran    │ │    │
│  │  │                  ● Predicted│ │    │
│  │  └────────────────────────────┘ │    │
│  │                                 │    │
│  │  ┌─ MatchCard ────────────────┐ │    │
│  │  │ 🏆 Primera División       │ │    │
│  │  │                            │ │    │
│  │  │ [logo] Defensor  _ - _    │ │    │
│  │  │ [logo] Danubio            │ │    │
│  │  │                            │ │    │
│  │  │ 5:30 PM · Franzini        │ │    │
│  │  │                  ○ Open    │ │    │
│  │  └────────────────────────────┘ │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─ Section: "Tomorrow" ───────────┐    │
│  │  ...                            │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Match Card Component

New file: `src/components/predictions/MatchCard.tsx`

**Layout:**

- Surface card (`#1A1A2E` background, rounded corners, border `#2A2A3E`)
- Tournament name tag at top (small text, secondary color)
- Two rows: home team (logo + name + score) and away team (logo + name + score)
- Team logos: 24x24 Image with letter fallback (first letter of team name in a circle)
- Scores: shown if match is live or finished; dashes (`-`) if scheduled
- Bottom row: kickoff time (formatted for local timezone) + venue
- Prediction status badge in bottom-right corner:
  - Green dot + "Predicted" — user submitted prediction
  - Empty circle + "Open" — can still predict (shows predicted scores if exists... wait no, predicted means it has scores)
  - Lock icon + "Closed" — past kickoff, no prediction submitted
- If `prediction_status === "predicted"`: small text showing "Your pick: 2-1" below the status badge
- `TouchableOpacity` with `onPress` → navigate to match detail

**Status-specific styling:**

- Live matches: pulsing red dot next to "LIVE" text, border tinted with accent color
- Finished matches: slightly dimmed (opacity 0.7)
- Cancelled/postponed: strikethrough or badge overlay

### Group Selector

A `TouchableOpacity` in the header that opens a bottom sheet or simple dropdown (Modal for MVP). Shows:

- Active group name + chevron down icon
- On press: modal with list of user's groups
- Tap group → `setActiveGroupId(id)` → modal closes → matches refetch

### Empty States

1. **No groups**: Icon + "Join or create a group to start predicting" + CTA buttons (Join / Create)
2. **No tournaments**: Icon + "This group has no tournaments yet" + (if admin) "Add tournaments" CTA
3. **No matches**: Icon + "No upcoming matches" + "Check back later"
4. **Error**: Icon + error message + "Try again" button

### Loading State

`ActivityIndicator` centered, matching the groups screen pattern.

## Data Queries

### Fetch matches for group

```sql
-- Step 1: Get tournament IDs for the group
SELECT tournament_id FROM group_tournaments WHERE group_id = $groupId;

-- Step 2: Fetch matches for those tournaments
SELECT m.*, t.name as tournament_name, t.short_name as tournament_short_name
FROM matches m
JOIN tournaments t ON t.id = m.tournament_id
WHERE m.tournament_id IN ($tournamentIds)
  AND m.status NOT IN ('cancelled')
ORDER BY m.kickoff_time ASC;

-- Step 3: Fetch user's predictions for this group
SELECT match_id, home_score_pred, away_score_pred
FROM predictions
WHERE user_id = $userId AND group_id = $groupId;
```

Client-side merge: for each match, look up `match_id` in the predictions map. If found, set `prediction_status = "predicted"` and map DB columns `home_score_pred` → `predicted_home`, `away_score_pred` → `predicted_away`. If not found, check kickoff time to determine `"open"` vs `"closed"`.

### Match window

Only show matches within a reasonable window:

- Past: last 3 days (to show recent results)
- Future: next 14 days (upcoming matches to predict)

This prevents loading hundreds of historical matches. Implemented as `kickoff_time` filter in the query.

## Component Tree

```
PredictScreen
├── Header (title + GroupSelector)
├── GroupSelector (modal with group list)
├── SectionList
│   ├── SectionHeader (date label)
│   └── MatchCard[] (per match)
├── EmptyState (no groups / no tournaments / no matches)
├── LoadingState (ActivityIndicator)
└── ErrorState (message + retry)
```

## File Structure

```
src/
├── stores/
│   └── group-store.ts              # NEW: activeGroupId Zustand store
├── lib/
│   └── matches-service.ts          # NEW: fetchGroupMatches()
├── hooks/
│   ├── use-group-matches.ts        # NEW: match fetching + date grouping
│   └── use-active-group.ts         # NEW: active group management
├── components/
│   └── predictions/
│       ├── MatchCard.tsx            # NEW: individual match card
│       ├── GroupSelector.tsx        # NEW: group picker dropdown
│       ├── DateSectionHeader.tsx    # NEW: section header for date groups
│       └── PredictionBadge.tsx      # NEW: status indicator (predicted/open/closed)
app/
└── (tabs)/
    └── predict.tsx                  # MODIFIED: replace placeholder
```

## Testing Strategy

- **Unit tests**: `matches-service.ts` (mock Supabase client, verify query construction and merge logic)
- **Unit tests**: `useGroupMatches` hook (mock service, verify date grouping and section generation)
- **Unit tests**: `MatchCard` component (render with different statuses, verify correct indicators)
- **Unit tests**: `group-store.ts` (set/get active group)
- **Unit tests**: Date grouping logic (today/tomorrow/future date labels, timezone handling)

## Scope Boundaries

**In scope (F1-17):**

- Match list display with prediction status
- Group selector + active group store
- Date-grouped SectionList
- Navigation to match detail (tap card → `router.push`)
- Loading/error/empty states
- Basic pull-to-refresh via SectionList's `refreshControl` prop

**Out of scope (future tasks):**

- F1-18: Prediction entry (score input on match detail)
- F1-19: Leaderboard display
- Live score auto-refresh / polling
- Match notifications / reminders
- Search or filter matches

## Dependencies

- `date-fns` — needs to be installed, for `isToday`, `isTomorrow`, `format`
- `@date-fns/tz` — needs to be installed, for timezone-aware date formatting
- No other new npm dependencies needed
