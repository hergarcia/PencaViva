# UI Polish Pass 1 — Design Spec

**Date:** 2026-03-24
**Scope:** Consistency cleanup + visual upgrade across all existing screens, with focus on match detail prediction states.

## Goals

1. Standardize colors, spacing, and styling patterns across all screens
2. Redesign match detail prediction states with richer information per state
3. Extract minimal shared components to reduce duplication
4. Establish styling rules for NativeWind vs inline style usage

## Design Decisions

### 1. Color & Token Additions

Add to `src/lib/constants.ts`:

```ts
// Prediction result colors (semantic — for result badges/pills)
exact: '#FFB800',    // gold — same as accent, for exact score results
wrong: '#6B6B80',    // muted gray for wrong predictions

// Match status
live: '#FF4444',     // red for LIVE badge/indicators (distinct from danger)

// Card tokens
cardRadius: 16,
cardPadding: 16,
cardBorderWidth: 1,
```

**Note:** `correct` result uses existing `colors.success` (`#00C48C`) — no new token needed. `exact` reuses the accent hex but gets its own semantic name for clarity.

**Color replacement mapping:**

| File                                                      | Hardcoded value                         | Replace with                                |
| --------------------------------------------------------- | --------------------------------------- | ------------------------------------------- |
| `app/match/[id].tsx` lines 188-198                        | `#FF4444` (LIVE badge)                  | `colors.live`                               |
| `app/match/[id].tsx` lines 364, 419                       | `#FF4444` (error text)                  | `colors.danger`                             |
| `src/components/predictions/MatchCard.tsx` line 98        | `#FF4444` (LIVE badge)                  | `colors.live`                               |
| `src/components/predictions/GroupPredictions.tsx` line 71 | `#FF4444` (error text)                  | `colors.danger`                             |
| `app/groups/join.tsx` line 268                            | `#FF4444` (error text)                  | `colors.danger`                             |
| `app/(auth)/complete-profile.tsx` lines 134, 136          | `#EF4444` (error text)                  | `colors.danger`                             |
| `app/(auth)/complete-profile.tsx` line ~234               | `red-500/50`, `red-900/30` (NativeWind) | Inline style with `colors.danger` + opacity |
| `app/(tabs)/profile.tsx` lines 547, 552                   | `#EF4444` (sign-out button)             | `colors.danger`                             |
| `app/(auth)/login.tsx`                                    | `red-500/50`, `red-900/30` (NativeWind) | Inline style with `colors.danger` + opacity |
| `app/(auth)/welcome.tsx`                                  | `bg-[#00D4AA]` (NativeWind)             | Inline style with `colors.primary`          |

### 2. EmptyState Component

Extract `src/components/common/EmptyState.tsx`:

```ts
type EmptyStateAction = {
  label: string;
  onPress: () => void;
  variant: "primary" | "outline";
};

type EmptyStateProps = {
  icon: string; // Ionicons name
  iconSize?: number; // default 48
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
};
```

- Centered layout with icon, title, optional description, optional action buttons
- Primary variant: `colors.primary` background, dark text
- Outline variant: `colors.surface` background, `colors.surfaceBorder` border, light text
- Used in: Predict, Ranking, Groups, Player Stats screens

### 3. Match Detail Prediction States

#### Editable (scheduled, before kickoff)

- Stepper card gets a 3px-wide `View` positioned absolutely on the left edge inside the card (avoids rounded corner artifacts), colored `colors.primary`
- Countdown stays in `colors.accent` (gold)
- Save button, stepper behavior unchanged

#### Live — with prediction

- Card with `colors.live` left indicator strip (same absolute-positioned inner `View`, 3px wide)
- Surface background, standard card radius
- Header row: "YOUR PREDICTION" label (11px, uppercase, secondary) left, pulsing dot + "LIVE" right
- Body: side-by-side layout
  - Left: "Prediction" label + score (e.g., "2 - 1") in large text
  - Right: "Current Score" label + score in large text
- Footer: real-time status badge pill computed via `scoring-utils.ts`
  - `exact`: gold pill bg (`colors.exact` at 15% opacity), gold text — "Exact Score! +5 pts"
  - `correct_result_and_diff`: green pill bg (`colors.success` at 15% opacity), green text — "Correct Result +4 pts" (sum of result + diff bonus, shown as single total)
  - `correct_result`: green pill — "Correct Result +3 pts"
  - `wrong`: gray pill bg (`colors.wrong` at 15% opacity), gray text — "Wrong +0 pts"

