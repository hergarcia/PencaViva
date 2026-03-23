# F1-28: Detailed Player Stats Screen

## Overview

A detail screen showing a player's prediction history, accuracy stats, and streaks within a specific group. Accessible by tapping any row on the leaderboard ranking screen.

## Navigation & Route

- **Entry point**: Tap a `LeaderboardRow` on the ranking screen
- **Route**: `app/player-stats/[userId].tsx` (root level, no tab bar — follows existing navigation pattern)
- **Params**: `userId` (from route), `groupId` (from route)
- **Back**: Standard back arrow returns to ranking screen

## Screen Layout

### 1. Player Header

- Large circular avatar (same deterministic color logic as `LeaderboardRow`)
- Display name (bold) + @username (muted)
- Position badge: medal emoji for top 3 (🥇🥈🥉), "#N" for others
- Total points displayed prominently

### 2. Stats Summary Grid (2×2)

| Stat             | Source                                                                      |
| ---------------- | --------------------------------------------------------------------------- |
| Matches Played   | `predictions` count where `points IS NOT NULL`                              |
| Exact Scores     | Count where `points = scoring.exact` (5 by default)                         |
| Correct Results  | Count where `points >= scoring.correct_result` (3 by default) AND not exact |
| Avg Points/Match | `total_points / matches_played`, rounded to 1 decimal                       |

### 3. Streaks Section

- **Current streak**: Number of consecutive correct predictions (points > 0), ordered by `kickoff_time DESC` from most recent match backward. Shows "🔥 N correct in a row" (green) or "N wrong in a row" (muted)
- **Best streak**: Longest run of consecutive correct predictions (points > 0) across all finished matches. Shows "Best: N correct in a row"
- Streaks are computed client-side from the prediction history array

### 4. Prediction History (scrollable list)

- Grouped by date (using `kickoff_time`, formatted as section headers like "Mar 20, 2026")
- Each row displays:
  - Tournament short name (if available)
  - Match: "Home Team vs Away Team"
  - Player's prediction: e.g., "2 - 1"
  - Actual result: e.g., "2 - 1"
  - Points earned (right-aligned)
- Color coding:
  - Green background tint for exact score matches
  - Primary color accent for correct result
  - Default/muted for wrong predictions
- Only finished matches (where `points IS NOT NULL`) are shown
- Ordered by `kickoff_time DESC` (most recent first)
- Empty state: "No predictions scored yet" message

## Data Layer

### Service Function

Add `fetchPlayerGroupStats(userId: string, groupId: string)` to `src/lib/prediction-service.ts`:

```
Query: predictions
  .select('id, home_score_pred, away_score_pred, points, match:matches!inner(id, home_team_name, away_team_name, home_score, away_score, kickoff_time, status, matchday, tournament:tournaments(name, short_name))')
  .eq('user_id', userId)
  .eq('group_id', groupId)
  .not('points', 'is', null)
  .order('matches.kickoff_time', { ascending: false })
```

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
    matchday: number | null;
    tournamentName: string;
    tournamentShortName: string | null;
  };
}

interface PlayerStatsComputed {
  matchesPlayed: number;
  exactScores: number;
  correctResults: number;
  avgPointsPerMatch: number;
  totalPoints: number;
  currentStreak: { count: number; type: "correct" | "wrong" };
  bestStreak: number;
}
```

### Hook

`usePlayerStats(userId: string, groupId: string)` in `src/hooks/use-player-stats.ts`:

- Calls `fetchPlayerGroupStats(userId, groupId)`
- Computes `PlayerStatsComputed` from the raw records:
  - `matchesPlayed`: array length
  - `exactScores`: count where `points >= 5` (exact score threshold)
  - `correctResults`: count where `points >= 3 AND points < 5`
  - `avgPointsPerMatch`: total / count, rounded to 1 decimal
  - Streaks: iterate chronologically, track consecutive runs of `points > 0`
- Also fetches player profile info (display_name, username, avatar_url) from the leaderboard entry or a direct profile query
- Returns `{ predictions, stats, profile, isLoading, error, refetch }`

### Streak Computation Logic

```
Sort predictions by kickoff_time ASC (chronological)
currentStreak = { count: 0, type: 'correct' }
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
    count backward while points > 0 → currentStreak = { count, type: 'correct' }
  else:
    count backward while points == 0 → currentStreak = { count, type: 'wrong' }
```

## Mock Support

- Add additional mock predictions for Alice, Bob, Carol, Dave in `fixtures.ts` to cover finished matches with varied points (0, 3, 4, 5) for meaningful streaks
- Ensure `MockQueryBuilder` handles the nested join pattern: `matches!inner(... tournament:tournaments(...))`
- Add mock RPC or query support if needed

## Components

### New Components

- **`PlayerStatsHeader`** (`src/components/ranking/PlayerStatsHeader.tsx`) — Avatar, name, position, total points
- **`StatsGrid`** (`src/components/ranking/StatsGrid.tsx`) — 2×2 summary grid
- **`StreakDisplay`** (`src/components/ranking/StreakDisplay.tsx`) — Current + best streak
- **`PredictionHistoryRow`** (`src/components/ranking/PredictionHistoryRow.tsx`) — Individual prediction row with color coding

### Modified Components

- **`LeaderboardRow`** — Wrap in `Pressable`, navigate to `player-stats/[userId]` on tap with `{ userId, groupId }` params

## Scope Boundaries

**In scope**: Player stats screen, service function, hook, mock data, navigation from leaderboard
**Out of scope**: Stats comparison between players, sharing stats, tournament-scoped stats filtering
