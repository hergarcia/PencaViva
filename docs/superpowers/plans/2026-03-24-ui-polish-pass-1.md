# UI Polish Pass 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize colors, extract shared EmptyState component, and redesign match detail prediction states with richer per-state information.

**Architecture:** Token-driven color consistency (all colors from `constants.ts`), minimal component extraction (`EmptyState`), and state-aware prediction display cards with left indicator strips and result badges. Stitch MCP designs the match detail states before implementation.

**Tech Stack:** React Native, Expo, NativeWind v5, Reanimated v4, TypeScript, Jest, Stitch MCP

---

## Task 1: Add Color & Card Tokens to Constants

**Files:**

- Modify: `src/lib/constants.ts`
- Modify: `src/__tests__/lib/constants.test.ts`

- [ ] **Step 1: Write failing tests for new tokens**

Add to `src/__tests__/lib/constants.test.ts`:

```ts
it("exports prediction result colors", () => {
  expect(colors.exact).toBe("#FFB800");
  expect(colors.wrong).toBe("#6B6B80");
});

it("exports match status colors", () => {
  expect(colors.live).toBe("#FF4444");
});

it("exports card tokens", () => {
  expect(colors.cardRadius).toBe(16);
  expect(colors.cardPadding).toBe(16);
  expect(colors.cardBorderWidth).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --testPathPattern=constants`
Expected: FAIL — `colors.exact` is undefined

- [ ] **Step 3: Add tokens to constants.ts**

In `src/lib/constants.ts`, add inside the `colors` object:

```ts
// Prediction result colors
exact: "#FFB800",
wrong: "#6B6B80",
// Match status
live: "#FF4444",
// Card tokens
cardRadius: 16,
cardPadding: 16,
cardBorderWidth: 1,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- --testPathPattern=constants`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.ts src/__tests__/lib/constants.test.ts
git commit -m "feat(ui): add prediction result, live, and card tokens to constants"
```

---

## Task 2: Create EmptyState Component

**Files:**

- Create: `src/components/common/EmptyState.tsx`
- Create: `src/__tests__/components/common/EmptyState.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/components/common/EmptyState.test.tsx`:

```tsx
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { EmptyState } from "@components/common/EmptyState";