#### Live — no prediction

- Same card with `colors.live` left indicator strip
- Lock icon + "No prediction submitted" in secondary text
- No points display

#### Finished — with prediction

- Card with result-colored left indicator strip:
  - `exact` → `colors.exact` (gold)
  - `correct_result_and_diff` or `correct_result` → `colors.success` (green)
  - `wrong` → `colors.wrong` (gray)
- Top: full-width result badge pill (colored bg at 15% opacity + colored text)
  - `exact`: "Exact Score!" (gold)
  - `correct_result_and_diff`: "Correct Result" (green) — same pill as correct_result
  - `correct_result`: "Correct Result" (green)
  - `wrong`: "Wrong" (gray)
  - 15% opacity backgrounds: `colors.exact + '26'`, `colors.success + '26'`, `colors.wrong + '26'`
- Middle: two-column comparison
  - Left column: "Your Prediction" label + score in bold
  - Right column: "Final Score" label + score in bold
  - Vertical divider between columns (1px, `colors.surfaceBorder`)
- Bottom: points earned in large bold text with matching color
  - `exact`: "+5 pts" in gold
  - `correct_result_and_diff`: "+4 pts" in green (total, not broken out)
  - `correct_result`: "+3 pts" in green
  - `wrong`: "+0 pts" in gray

#### Finished — no prediction

- Card with `colors.wrong` gray left indicator strip
- "No prediction submitted" + "0 pts" in muted gray

### 4. Styling Rules

- **NativeWind** for: static layout (`flex-1`, `items-center`), spacing (`px-4`, `mb-8`), sizing (`w-12`, `h-12`), border-radius (`rounded-xl`)
- **Inline styles** for: colors from constants, dynamic/conditional values, animations, computed styles
- **Never mix** both approaches on the same CSS property of the same element
- **No hardcoded hex** in NativeWind classes (no `bg-[#00D4AA]`) — use inline styles with constants instead
- **NativeWind-to-inline conversion** required where NativeWind uses hardcoded color values (e.g., `border-red-500/50` → inline style with `colors.danger`)

### 5. Stitch Workflow

- Use existing PencaViva Stitch project (ID: `13390158725206896883`)
- Clean up outdated screens
- Design each prediction state as a separate screen in Stitch
- Iterate autonomously until polished
- Implementation must faithfully reproduce approved Stitch designs

## Files Touched

### Major changes

- `app/match/[id].tsx` — prediction state redesign (editable/live/finished)

### New files

- `src/components/common/EmptyState.tsx` — shared empty state component

### Token updates

- `src/lib/constants.ts` — new color/card tokens

### Minor color fixes

- `app/(auth)/login.tsx` — NativeWind red classes → inline with `colors.danger`
- `app/(auth)/complete-profile.tsx` — `#EF4444` + NativeWind red classes → `colors.danger`
- `app/(auth)/welcome.tsx` — hardcoded hex in NativeWind → inline with constants
- `app/(tabs)/predict.tsx` — EmptyState extraction + color fix
- `app/(tabs)/ranking.tsx` — EmptyState extraction + color fix
- `app/(tabs)/groups/index.tsx` — EmptyState extraction + color fix
- `app/(tabs)/profile.tsx` — `#EF4444` → `colors.danger`
- `app/player-stats/[userId].tsx` — EmptyState extraction if applicable
- `app/groups/join.tsx` — `#FF4444` → `colors.danger`
- `src/components/predictions/GroupPredictions.tsx` — `#FF4444` → `colors.danger`
- `src/components/predictions/MatchCard.tsx` — `#FF4444` → `colors.live`

## Not In Scope

- Home tab redesign (placeholder, will get real content later)
- Full component library (buttons, inputs, badges)
- Converting entire screens between NativeWind ↔ inline
- New features or new screens
- New animations (second polish pass)
- Light mode / theming

## Testing

- Update existing tests where component structure changes (match detail)
- Add tests for new `EmptyState` component
- Ensure all existing tests still pass after color/styling changes
- Run full CI checks: format, lint, typecheck, test
