# F2-12: Haptic Feedback on Key Actions — Design Spec

## Overview

Add consistent haptic feedback across the app, extending the patterns already established in ScoreStepper (`impactAsync(Light)`) and match detail save (`notificationAsync(Success/Error)`).

## Existing Haptic Conventions

1. **Discrete controls** (steppers, toggles, selections) → `Haptics.impactAsync(ImpactFeedbackStyle.Light)`
2. **Async action outcomes** (save, submit, create) → `Haptics.notificationAsync(NotificationFeedbackType.Success | Error)`
3. **Tab/filter selection** → `Haptics.selectionAsync()` (lighter than impact, appropriate for frequent switches)

## Changes

### High Priority — Async Action Outcomes

| File                                | Handler                                    | Haptic                             |
| ----------------------------------- | ------------------------------------------ | ---------------------------------- |
| `app/groups/create.tsx`             | `handleCreate` success/error               | `notificationAsync(Success/Error)` |
| `app/groups/join.tsx`               | `handleJoin` success/error                 | `notificationAsync(Success/Error)` |
| `app/groups/manage-tournaments.tsx` | `handleSave` success/error                 | `notificationAsync(Success/Error)` |
| `app/groups/[id].tsx`               | `copyWithFeedback` (copy invite code/link) | `notificationAsync(Success)`       |

### Medium Priority — Selection/Toggle Interactions

| File                                | Handler                  | Haptic               |
| ----------------------------------- | ------------------------ | -------------------- |
| `app/groups/create.tsx`             | `toggleTournament`       | `impactAsync(Light)` |
| `app/groups/create.tsx`             | Scoring preset `onPress` | `impactAsync(Light)` |
| `app/groups/manage-tournaments.tsx` | `toggleTournament`       | `impactAsync(Light)` |
| `app/(tabs)/ranking.tsx`            | Filter tab `onSelect`    | `selectionAsync()`   |
| `app/groups/[id].tsx`               | Members/Info tab switch  | `selectionAsync()`   |

### Out of Scope

- Navigation row taps (MatchCard, LeaderboardRow) — too frequent, would feel heavy-handed
- Pull-to-refresh completion — no native callback, marginal UX benefit
- GroupSelector modal — already a simple picker, haptic would add noise

## Testing

No new test files needed. The jest mock for `expo-haptics` is already configured globally. Tests verify:

- `Haptics.notificationAsync` called with correct type on success/error in async handlers
- `Haptics.impactAsync` called on toggle/selection actions
- `Haptics.selectionAsync` called on tab/filter switches

## Files Modified

- `app/groups/create.tsx`
- `app/groups/join.tsx`
- `app/groups/manage-tournaments.tsx`
- `app/groups/[id].tsx`
- `app/(tabs)/ranking.tsx`