describe("EmptyState", () => {
  it("renders icon, title, and description", () => {
    const { getByText, getByTestId } = render(
      <EmptyState
        icon="football-outline"
        title="No matches"
        description="Check back later"
      />,
    );
    expect(getByTestId("empty-state-icon")).toBeTruthy();
    expect(getByText("No matches")).toBeTruthy();
    expect(getByText("Check back later")).toBeTruthy();
  });

  it("renders without description", () => {
    const { getByText, queryByTestId } = render(
      <EmptyState icon="trophy-outline" title="No rankings" />,
    );
    expect(getByText("No rankings")).toBeTruthy();
    expect(queryByTestId("empty-state-description")).toBeNull();
  });

  it("renders primary action button", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EmptyState
        icon="people-outline"
        title="No groups"
        actions={[{ label: "Create", onPress, variant: "primary" }]}
      />,
    );
    fireEvent.press(getByText("Create"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders outline action button", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EmptyState
        icon="people-outline"
        title="No groups"
        actions={[{ label: "Join", onPress, variant: "outline" }]}
      />,
    );
    fireEvent.press(getByText("Join"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders multiple action buttons", () => {
    const { getByText } = render(
      <EmptyState
        icon="people-outline"
        title="No groups"
        description="Join or create a group"
        actions={[
          { label: "Join", onPress: jest.fn(), variant: "outline" },
          { label: "Create", onPress: jest.fn(), variant: "primary" },
        ]}
      />,
    );
    expect(getByText("Join")).toBeTruthy();
    expect(getByText("Create")).toBeTruthy();
  });

  it("uses custom icon size", () => {
    const { getByTestId } = render(
      <EmptyState icon="people-outline" iconSize={64} title="No groups" />,
    );
    expect(getByTestId("empty-state-icon")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --testPathPattern=EmptyState`
Expected: FAIL — module not found

- [ ] **Step 3: Create EmptyState component**

Create `src/components/common/EmptyState.tsx`:

```tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";

type EmptyStateAction = {
  label: string;
  onPress: () => void;
  variant: "primary" | "outline";
};

type EmptyStateProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconSize?: number;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
};

export function EmptyState({
  icon,
  iconSize = 48,
  title,
  description,
  actions,
}: EmptyStateProps) {
  return (
    <View
      testID="empty-state"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
      }}
    >
      <Ionicons
        testID="empty-state-icon"
        name={icon}
        size={iconSize}
        color={colors.textSecondary}
      />
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 18,
          fontWeight: "600",
          marginTop: 16,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {description && (
        <Text
          testID="empty-state-description"
          style={{
            color: colors.textSecondary,
            fontSize: 14,
            marginTop: 8,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          {description}
        </Text>
      )}
      {actions && actions.length > 0 && (
        <View style={{ marginTop: 24, width: "100%", gap: 12 }}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              onPress={action.onPress}
              style={
                action.variant === "primary"
                  ? {
                      backgroundColor: colors.primary,
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: "center",
                    }
                  : {
                      backgroundColor: colors.surface,
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: colors.surfaceBorder,
                    }
              }
            >
              <Text
                style={{
                  color:
                    action.variant === "primary"
                      ? colors.background
                      : colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- --testPathPattern=EmptyState`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/common/EmptyState.tsx src/__tests__/components/common/EmptyState.test.tsx
git commit -m "feat(ui): extract shared EmptyState component"
```

---

## Task 3: Replace Empty States in Screens

**Files:**

- Modify: `app/(tabs)/predict.tsx`
- Modify: `app/(tabs)/ranking.tsx`
- Modify: `app/(tabs)/groups/index.tsx`

This task replaces the copy-pasted empty state JSX blocks with the new `<EmptyState>` component. Each screen keeps its own logic for _which_ empty state to show.

- [ ] **Step 1: Replace empty states in predict.tsx**

In `app/(tabs)/predict.tsx`:

- Import `EmptyState` from `@components/common/EmptyState`
- Replace the "No groups yet" block (~lines 61-146) with:

```tsx
<EmptyState
  icon="people-outline"
  title="No groups yet"
  description="Join or create a group to start predicting"
  actions={[
    {
      label: "Join Group",
      onPress: () => router.push("/groups/join"),
      variant: "outline",
    },
    {
      label: "Create Group",
      onPress: () => router.push("/groups/create"),
      variant: "primary",
    },
  ]}
/>
```

- Replace the "No upcoming matches" block (~lines 248-284) with:

```tsx
<EmptyState
  icon="football-outline"
  title="No upcoming matches"
  description="Check back later for new fixtures"
/>
```

- [ ] **Step 2: Replace empty states in ranking.tsx**

In `app/(tabs)/ranking.tsx`:

- Import `EmptyState` from `@components/common/EmptyState`
- Replace the "No groups yet" block (~lines 230-315) with:

```tsx
<EmptyState
  icon="trophy-outline"
  title="No groups yet"
  description="Join or create a group to see the leaderboard"
  actions={[
    {
      label: "Join Group",
      onPress: () => router.push("/groups/join"),
      variant: "outline",
    },
    {
      label: "Create Group",
      onPress: () => router.push("/groups/create"),
      variant: "primary",
    },
  ]}
/>
```

- Replace the empty leaderboard block (~lines 420-462) with:

```tsx
<EmptyState
  icon={activeFilter === "overall" ? "podium-outline" : "calendar-outline"}
  title={
    activeFilter === "overall" ? "No rankings yet" : "No results this period"
  }
  description={
    activeFilter === "overall"
      ? "Rankings appear after the first match is scored"
      : "No matches were completed in this time range"
  }
/>
```

- [ ] **Step 3: Replace empty states in groups/index.tsx**

In `app/(tabs)/groups/index.tsx`:

- Import `EmptyState` from `@components/common/EmptyState`
- Replace the empty groups block (~lines 146-252) with:

```tsx
<EmptyState
  icon="people-outline"
  iconSize={64}
  title="No groups yet"
  description="Create a group to start predicting with friends, or join one with an invite code."
  actions={[
    {
      label: "Create Group",
      onPress: () => router.push("/groups/create"),
      variant: "primary",
    },
    {
      label: "Join Group",
      onPress: () => router.push("/groups/join"),
      variant: "outline",
    },
  ]}
/>
```

**Note:** `app/player-stats/[userId].tsx` has a small empty state ("No predictions scored yet") inside a `SectionList` `ListEmptyComponent`. This is a single-line inline message, not the full icon+title+actions pattern — skip extraction here (not worth the abstraction).

- [ ] **Step 4: Run all tests**

Run: `npm run test:unit`
Expected: All existing tests pass (some test assertions may need updating if they look for specific text that moved into EmptyState). If tests fail, update assertions to use the same text strings.

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/predict.tsx app/(tabs)/ranking.tsx "app/(tabs)/groups/index.tsx"
git commit -m "refactor(ui): replace inline empty states with shared EmptyState component"
```

---

## Task 4: Fix Hardcoded Colors Across All Screens

**Files:**

- Modify: `app/(auth)/login.tsx` (lines 38-39)
- Modify: `app/(auth)/complete-profile.tsx` (lines 134, 136, 234, 237)
- Modify: `app/(auth)/welcome.tsx` (line 92)
- Modify: `app/(tabs)/profile.tsx` (lines 547, 552)
- Modify: `app/groups/join.tsx` (line 268)
- Modify: `src/components/predictions/MatchCard.tsx` (line 98)
- Modify: `src/components/predictions/GroupPredictions.tsx` (line 71)
- Modify: `app/match/[id].tsx` (lines 188, 364, 419)

- [ ] **Step 1: Fix login.tsx — NativeWind red → inline danger**

Replace the error View (line ~38):

```tsx
// Before:
<View className="mb-6 w-full rounded-xl border border-red-500/50 bg-red-900/30 px-4 py-3">
  <Text className="text-center text-sm text-red-400">{error}</Text>

// After:
<View
  className="mb-6 w-full rounded-xl px-4 py-3"
  style={{
    borderWidth: 1,
    borderColor: colors.danger + "80",
    backgroundColor: colors.danger + "1A",
  }}
>
  <Text className="text-center text-sm" style={{ color: colors.danger }}>
    {error}
  </Text>
```

Ensure `colors` is imported from `@lib/constants`.

- [ ] **Step 2: Fix complete-profile.tsx — #EF4444 → colors.danger**

Replace lines ~134, ~136:

```ts
// Before:
if (localValidation && !localValidation.isValid) return "#EF4444";
if (isAvailable === false) return "#EF4444";
// After:
if (localValidation && !localValidation.isValid) return colors.danger;
if (isAvailable === false) return colors.danger;
```

Replace the error banner (~line 234) — same pattern as login.tsx:

```tsx
// Before:
className="mb-6 rounded-xl border border-red-500/50 bg-red-900/30 px-4 py-3"
// After:
className="mb-6 rounded-xl px-4 py-3"
style={{
  borderWidth: 1,
  borderColor: colors.danger + "80",
  backgroundColor: colors.danger + "1A",
}}
```

And the error text:

```tsx
// Before:
<Text className="text-center text-sm text-red-400">{error}</Text>
// After:
<Text className="text-center text-sm" style={{ color: colors.danger }}>{error}</Text>
```

- [ ] **Step 3: Fix welcome.tsx — bg-[#00D4AA] → inline**

Replace line ~92:

```tsx
// Before:
className="mt-6 items-center rounded-xl bg-[#00D4AA] py-4"
// After:
className="mt-6 items-center rounded-xl py-4"
style={{ backgroundColor: colors.primary }}
```

And the text (line ~96):

```tsx
// Before:
<Text className="text-base font-bold text-[#0D0D0D]">
// After:
<Text className="text-base font-bold" style={{ color: colors.background }}>
```

Ensure `colors` is imported from `@lib/constants`.

- [ ] **Step 4: Fix profile.tsx — sign-out #EF4444 → colors.danger**

Replace lines ~547, ~552:

```ts
// Before:
borderColor: "#EF4444",
// After:
borderColor: colors.danger,

// Before:
style={{ color: "#EF4444", fontWeight: "bold" }}
// After:
style={{ color: colors.danger, fontWeight: "bold" }}
```

Ensure `colors` is imported from `@lib/constants`.

- [ ] **Step 5: Fix join.tsx — #FF4444 → colors.danger**

Replace line ~268:

```ts
// Before:
color: "#FF4444",
// After:
color: colors.danger,
```

Ensure `colors` is imported from `@lib/constants`.

- [ ] **Step 6: Fix MatchCard.tsx — #FF4444 → colors.live**

Replace line ~98:

```ts
// Before:
backgroundColor: "#FF4444",
// After:
backgroundColor: colors.live,
```

Ensure `colors` is imported from `@lib/constants`.

- [ ] **Step 7: Fix GroupPredictions.tsx — #FF4444 → colors.danger**

Replace line ~71:

```ts
// Before:
<Text style={{ color: "#FF4444", fontSize: 13 }}>{error}</Text>
// After:
<Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>
```

- [ ] **Step 8: Fix match/[id].tsx — #FF4444 → colors.live / colors.danger**

Replace LIVE badge (line ~188):

```ts
backgroundColor: "#FF4444" → backgroundColor: colors.live
```

Replace error text (line ~364):

```ts
color: "#FF4444" → color: colors.danger
```

Replace error banner (line ~419):

```ts
color: "#FF4444" → color: colors.danger
```

- [ ] **Step 9: Run all tests**

Run: `npm run test:unit`
Expected: All tests pass (color changes are visual-only, no logic change)

- [ ] **Step 10: Run linter and format**

Run: `npm run lint && npm run format:check`
Expected: Clean

- [ ] **Step 11: Commit**

```bash
git add app/(auth)/login.tsx app/(auth)/complete-profile.tsx app/(auth)/welcome.tsx \
  app/(tabs)/profile.tsx app/groups/join.tsx app/match/[id].tsx \
  src/components/predictions/MatchCard.tsx src/components/predictions/GroupPredictions.tsx
git commit -m "fix(ui): replace all hardcoded colors with design tokens from constants"
```

---

## Task 5: Design Match Detail States in Stitch

**Tools:** Stitch MCP (`mcp__stitch__edit_screens`, `mcp__stitch__generate_screen_from_text`, `mcp__stitch__get_screen`)

- [ ] **Step 1: Review existing Stitch project screens**

Use `mcp__stitch__list_screens` on project `13390158725206896883` to see current screens.

- [ ] **Step 2: Design "Match Detail — Editable" state**

Use `mcp__stitch__generate_screen_from_text` with enhanced prompt (use `/enhance-prompt` skill):

- Dark theme mobile screen (#0D0D0D background)
- Tournament name + matchday header
- Teams card (surface #1A1A2E) with 3px emerald green (#00D4AA) left indicator strip
- Score stepper rows inside the card
- Gold countdown label "Locks in 2h 15m"
- Primary green save button
- Device: MOBILE

- [ ] **Step 3: Fetch and review, iterate until polished**

Use `mcp__stitch__get_screen` to view the result. If not polished enough, use `mcp__stitch__edit_screens` to refine. Iterate autonomously.

- [ ] **Step 4: Design "Match Detail — Live with Prediction" state**

Enhanced prompt for:

- Same dark theme header
- Prediction card with 3px red (#FF4444) left indicator strip
- "YOUR PREDICTION" uppercase label + pulsing LIVE indicator (red dot + "LIVE" text)
- Side-by-side: "Prediction: 2 - 1" | "Current: 1 - 0"
- Gold status pill: "Exact Score! +5 pts" (gold bg at 15% opacity, gold text)
- Also generate variant with green pill: "Correct Result +3 pts"
- Also generate variant with gray pill: "Wrong +0 pts"

- [ ] **Step 5: Design "Match Detail — Finished with Prediction" state**

Enhanced prompt for:

- Prediction card with gold left indicator strip (exact score variant)
- Full-width gold result badge pill "Exact Score!" (15% opacity bg)
- Two-column comparison: "Your Prediction: 2 - 1" | "Final Score: 2 - 1"
- Vertical divider between columns
- Large "+5 pts" in gold at bottom
- Also generate green variant (correct result, "+3 pts")
- Also generate gray variant (wrong, "+0 pts")

- [ ] **Step 6: Design "Match Detail — Finished/Live No Prediction" state**

Enhanced prompt for:

- Card with gray (#6B6B80) left indicator strip
- Lock icon + "No prediction submitted" centered
- "0 pts" in muted gray

- [ ] **Step 7: Iterate all designs until polished**

Review all generated screens. Use `mcp__stitch__edit_screens` to refine spacing, typography, colors. Ensure consistency across all states.

- [ ] **Step 8: Sync design system**

Run `/design-md` skill to update `.stitch/DESIGN.md` with any new design tokens or patterns from the Stitch designs.

---

## Task 6: Implement Match Detail Prediction States

**Files:**

- Modify: `app/match/[id].tsx`
- Modify: `src/__tests__/navigation/match-detail-screen.test.tsx`

This is the main implementation task. The match detail screen gets new sub-components for each prediction state.

- [ ] **Step 1: Write failing tests for new prediction state displays**

**Important:** The existing test file uses a `mockHookReturn` mutable variable pattern (not `jest.Mock().mockReturnValue`). The `useGroupDetail` mock returns `{ group: null }` by default — for tests that need point calculation, override it with a mock group that includes `scoring_system`.

First, update the `useGroupDetail` mock at the top of the file to be overridable:

```tsx
// Replace the existing useGroupDetail mock (line ~36-38) with:
let mockGroup: Record<string, unknown> | null = null;
jest.mock("@hooks/use-group-detail", () => ({
  useGroupDetail: () => ({ group: mockGroup }),
}));
```

Add a `mockScoringSystem` constant after `defaultCountdown`:

```tsx
const mockScoringSystem = {
  exact_score: 5,
  correct_result: 3,
  correct_goal_diff: 1,
  wrong: 0,
};
```

Then add these tests inside the existing `describe("MatchDetailScreen", ...)` block:

```tsx
it("shows result badge and points for finished match with exact prediction", () => {
  mockHookReturn = {
    match: { ...mockMatch, status: "finished", home_score: 2, away_score: 1 },
    prediction: { home_score_pred: 2, away_score_pred: 1, points: 5 },
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    save: mockSave,
    isSaving: false,
    saveError: null,
    isLockedByServer: false,
  };
  mockUseCountdown.mockReturnValue(defaultCountdown);

  const { getByText, getByTestId } = render(<MatchDetailScreen />);
  expect(getByTestId("result-badge")).toBeTruthy();
  expect(getByText("Exact Score!")).toBeTruthy();
  expect(getByText("+5 pts")).toBeTruthy();
});

it("shows correct result badge for finished match", () => {
  mockHookReturn = {
    match: { ...mockMatch, status: "finished", home_score: 2, away_score: 1 },
    prediction: { home_score_pred: 1, away_score_pred: 0, points: 3 },
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    save: mockSave,
    isSaving: false,
    saveError: null,
    isLockedByServer: false,
  };
  mockUseCountdown.mockReturnValue(defaultCountdown);

  const { getByText } = render(<MatchDetailScreen />);
  expect(getByText("Correct Result")).toBeTruthy();
  expect(getByText("+3 pts")).toBeTruthy();
});

it("shows correct result with diff bonus for finished match", () => {
  mockHookReturn = {
    match: { ...mockMatch, status: "finished", home_score: 2, away_score: 1 },
    prediction: { home_score_pred: 3, away_score_pred: 2, points: 4 },
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    save: mockSave,
    isSaving: false,
    saveError: null,
    isLockedByServer: false,
  };
  mockUseCountdown.mockReturnValue(defaultCountdown);

  const { getByText } = render(<MatchDetailScreen />);
  expect(getByText("Correct Result")).toBeTruthy();
  expect(getByText("+4 pts")).toBeTruthy();
});

it("shows wrong badge for finished match with wrong prediction", () => {
  mockHookReturn = {
    match: { ...mockMatch, status: "finished", home_score: 2, away_score: 1 },
    prediction: { home_score_pred: 0, away_score_pred: 3, points: 0 },
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    save: mockSave,
    isSaving: false,
    saveError: null,
    isLockedByServer: false,
  };
  mockUseCountdown.mockReturnValue(defaultCountdown);

  const { getByText } = render(<MatchDetailScreen />);
  expect(getByText("Wrong")).toBeTruthy();
  expect(getByText("+0 pts")).toBeTruthy();
});

it("shows prediction comparison columns for finished match", () => {
  mockHookReturn = {
    match: { ...mockMatch, status: "finished", home_score: 2, away_score: 1 },
    prediction: { home_score_pred: 2, away_score_pred: 1, points: 5 },
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    save: mockSave,
    isSaving: false,
    saveError: null,
    isLockedByServer: false,
  };
  mockUseCountdown.mockReturnValue(defaultCountdown);

  const { getByText } = render(<MatchDetailScreen />);
  expect(getByText("Your Prediction")).toBeTruthy();
  expect(getByText("Final Score")).toBeTruthy();
});

it("shows live point tracking for live match with prediction", () => {
  mockGroup = { scoring_system: mockScoringSystem };
  mockHookReturn = {
    match: { ...mockMatch, status: "live", home_score: 2, away_score: 1 },
    prediction: { home_score_pred: 2, away_score_pred: 1 },
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    save: mockSave,
    isSaving: false,
    saveError: null,
    isLockedByServer: false,
  };
  mockUseCountdown.mockReturnValue(defaultCountdown);

  const { getByText, getByTestId } = render(<MatchDetailScreen />);
  expect(getByTestId("live-indicator")).toBeTruthy();
  expect(getByText(/Exact Score!/)).toBeTruthy();
  expect(getByText(/\+5 pts/)).toBeTruthy();
});

it("shows no-prediction message for finished match without prediction", () => {
  mockHookReturn = {
    match: { ...mockMatch, status: "finished", home_score: 2, away_score: 1 },
    prediction: null,
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    save: mockSave,
    isSaving: false,
    saveError: null,
    isLockedByServer: false,
  };
  mockUseCountdown.mockReturnValue(defaultCountdown);

  const { getByText } = render(<MatchDetailScreen />);
  expect(getByText("No prediction submitted")).toBeTruthy();
  expect(getByText("0 pts")).toBeTruthy();
});

it("shows primary left border on editable stepper card", () => {
  mockHookReturn = {
    match: mockMatch,
    prediction: null,
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    save: mockSave,
    isSaving: false,
    saveError: null,
    isLockedByServer: false,
  };
  mockUseCountdown.mockReturnValue(defaultCountdown);

  const { getByTestId } = render(<MatchDetailScreen />);
  expect(getByTestId("prediction-card-indicator")).toBeTruthy();
});
```

**Note:** Add `afterEach(() => { mockGroup = null; })` to the describe block to reset the group mock after each test.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --testPathPattern=match-detail-screen`
Expected: FAIL — new testIDs and text not found

- [ ] **Step 3: Create helper function for result styling**

Add a helper at the top of `app/match/[id].tsx` (or in a local block before the component):

```tsx
import {
  getPredictionStatus,
  calculatePotentialPoints,
} from "@lib/scoring-utils";
import type { PredictionStatus } from "@lib/scoring-utils";
import type { ScoringSystem } from "@lib/groups-service";

function getResultStyle(status: PredictionStatus) {
  switch (status) {
    case "exact":
      return {
        color: colors.exact,
        label: "Exact Score!",
        bg: colors.exact + "26",
      };
    case "correct_result_and_diff":
      return {
        color: colors.success,
        label: "Correct Result",
        bg: colors.success + "26",
      };
    case "correct_result":
      return {
        color: colors.success,
        label: "Correct Result",
        bg: colors.success + "26",
      };
    case "wrong":
      return { color: colors.wrong, label: "Wrong", bg: colors.wrong + "26" };
  }
}
```

- [ ] **Step 4: Implement editable state with indicator strip**

Replace the editable prediction card wrapper (~lines 295-324) to add the indicator strip:

```tsx
<View
  style={{
    backgroundColor: colors.surface,
    borderRadius: colors.cardRadius,
    paddingHorizontal: 16,
    paddingVertical: 4,
    overflow: "hidden",
    position: "relative",
  }}
>
  <View
    testID="prediction-card-indicator"
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: colors.primary,
      borderTopLeftRadius: colors.cardRadius,
      borderBottomLeftRadius: colors.cardRadius,
    }}
  />
  <ScoreStepper ... />
  <View style={{ height: 1, backgroundColor: colors.surfaceBorder, marginHorizontal: 4 }} />
  <ScoreStepper ... />
</View>
```

- [ ] **Step 5: Implement live prediction state**

Replace the read-only prediction display (the `else` branch after `isEditable`, ~lines 376-428) with a state-aware renderer:

```tsx
{isLive && prediction ? (
  <View
    style={{
      backgroundColor: colors.surface,
      borderRadius: colors.cardRadius,
      padding: colors.cardPadding,
      overflow: "hidden",
      position: "relative",
    }}
  >
    {/* Left indicator */}
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: colors.live,
        borderTopLeftRadius: colors.cardRadius,
        borderBottomLeftRadius: colors.cardRadius,
      }}
    />

    {/* Header */}
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700" }}>
        YOUR PREDICTION
      </Text>
      <View testID="live-indicator" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live }} />
        <Text style={{ color: colors.live, fontSize: 11, fontWeight: "700" }}>LIVE</Text>
      </View>
    </View>

    {/* Score comparison */}
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 4 }}>Prediction</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
          {prediction.home_score_pred} - {prediction.away_score_pred}
        </Text>
      </View>
      <View style={{ width: 1, height: 40, backgroundColor: colors.surfaceBorder }} />
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 4 }}>Current Score</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
          {match.home_score} - {match.away_score}
        </Text>
      </View>
    </View>

    {/* Status pill */}
    {match.home_score != null && match.away_score != null && (() => {
      const status = getPredictionStatus(prediction.home_score_pred, prediction.away_score_pred, match.home_score!, match.away_score!);
      const style = getResultStyle(status);
      const points = group ? calculatePotentialPoints(prediction.home_score_pred, prediction.away_score_pred, match.home_score!, match.away_score!, group.scoring_system) : 0;
      return (
        <View testID="result-badge" style={{ backgroundColor: style.bg, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, alignItems: "center", marginTop: 16 }}>
          <Text style={{ color: style.color, fontSize: 14, fontWeight: "700" }}>
            {style.label} +{points} pts
          </Text>
        </View>
      );
    })()}
  </View>
)}
```

- [ ] **Step 6: Implement finished prediction state**

```tsx
{isFinished && prediction ? (
  <View
    style={{
      backgroundColor: colors.surface,
      borderRadius: colors.cardRadius,
      padding: colors.cardPadding,
      overflow: "hidden",
      position: "relative",
    }}
  >
    {/* Left indicator — color based on result */}
    {match.home_score != null && match.away_score != null && (() => {
      const status = getPredictionStatus(prediction.home_score_pred, prediction.away_score_pred, match.home_score!, match.away_score!);
      const style = getResultStyle(status);
      const points = prediction.points ?? 0;
      return (
        <>
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              backgroundColor: style.color,
              borderTopLeftRadius: colors.cardRadius,
              borderBottomLeftRadius: colors.cardRadius,
            }}
          />

          {/* Result badge */}
          <View testID="result-badge" style={{ backgroundColor: style.bg, borderRadius: 12, paddingVertical: 10, alignItems: "center", marginBottom: 16 }}>
            <Text style={{ color: style.color, fontSize: 15, fontWeight: "700" }}>{style.label}</Text>
          </View>

          {/* Score comparison */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 4 }}>Your Prediction</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
                {prediction.home_score_pred} - {prediction.away_score_pred}
              </Text>
            </View>
            <View style={{ width: 1, height: 40, backgroundColor: colors.surfaceBorder }} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 4 }}>Final Score</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
                {match.home_score} - {match.away_score}
              </Text>
            </View>
          </View>

          {/* Points */}
          <Text style={{ color: style.color, fontSize: 28, fontWeight: "700", textAlign: "center", marginTop: 16 }}>
            +{points} pts
          </Text>
        </>
      );
    })()}
  </View>
)}
```

- [ ] **Step 7: Implement no-prediction states (live & finished)**

```tsx
{
  (isLive || isFinished) && !prediction && (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: colors.cardRadius,
        padding: colors.cardPadding,
        overflow: "hidden",
        position: "relative",
        alignItems: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: isLive ? colors.live : colors.wrong,
          borderTopLeftRadius: colors.cardRadius,
          borderBottomLeftRadius: colors.cardRadius,
        }}
      />
      <Ionicons name="lock-closed" size={24} color={colors.textSecondary} />
      <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8 }}>
        No prediction submitted
      </Text>
      <Text
        style={{
          color: colors.wrong,
          fontSize: 16,
          fontWeight: "600",
          marginTop: 4,
        }}
      >
        0 pts
      </Text>
    </View>
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test:unit -- --testPathPattern=match-detail-screen`
Expected: All tests PASS (old + new)

- [ ] **Step 9: Run full test suite + CI checks**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:ci`
Expected: All pass

- [ ] **Step 10: Commit**

```bash
git add app/match/[id].tsx src/__tests__/navigation/match-detail-screen.test.tsx
git commit -m "feat(ui): redesign match detail prediction states with result badges and live tracking"
```

---

## Task 7: Final CI Check & Docs Update

**Files:**

- Modify: `TAREAS.md`
- Modify: `CLAUDE.md` (if structure notes need updating)

- [ ] **Step 1: Run full CI pipeline**

```bash
npm run format:check && npm run lint && npm run typecheck && npm run test:ci
```

Expected: All pass

- [ ] **Step 2: Fix any issues found**

Address lint/format/type errors if any.

- [ ] **Step 3: Update TAREAS.md**

No specific task ID for this polish pass. Add a new entry in Phase 2 or add as a note under Phase 1 completion.

- [ ] **Step 4: Update CLAUDE.md if needed**

Update the "Project Structure" section in CLAUDE.md if the new `EmptyState` component or new color tokens change any documented patterns.

- [ ] **Step 5: Commit docs**

```bash
git add TAREAS.md CLAUDE.md
git commit -m "docs: update task tracking and project docs for UI polish pass 1"
```

---

## Execution Order

Tasks 1-4 are independent of Stitch and can proceed immediately:

1. **Task 1**: Color tokens (foundation for everything else)
2. **Task 2**: EmptyState component (new component, no dependencies)
3. **Task 3**: Replace empty states in screens (depends on Task 2)
4. **Task 4**: Fix hardcoded colors (depends on Task 1)

Task 5 (Stitch design) should happen before Task 6 (implementation).

5. **Task 5**: Design in Stitch (match detail states)
6. **Task 6**: Implement match detail states (depends on Tasks 1, 5)
7. **Task 7**: Final CI + docs
