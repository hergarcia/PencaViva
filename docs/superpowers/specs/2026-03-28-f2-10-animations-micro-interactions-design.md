# F2-10: Animations and Micro-Interactions — Design Spec

## Overview

Add four categories of micro-interactions to PencaViva using React Native Reanimated v4, building on existing animation patterns (skeleton pulse, score stepper bounce, leaderboard glow, save confirmation scale-in).

## 1. Confetti on Saving Prediction

**Where:** Inside the existing `SaveConfirmation.tsx` overlay (full-screen absolute positioned, 1500ms display window).

**Approach:** Pure Reanimated particles — no third-party library. Generate 30 small colored rectangles that burst upward from center and fall with simulated gravity.

**Implementation:**

- New `ConfettiOverlay` component rendered inside `SaveConfirmation`'s container
- 30 particles, each an `<Animated.View>` with:
  - Random horizontal spread: `withTiming(randomX, { duration: 1200 })`
  - Vertical trajectory: `withSequence(withTiming(-screenHeight*0.3, { duration: 400 }), withTiming(screenHeight*0.5, { duration: 800 }))` (up then down)
  - Random rotation: `withTiming(randomAngle, { duration: 1200 })`
  - Fade out at end: `withDelay(800, withTiming(0, { duration: 400 }))`
- Colors: cycle through `[colors.primary, colors.secondary, colors.accent, colors.success, colors.danger]`
- Particle size: 8x4 rectangles with `borderRadius: 2`
- Triggered when `visible` becomes `true`
- Performance: particles are pre-allocated (no dynamic array creation), animations run on UI thread

**Files changed:**

- New: `src/components/predictions/ConfettiOverlay.tsx`
- Modified: `src/components/predictions/SaveConfirmation.tsx` (add `<ConfettiOverlay>` inside container)

## 2. Red Pulse on LIVE Matches

**Where:** Two locations:

1. `MatchCard.tsx` — the LIVE badge in the match list
2. `app/match/[id].tsx` — the LIVE indicator dot in match detail

**Approach:** Animated pulsing dot (scale 1→1.4→1 + opacity 1→0.4→1) using `withRepeat(withTiming(...), -1, true)` — same looping pattern as skeleton animation.

**Implementation:**

- New `LivePulse` component (reusable) that wraps a dot `<Animated.View>`:
  - `useSharedValue(1)` for scale, `useSharedValue(1)` for opacity
  - `withRepeat(withTiming(1.4/0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true)`
  - Returns an animated dot (6x6 circle) with the pulse effect
- Add `liveRgb: "255, 68, 68"` to `constants.ts` for potential rgba usage
- In `MatchCard.tsx`: replace the static red dot (if present) with `<LivePulse />`
- In `app/match/[id].tsx`: replace the static dot at `testID="live-indicator"` with `<LivePulse />`

**Files changed:**

- New: `src/components/predictions/LivePulse.tsx`
- Modified: `src/components/predictions/MatchCard.tsx`
- Modified: `app/match/[id].tsx`
- Modified: `src/lib/constants.ts` (add `liveRgb`)

## 3. Gold Star on Exact Result

**Where:** Three locations:

1. `LeaderboardRow.tsx` — next to the exact scores count when `exact_scores > 0`
2. `app/match/[id].tsx` — on the result badge when prediction status is `"exact"`
3. `PredictionHistoryRow.tsx` — next to points when the prediction was exact

**Approach:** Star icon (`Ionicons "star"`) with a scale-in spring animation (0→1) on mount. For LeaderboardRow, static star (no animation needed since it's a list item). For match detail exact result, animated entrance.

**Implementation:**

- New `ExactStar` component:
  - Accepts `animated?: boolean` prop (default `false`)
  - Renders `<Ionicons name="star" size={14} color={colors.accent} />`
  - When `animated=true`: `useSharedValue(0)` → `withSpring(1, { damping: 8, stiffness: 200 })` on mount, applied as `transform: [{ scale }]`
  - Wraps icon in `<Animated.View>` only when animated
- In `LeaderboardRow.tsx`: add `<ExactStar />` next to "X EXACT" text when `exact_scores > 0`
- In `app/match/[id].tsx`: add `<ExactStar animated />` next to the "EXACT" badge in the finished prediction card
- In `PredictionHistoryRow.tsx`: add `<ExactStar />` next to points display when result is exact (points === max possible, typically 5+)

**Files changed:**

- New: `src/components/common/ExactStar.tsx`
- Modified: `src/components/ranking/LeaderboardRow.tsx`
- Modified: `src/components/ranking/PredictionHistoryRow.tsx`
- Modified: `app/match/[id].tsx`

## 4. Pull-to-Refresh Enhancement

**Where:** All 5 screens with `RefreshControl`.

**Decision:** Keep the native `RefreshControl` as-is. Custom pull-to-refresh animations in React Native are fragile, platform-specific, and high-maintenance for minimal UX improvement. The native spinner with `tintColor={colors.primary}` is already consistent with the design. A "bouncing ball" custom implementation would require replacing `RefreshControl` with gesture handlers and custom scroll management — high risk, low reward.

**Alternative enhancement:** No changes needed. The existing implementation is solid. The effort budget saved here is redirected to polishing the other three animations.

## Testing Strategy

All animations tested via Jest unit tests verifying:

- Component renders correctly with expected props
- Animation triggers at the right time (e.g., confetti on `visible=true`, pulse when `status === "live"`)
- Components handle edge cases (e.g., ExactStar with `animated=false`, LivePulse unmount cleanup)
- No regressions in existing SaveConfirmation, MatchCard, LeaderboardRow tests

Reanimated mock already exists (`src/__mocks__/react-native-reanimated.js`) — all animation values resolve synchronously in tests.

## Performance Considerations

- Confetti: 30 particles is the sweet spot — enough for visual impact, well within Reanimated's UI thread capacity. All animations use `useSharedValue` (UI thread), not `useState` (JS thread).
- LivePulse: Simple two-value loop, negligible overhead. Only renders when `status === "live"`.
- ExactStar: One-shot spring, no ongoing animation cost after settling.
- No `requestAnimationFrame` or JS-thread animations anywhere.

## Mock System

- `ConfettiOverlay`: No mock data needed (pure visual component)
- `LivePulse`: Already works with mock data (fixtures include live matches)
- `ExactStar`: Already works with mock data (fixtures include finished predictions with exact scores)

## Design Tokens

One addition to `constants.ts`:

```ts
liveRgb: "255, 68, 68",  // for rgba() in LivePulse animation
```
