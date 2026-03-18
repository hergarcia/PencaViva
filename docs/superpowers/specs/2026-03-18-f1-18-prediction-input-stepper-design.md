# F1-18: Prediction Input (Numeric Stepper) — Design Spec

## Goal

Replace the placeholder match detail screen (`app/match/[id].tsx`) with a fully functional screen that displays match information and allows users to submit score predictions via stepper (+/-) controls with visual confirmation and haptic feedback.

## Architecture

The match detail screen fetches a single match by ID along with the user's existing prediction for the active group. A stepper UI lets users set home/away scores (0–20). Saving performs an UPSERT (insert or update) via Supabase client, with RLS enforcing the "before kickoff" constraint server-side. On success, a checkmark animation plays and haptic feedback fires.

## Tech Stack Additions

- `expo-haptics` — light impact on stepper tap, success notification on save

## Data Flow

```
app/match/[id].tsx
  → useMatchDetail(matchId, groupId)
    → fetchMatchDetail(matchId, groupId, userId)
      → supabase.from("matches").select(...).eq("id", matchId).single()
      → supabase.from("predictions").select(...).eq(...).maybeSingle()
    ← { match, prediction }
  → savePrediction(matchId, groupId, userId, home, away)
    → supabase.from("predictions").upsert({ ... }, { onConflict: "user_id,match_id,group_id" })
```

## Screen Layout

### Header (Back + Title)

- Back arrow (Ionicons `arrow-back`) navigates to previous screen
- Title: "Match Detail" or tournament short name

### Match Info Section

- Tournament name (pill badge, secondary text)
- Two team rows: logo (32px, letter fallback) + team name
- Between teams: "vs" separator for scheduled, or actual scores for live/finished
- Kickoff time: formatted date + time
- Venue (if available)
- Live badge (red "LIVE" pill) when `status === "live"`
- Matchday label (e.g., "Matchday 12") when available

### Prediction Section

Visible only when `activeGroupId` exists. Two states:

**Editable (before kickoff, status is "scheduled"):**

- Section title: "Your Prediction"
- Two stepper rows (home team, away team), each containing:
  - Team name (truncated)
  - Minus button (–) — disabled at 0
  - Score display (large number, centered)
  - Plus button (+) — disabled at 20
- Stepper buttons: 44×44 touch targets, surface background, primary border on press
- Score number: animated scale pulse on change (Reanimated `withSpring`)
- Haptic: `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on each +/- tap

**Read-only (after kickoff or live/finished):**

- If user has a prediction: show "Your Prediction: X – Y" in primary color
- If no prediction: show "No prediction submitted" in secondary text
- Closed lock icon (same as PredictionBadge)

### Save Button

- Full-width button at bottom: "Save Prediction" (primary bg, dark text)
- Disabled when: scores unchanged from existing prediction, or saving in progress
- On press:
  1. Set saving state
  2. Call `savePrediction()` (UPSERT)
  3. On success: play checkmark animation (scale in + fade), haptic `notificationAsync(Success)`, update local state
  4. On error: show inline error text, haptic `notificationAsync(Error)`
- If prediction already exists and scores change: button text → "Update Prediction"

### States

1. **Loading**: spinner centered
2. **Error**: error message + retry button
3. **No group**: message prompting to select/join a group
4. **Match not found**: 404-style message
5. **Editable**: full stepper UI + save button
6. **Read-only**: prediction display or "no prediction" message

## Service Layer

### `src/lib/prediction-service.ts`

```typescript
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
): Promise<{ match: MatchDetail; prediction: ExistingPrediction | null }>;

export async function savePrediction(
  matchId: string,
  groupId: string,
  userId: string,
  homeScore: number,
  awayScore: number,
): Promise<void>;
```

- `fetchMatchDetail`: Two parallel queries — match (with tournament join) + prediction (maybeSingle)
- `savePrediction`: UPSERT using `onConflict: "user_id,match_id,group_id"`. RLS handles kickoff enforcement server-side. Client also checks pre-submit to provide immediate feedback.

## Hook

### `src/hooks/use-match-detail.ts`

```typescript
export function useMatchDetail(
  matchId: string | undefined,
  groupId: string | null,
): {
  match: MatchDetail | null;
  prediction: ExistingPrediction | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  save: (home: number, away: number) => Promise<boolean>;
  isSaving: boolean;
};
```

- Fetches on mount and when matchId/groupId change
- `save()` calls `savePrediction()`, returns success boolean, updates local prediction state on success
- Uses `cancelledRef` pattern consistent with other hooks

## Component Breakdown

### `src/components/predictions/ScoreStepper.tsx`

Reusable stepper for one team's score:

```typescript
type ScoreStepperProps = {
  teamName: string;
  teamLogo: string | null;
  score: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
  minScore?: number; // default 0
  maxScore?: number; // default 20
};
```

- Animated score display with `useAnimatedStyle` + `withSpring` for scale bounce
- Touch targets 44×44 minimum
- Haptic on press

### `src/components/predictions/SaveConfirmation.tsx`

Overlay checkmark animation on save success:

- Animated `Ionicons checkmark-circle` scaling in from 0 with opacity fade
- Auto-dismisses after 1.5s
- Green (primary) color

## Prediction Lifecycle

1. User opens match from predict tab → navigates to `/match/[id]`
2. Screen reads `activeGroupId` from group-store
3. Fetches match detail + existing prediction
4. If prediction exists: pre-fills stepper with existing scores
5. User adjusts scores with +/- steppers
6. Taps "Save Prediction" / "Update Prediction"
7. UPSERT executes → success animation + haptic → local state updates
8. User can navigate back (prediction persists in DB)
9. On predict tab, pull-to-refresh reflects updated prediction status

## Edge Cases

- **No active group**: Show message "Select a group to make predictions" — shouldn't normally happen since navigation comes from predict tab which requires a group
- **Match already started**: Stepper hidden, read-only prediction display
- **Network error on save**: Inline error message, prediction not persisted, user can retry
- **RLS rejection** (race condition — kickoff passed between load and save): Treated as error, show "Predictions are closed for this match"
- **Score at boundary**: Minus disabled at 0, plus disabled at 20

## Testing Strategy

- **Unit tests for prediction-service**: Mock supabase, test fetchMatchDetail (match + prediction merge), test savePrediction (UPSERT call shape)
- **Unit tests for use-match-detail hook**: Mock service, test loading/error/success states, test save flow
- **Component tests for ScoreStepper**: Render, verify +/- buttons, verify disabled states at boundaries
- **Integration test for MatchDetailScreen**: Mock hook, verify all screen states (loading, error, editable, read-only)
