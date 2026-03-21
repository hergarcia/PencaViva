# F1-23: Ranking Screen Design Spec

## Overview

The Ranking screen is the third tab in the 5-tab navigation. It displays a sorted leaderboard for the active group, showing each member's position, points, and prediction stats. Top 3 positions get medal styling, and the current user's row is highlighted. If the current user is scrolled out of view, a sticky footer shows their position.

## Architecture

### Data Flow

```
leaderboard_cache table (pre-calculated by DB triggers)
    → leaderboard-service.ts (fetch + join with profiles)
        → useGroupLeaderboard hook (state management)
            → ranking.tsx (screen rendering)
```

### Service Layer: `src/lib/leaderboard-service.ts`

**`fetchGroupLeaderboard(groupId: string): Promise<LeaderboardEntry[]>`**

Query: `leaderboard_cache` table filtered by `group_id`, with `tournament_id IS NULL` for overall ranking (F1-25 will add tournament filtering later). Joins with `profiles` to get `display_name`, `username`, `avatar_url`. Ordered by `position ASC`.

```typescript
export type LeaderboardEntry = {
  id: string;
  group_id: string;
  user_id: string;
  total_points: number;
  position: number;
  matches_played: number;
  exact_scores: number;
  correct_results: number;
  // Joined from profiles
  display_name: string;
  username: string;
  avatar_url: string | null;
};
```

### Hook: `src/hooks/use-group-leaderboard.ts`

Follows the same pattern as `useGroupMatches`:

- Guards on `isInitialized` from auth
- `cancelledRef` for cleanup
- Returns `{ entries, isLoading, error, refetch }`

### Components

**`LeaderboardRow`** (`src/components/ranking/LeaderboardRow.tsx`):

- Position badge: #1/#2/#3 with gold/silver/bronze medal icons, #4+ plain number
- Letter avatar (same pattern as MemberRow)
- Display name + username
- Points (large, right-aligned)
- Stats line: "X matches | Y exact | Z correct"
- Current user row highlighted with primary color border
- `testID="leaderboard-row-{user_id}"`

**`StickyMyPosition`** (`src/components/ranking/StickyMyPosition.tsx`):

- Compact version of LeaderboardRow that sticks to bottom
- Only visible when user's row is scrolled out of viewport
- Uses `onViewableItemsChanged` to track visibility

### Screen: `app/(tabs)/ranking.tsx`

Layout matches `predict.tsx` pattern:

- SafeAreaView with dark background
- Header: "Ranking" title + GroupSelector (if multiple groups)
- FlatList with LeaderboardRow items
- Pull-to-refresh via RefreshControl
- Empty states: no groups, no leaderboard data
- Error state with retry button
- Sticky footer for current user position

## Mock Data Updates

Fix field name mismatch in `mockLeaderboardCache`:

- `points_total` → `total_points` (match DB schema)
- `rank` → `position`
- `predictions_count` → `matches_played`

Add entries for Carol and Dave to have 5 members in leaderboard.
Add `tournament_id: null` to all entries (overall ranking).

## Testing Strategy

- Unit test: LeaderboardRow renders correctly for top 3 and regular positions
- Unit test: LeaderboardRow highlights current user
- Unit test: Ranking screen shows empty state when no groups
- Unit test: Ranking screen renders leaderboard entries
- Service test: fetchGroupLeaderboard returns correct shape
