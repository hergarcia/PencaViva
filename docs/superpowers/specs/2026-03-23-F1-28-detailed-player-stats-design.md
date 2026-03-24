# F1-28: Detailed Player Stats Screen

## Overview

A detail screen showing a player's prediction history, accuracy stats, and streaks within a specific group. Accessible by tapping any row on the leaderboard ranking screen.

## Navigation & Route

- **Entry point**: Tap a `LeaderboardRow` on the ranking screen
- **Route**: `app/player-stats/[userId].tsx` (root level, no tab bar — follows existing navigation pattern)
- **Params**: `userId` (dynamic segment). Profile data (`displayName`, `username`, `avatarUrl`, `position`, `totalPoints`, `exactScores`, `correctResults`, `matchesPlayed`) and `groupId` passed as query params from the `LeaderboardRow` tap — avoids extra queries
- **Back**: Standard back arrow returns to ranking screen

## Screen States

- **Loading**: Centered `ActivityIndicator` (consistent with ranking screen)
- **Error**: Alert icon + error message + "Try Again" retry button (consistent with ranking/groups screens)
- **Empty**: Trophy icon + "No predictions scored yet" message (when user has 0 finished predictions in this group)
- **Populated**: Full layout below

## Screen Layout

### 1. Player Header

- Large circular avatar (same deterministic color logic as `LeaderboardRow`)
- Display name (bold) + @username (muted)
- Position badge: medal emoji for top 3, "#N" for others
- Total points displayed prominently

### 2. Stats Summary Grid (2x2)

Uses precomputed values from `leaderboard_cache` (passed via route params) — avoids duplicating server-side scoring logic and handles custom scoring configs correctly.

| Stat             | Source                                                       |
| ---------------- | ------------------------------------------------------------ |
| Matches Played   | `matchesPlayed` from route params (leaderboard_cache value)  |
| Exact Scores     | `exactScores` from route params (leaderboard_cache value)    |
| Correct Results  | `correctResults` from route params (leaderboard_cache value) |
| Avg Points/Match | `totalPoints / matchesPlayed`, rounded to 1 decimal          |

Note: The `correct_goal_diff` bonus (1 pt) is folded into the "Correct Results" count since `leaderboard_cache` counts it that way. This is intentional — the distinction between 3 pts and 4 pts is a bonus detail, not a separate category.

### 3. Streaks Section

- **Current streak**: Number of consecutive correct predictions (points > 0), ordered by `kickoff_time DESC` from most recent match backward. Shows "N correct in a row" (green) or "N wrong in a row" (muted)
- **Best streak**: Longest run of consecutive correct predictions (points > 0) across all finished matches. Shows "Best: N correct in a row"
- Streaks are computed client-side from the prediction history array

### 4. Prediction History (scrollable list with pull-to-refresh)

- `SectionList` grouped by date (using `kickoff_time`, formatted with `format()` from `date-fns` as "MMM d, yyyy" e.g., "Mar 20, 2026", converted to local timezone via `TZDate` from `@date-fns/tz`)
- Each row displays:
  - Tournament short name (if available)
  - Match: "Home Team vs Away Team"
  - Player's prediction: e.g., "2 - 1"
  - Actual result: e.g., "2 - 1"
  - Points earned (right-aligned)
- Color coding:
  - Green background tint for exact score matches
  - Primary color accent for correct result (including goal diff bonus)
  - Default/muted for wrong predictions (0 pts)
- Only finished matches (where `points IS NOT NULL`) are shown
- Ordered by `kickoff_time DESC` (most recent first)
- Pull-to-refresh via `RefreshControl` (consistent with other screens)

## Data Layer

### RLS Considerations

Predictions are readable by group members after kickoff (existing RLS policy from migration 00003). Since this screen only shows finished matches (`points IS NOT NULL`), all predictions are post-kickoff and thus readable by any group member. No additional RLS changes needed.

### Service Function

Add `fetchPlayerGroupStats(userId: string, groupId: string)` to `src/lib/prediction-service.ts`:

```
Query: predictions
  .select('id, home_score_pred, away_score_pred, points, match:matches!match_id(id, home_team_name, away_team_name, home_score, away_score, kickoff_time, status, matchday, tournament:tournaments(name, short_name))')
  .eq('user_id', userId)
  .eq('group_id', groupId)
  .not('points', 'is', null)
```

Note: Uses explicit FK hint `matches!match_id` instead of `matches!inner` to avoid mock query builder's `inferFk` bug (which produces `matche_id` for the `matches` table). Ordering is done client-side in the hook since PostgREST `.order()` does not support ordering by joined table columns at the top level.

Returns: `PlayerPredictionRecord[]` — each record contains the prediction + joined match data.

### Types

```typescript
interface PlayerPredictionRecord {
  id: string;
  homeScorePred: number;
  awayScorePred: number;
  points: number;
  match: {
    id: string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    kickoffTime: string;
    status: string;
    matchday: number | null;
    tournamentName: string;
    tournamentShortName: string | null;
  };
}
```

### Hook

`usePlayerStats(userId: string, groupId: string)` in `src/hooks/use-player-stats.ts`:

- Calls `fetchPlayerGroupStats(userId, groupId)`
- Sorts results client-side by `match.kickoffTime DESC`
- Computes streaks from sorted data (see logic below)
- Returns `{ predictions, streaks, isLoading, error, refetch }`
- Note: Summary stats (matchesPlayed, exactScores, correctResults, totalPoints) come from route params, NOT recomputed here

### Streak Computation Logic

```
Sort predictions by kickoff_time ASC (chronological)
bestStreak = 0
tempStreak = 0

For each prediction (chronological):
  if points > 0:
    tempStreak++
    bestStreak = max(bestStreak, tempStreak)
  else:
    tempStreak = 0

For current streak (from most recent backward):
  if most recent has points > 0:
    count backward while points > 0 -> currentStreak = { count, type: 'correct' }
  else:
    count backward while points == 0 -> currentStreak = { count, type: 'wrong' }
```

## Mock Support

- Add additional mock predictions for Alice, Bob, Carol, Dave in `fixtures.ts` to cover finished matches with varied points (0, 3, 4, 5) for meaningful streaks
- Use explicit FK hint `matches!match_id(...)` in the query to work with the mock builder's join resolution
- Ensure `MockQueryBuilder` handles the nested join pattern: `matches!match_id(... tournament:tournaments(...))`

## Components

### New Components

- **`PlayerStatsHeader`** (`src/components/ranking/PlayerStatsHeader.tsx`) — Avatar, name, position, total points
- **`StatsGrid`** (`src/components/ranking/StatsGrid.tsx`) — 2x2 summary grid
- **`StreakDisplay`** (`src/components/ranking/StreakDisplay.tsx`) — Current + best streak
- **`PredictionHistoryRow`** (`src/components/ranking/PredictionHistoryRow.tsx`) — Individual prediction row with color coding

### Modified Components

- **`LeaderboardRow`** — Wrap in `Pressable`, navigate to `player-stats/[userId]` on tap, passing all needed data as query params: `{ groupId, displayName, username, avatarUrl, position, totalPoints, exactScores, correctResults, matchesPlayed }`

## Scope Boundaries

**In scope**: Player stats screen, service function, hook, mock data, navigation from leaderboard
**Out of scope**: Stats comparison between players, sharing stats, tournament-scoped stats filtering
