# F2-07 + F2-08: Pull to Refresh & Skeleton Loading States

## Overview

Two complementary UX polish tasks that improve perceived performance and interactivity across all list screens.

- **F2-07**: Add pull-to-refresh to all list screens, fix hardcoded `refreshing={false}` prop
- **F2-08**: Replace `ActivityIndicator` loading states with animated skeleton placeholders

## Current State

### Screens with lists

| Screen                    | Component   | Hook                      | Has RefreshControl | Has Skeleton |
| ------------------------- | ----------- | ------------------------- | ------------------ | ------------ |
| predict.tsx               | SectionList | useGroupMatches           | Yes (broken)       | No           |
| ranking.tsx               | FlatList    | useGroupLeaderboard       | Yes (broken)       | No           |
| groups/index.tsx          | FlatList    | inline useState/useEffect | No                 | No           |
| groups/[id].tsx           | FlatList    | useGroupDetail            | No                 | No           |
| player-stats/[userId].tsx | SectionList | usePlayerStats            | No (broken)        | No           |

"Broken" = `refreshing={false}` hardcoded, spinner never shows during refresh.

### Current loading pattern

All screens use a centered `ActivityIndicator` with `size="large"` and `color={colors.primary}` for initial load. No distinction between initial load and refresh.

## Design

### State Machine (per screen)

```
Initial load:  isLoading=true, isRefreshing=false  →  Skeleton
Pull refresh:  isLoading=false, isRefreshing=true   →  Content + RefreshControl spinner
Error:         error !== null                        →  Error + retry
Empty:         data.length === 0                     →  EmptyState
Content:       data.length > 0                       →  List with RefreshControl
```

### F2-07: Pull to Refresh

**Hook changes:** Each hook that exposes `refetch()` gains an `isRefreshing: boolean` return value. The refetch function sets `isRefreshing = true` before fetching and clears it when done. `isLoading` remains true only for initial load.

**New hook:** `useUserGroups` extracted from `groups/index.tsx` inline logic. Returns `{ groups, isLoading, isRefreshing, error, refetch }`.

**Screen changes:** All 5 list screens get `<RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />`.

### F2-08: Skeleton Loading

**Animation:** `useSkeletonAnimation()` hook returns a Reanimated `SharedValue<number>` pulsing between 0.3 and 0.7 opacity using `withRepeat(withTiming(..., { duration: 1000 }), -1, true)`.

**Skeleton components** (one per list item shape):

- `SkeletonMatchCard` — Two team rows (circle 32px + bar 60% width), center date/score area
- `SkeletonLeaderboardRow` — Rank circle 28px + avatar circle 40px + name bar 50% + points bar 20%
- `SkeletonGroupCard` — Avatar circle 48px + name bar 60% + description bar 80% + member count bar 30%
- `SkeletonMemberRow` — Avatar circle 40px + name bar 50% + role badge bar 15%
- `SkeletonPredictionHistoryRow` — Team bars 40% + score boxes 24px square

**Placeholder shape styling:**

- Background: `colors.surface` (#1A1A2E)
- Border radius: 8 for bars, 999 for circles
- Height: matched to actual component text/element sizes

**Screen integration:** Replace `if (isLoading)` ActivityIndicator blocks with skeleton views showing 4-6 placeholder items. Only shown on initial load (`isLoading && !isRefreshing`).

**File structure:**

```
src/components/skeletons/
├── useSkeletonAnimation.ts
├── SkeletonMatchCard.tsx
├── SkeletonLeaderboardRow.tsx
├── SkeletonGroupCard.tsx
├── SkeletonMemberRow.tsx
└── SkeletonPredictionHistoryRow.tsx
```

## Testing

- Unit tests for `useSkeletonAnimation` (returns animated shared value)
- Render tests for each skeleton component (renders without crash, correct testIDs)
- Hook tests for `isRefreshing` state in updated hooks
- Screen tests verify skeleton shown during initial load, content after load
- Screen tests verify RefreshControl present on all list screens
