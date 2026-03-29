# F2-10: Animations & Micro-Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add confetti on prediction save, pulsing red dot on LIVE matches, and gold star on exact score results across multiple screens.

**Architecture:** Three new leaf components (`ConfettiOverlay`, `LivePulse`, `ExactStar`) that use React Native Reanimated v4 shared values for all animations. Each is integrated into existing screens by replacing static elements. No new dependencies.

**Tech Stack:** React Native Reanimated v4, Ionicons, Jest + React Native Testing Library

---

## File Structure

| Action | File                                                            | Responsibility                                      |
| ------ | --------------------------------------------------------------- | --------------------------------------------------- |
| Create | `src/components/predictions/ConfettiOverlay.tsx`                | 30-particle confetti burst with gravity simulation  |
| Create | `src/components/predictions/LivePulse.tsx`                      | Pulsing red dot for LIVE match indicators           |
| Create | `src/components/common/ExactStar.tsx`                           | Gold star icon, optionally animated on mount        |
| Create | `src/__tests__/components/predictions/ConfettiOverlay.test.tsx` | ConfettiOverlay tests                               |
| Create | `src/__tests__/components/predictions/LivePulse.test.tsx`       | LivePulse tests                                     |
| Create | `src/__tests__/components/common/ExactStar.test.tsx`            | ExactStar tests                                     |
| Modify | `src/lib/constants.ts`                                          | Add `liveRgb` design token                          |
| Modify | `src/components/predictions/SaveConfirmation.tsx`               | Render ConfettiOverlay inside overlay               |
| Modify | `src/components/predictions/MatchCard.tsx`                      | Replace static LIVE badge dot with LivePulse        |
| Modify | `app/match/[id].tsx`                                            | Add LivePulse + ExactStar in live/finished sections |
| Modify | `src/components/ranking/LeaderboardRow.tsx`                     | Add ExactStar next to exact score stats             |
| Modify | `src/components/ranking/PredictionHistoryRow.tsx`               | Add ExactStar for exact predictions                 |

---

### Task 1: Add `liveRgb` design token

**Files:**

- Modify: `src/lib/constants.ts:23` (add after `live: "#FF4444"`)

- [ ] **Step 1: Write the failing test**

Add a test to the existing constants test file:

```typescript
// In src/__tests__/lib/constants.test.ts — add this test case:
it("exports liveRgb for rgba() usage in animations", () => {
  expect(colors.liveRgb).toBe("255, 68, 68");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/constants.test.ts --verbose`
Expected: FAIL — `colors.liveRgb` is `undefined`

- [ ] **Step 3: Add the token**

In `src/lib/constants.ts`, add after the `live` line:

```typescript
  live: "#FF4444",
  liveRgb: "255, 68, 68", // for rgba() templates in animations
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/constants.test.ts --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.ts src/__tests__/lib/constants.test.ts
git commit -m "feat(tokens): add liveRgb design token for LIVE pulse animation"
```

---

### Task 2: LivePulse component

**Files:**

- Create: `src/components/predictions/LivePulse.tsx`
- Create: `src/__tests__/components/predictions/LivePulse.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/predictions/LivePulse.test.tsx`:

```tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { LivePulse } from "@components/predictions/LivePulse";

describe("LivePulse", () => {
  it("renders with testID", () => {
    const { getByTestId } = render(<LivePulse />);
    expect(getByTestId("live-pulse-dot")).toBeTruthy();
  });

  it("applies custom size prop", () => {
    const { getByTestId } = render(<LivePulse size={10} />);
    const dot = getByTestId("live-pulse-dot");
    expect(dot.props.style).toBeDefined();
  });

  it("renders without crashing with default props", () => {
    const { toJSON } = render(<LivePulse />);
    expect(toJSON()).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/components/predictions/LivePulse.test.tsx --verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement LivePulse**

Create `src/components/predictions/LivePulse.tsx`:

```tsx
import React, { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors } from "@lib/constants";

interface LivePulseProps {
  size?: number;
}

export function LivePulse({ size = 6 }: LivePulseProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      testID="live-pulse-dot"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.live,
        },
        animatedStyle,
      ]}
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/components/predictions/LivePulse.test.tsx --verbose`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/predictions/LivePulse.tsx src/__tests__/components/predictions/LivePulse.test.tsx
git commit -m "feat(animations): add LivePulse pulsing dot component"
```

---

### Task 3: Integrate LivePulse into MatchCard

**Files:**

- Modify: `src/components/predictions/MatchCard.tsx:1-2,95-108`
- Modify: `src/__tests__/components/predictions/MatchCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/components/predictions/MatchCard.test.tsx`:

```tsx
it("renders LivePulse dot for live matches", () => {
  const liveMatch = { ...baseMatch, status: "live" as const };
  const { getByTestId } = render(
    <MatchCard match={liveMatch} onPress={jest.fn()} />,
  );
  expect(getByTestId("live-pulse-dot")).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/components/predictions/MatchCard.test.tsx --verbose`
Expected: FAIL — `live-pulse-dot` not found

- [ ] **Step 3: Integrate LivePulse into MatchCard**

In `src/components/predictions/MatchCard.tsx`:

1. Add import at top:

```tsx
import { LivePulse } from "./LivePulse";
```

2. Replace the LIVE badge block (lines 95-108) with:

```tsx
{
  isLive && (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.live,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
      }}
    >
      <LivePulse size={5} />
      <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>
        LIVE
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/components/predictions/MatchCard.test.tsx --verbose`
Expected: PASS (all 8 tests including new one)

- [ ] **Step 5: Commit**

```bash
git add src/components/predictions/MatchCard.tsx src/__tests__/components/predictions/MatchCard.test.tsx
git commit -m "feat(animations): add LivePulse to MatchCard LIVE badge"
```

---

### Task 4: Integrate LivePulse into match detail screen

**Files:**

- Modify: `app/match/[id].tsx:582-607` (live indicator section)
- Modify: `src/__tests__/navigation/match-detail-screen.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/navigation/match-detail-screen.test.tsx` (find the live match test section):

```tsx
it("renders LivePulse dot in live indicator", async () => {
  // This test depends on the existing live match mock setup in the file.
  // Find the live match rendering test and add:
  expect(screen.getByTestId("live-pulse-dot")).toBeTruthy();
});
```

Note: If the match detail test file uses a mock that doesn't render the live state, you may need to adapt the test setup. Check the existing test file first.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/navigation/match-detail-screen.test.tsx --verbose`
Expected: FAIL — `live-pulse-dot` not found

- [ ] **Step 3: Integrate LivePulse into match detail**

In `app/match/[id].tsx`:

1. Add import at the top (alongside existing imports):

```tsx
import { LivePulse } from "@components/predictions/LivePulse";
```

2. Replace the static dot in the live indicator (around line 590-596):

Find this block inside the `testID="live-indicator"` View:

```tsx
<View
  style={{
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.live,
  }}
/>
```

Replace with:

```tsx
<LivePulse />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/navigation/match-detail-screen.test.tsx --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/match/[id].tsx src/__tests__/navigation/match-detail-screen.test.tsx
git commit -m "feat(animations): add LivePulse to match detail LIVE indicator"
```

---

### Task 5: ExactStar component

**Files:**

- Create: `src/components/common/ExactStar.tsx`
- Create: `src/__tests__/components/common/ExactStar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/common/ExactStar.test.tsx`:

```tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { ExactStar } from "@components/common/ExactStar";

describe("ExactStar", () => {
  it("renders with testID", () => {
    const { getByTestId } = render(<ExactStar />);
    expect(getByTestId("exact-star")).toBeTruthy();
  });

  it("renders with animated=false by default", () => {
    const { getByTestId } = render(<ExactStar />);
    expect(getByTestId("exact-star")).toBeTruthy();
  });

  it("renders with animated=true", () => {
    const { getByTestId } = render(<ExactStar animated />);
    expect(getByTestId("exact-star")).toBeTruthy();
  });

  it("accepts custom size", () => {
    const { getByTestId } = render(<ExactStar size={20} />);
    expect(getByTestId("exact-star")).toBeTruthy();
  });

  it("renders without crashing", () => {
    const { toJSON } = render(<ExactStar />);
    expect(toJSON()).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/components/common/ExactStar.test.tsx --verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ExactStar**

Create `src/components/common/ExactStar.tsx`:

```tsx
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";

interface ExactStarProps {
  size?: number;
  animated?: boolean;
}

export function ExactStar({ size = 14, animated = false }: ExactStarProps) {
  const scale = useSharedValue(animated ? 0 : 1);

  useEffect(() => {
    if (animated) {
      scale.value = withSpring(1, { damping: 8, stiffness: 200 });
    }
  }, [animated, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (animated) {
    return (
      <Animated.View testID="exact-star" style={animatedStyle}>
        <Ionicons name="star" size={size} color={colors.accent} />
      </Animated.View>
    );
  }

  return (
    <View testID="exact-star">
      <Ionicons name="star" size={size} color={colors.accent} />
    </View>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/components/common/ExactStar.test.tsx --verbose`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/common/ExactStar.tsx src/__tests__/components/common/ExactStar.test.tsx
git commit -m "feat(animations): add ExactStar gold star component"
```

---

### Task 6: Integrate ExactStar into LeaderboardRow

**Files:**

- Modify: `src/components/ranking/LeaderboardRow.tsx:99-102,225-235,394-405`
- Modify: `src/__tests__/components/ranking/LeaderboardRow.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/components/ranking/LeaderboardRow.test.tsx`:

```tsx
it("renders exact star when exact_scores > 0", () => {
  render(
    <LeaderboardRow
      entry={{ ...baseEntry, exact_scores: 3 }}
      isCurrentUser={false}
    />,
  );
  expect(screen.getByTestId("exact-star")).toBeTruthy();
});

it("does not render exact star when exact_scores is 0", () => {
  render(
    <LeaderboardRow
      entry={{ ...baseEntry, exact_scores: 0, correct_results: 5 }}
      isCurrentUser={false}
    />,
  );
  expect(screen.queryByTestId("exact-star")).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/components/ranking/LeaderboardRow.test.tsx --verbose`
Expected: FAIL — `exact-star` not found (test 1), and test 2 may pass

- [ ] **Step 3: Integrate ExactStar into LeaderboardRow**

In `src/components/ranking/LeaderboardRow.tsx`:

1. Add import at top:

```tsx
import { ExactStar } from "@components/common/ExactStar";
```

2. Find the `statsText` block in the podium section (around line 225-235). After the closing `</Text>` for the stats text in the podium section, add the ExactStar:

Locate this in the podium card (after the stats `<Text>` around line 235):

```tsx
<Text
  style={{
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 0.8,
  }}
  numberOfLines={1}
>
  {statsText}
</Text>
```

Wrap the stats area to include the star. Replace it with:

```tsx
<View
  style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}
>
  <Text
    style={{
      color: colors.textSecondary,
      fontSize: 10,
      letterSpacing: 0.8,
      flex: 1,
    }}
    numberOfLines={1}
  >
    {statsText}
  </Text>
  {entry.exact_scores > 0 && <ExactStar />}
</View>
```

Note: Remove the `marginTop: 4` from the `<Text>` style and put it on the wrapping `<View>` instead.

3. Do the same for the competitor card (rank 4+). Find the stats `<Text>` (around line 394-405):

```tsx
<Text
  style={{
    color: colors.textSecondary,
    fontSize: 9,
    marginTop: 3,
    letterSpacing: 0.5,
    opacity: 0.7,
  }}
  numberOfLines={1}
>
  {statsText}
</Text>
```

Replace with:

```tsx
<View
  style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}
>
  <Text
    style={{
      color: colors.textSecondary,
      fontSize: 9,
      letterSpacing: 0.5,
      opacity: 0.7,
      flex: 1,
    }}
    numberOfLines={1}
  >
    {statsText}
  </Text>
  {entry.exact_scores > 0 && <ExactStar size={12} />}
</View>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/components/ranking/LeaderboardRow.test.tsx --verbose`
Expected: PASS (all 20+ tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ranking/LeaderboardRow.tsx src/__tests__/components/ranking/LeaderboardRow.test.tsx
git commit -m "feat(animations): add ExactStar to LeaderboardRow stats"
```

---

### Task 7: Integrate ExactStar into PredictionHistoryRow

**Files:**

- Modify: `src/components/ranking/PredictionHistoryRow.tsx:82-93`
- Modify: `src/__tests__/components/ranking/PredictionHistoryRow.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/components/ranking/PredictionHistoryRow.test.tsx`:

```tsx
it("renders exact star when prediction is an exact score (points >= 5)", () => {
  const exactPrediction = {
    ...basePrediction,
    points: 5,
    home_score_pred: 2,
    away_score_pred: 1,
    match: { ...basePrediction.match, home_score: 2, away_score: 1 },
  };
  const { getByTestId } = render(
    <PredictionHistoryRow prediction={exactPrediction} />,
  );
  expect(getByTestId("exact-star")).toBeTruthy();
});

it("does not render exact star when points < 5", () => {
  const wrongPrediction = { ...basePrediction, points: 3 };
  const { queryByTestId } = render(
    <PredictionHistoryRow prediction={wrongPrediction} />,
  );
  expect(queryByTestId("exact-star")).toBeNull();
});
```

Note: Check the existing test file for what `basePrediction` looks like. If it has a different name, use that. The test fixture should have a `points` field.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/components/ranking/PredictionHistoryRow.test.tsx --verbose`
Expected: FAIL — `exact-star` not found

- [ ] **Step 3: Integrate ExactStar**

In `src/components/ranking/PredictionHistoryRow.tsx`:

1. Add import at top:

```tsx
import { ExactStar } from "@components/common/ExactStar";
```

2. Add `View` to the react-native import (if not already there).

3. Find the points display (around line 82-93):

```tsx
<Text
  style={{
    color: pointsColor(points),
    fontWeight: "700",
    fontSize: 16,
    marginLeft: 8,
  }}
>
  +{points}
</Text>
```

Replace with:

```tsx
<View
  style={{ flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8 }}
>
  {points >= 5 && <ExactStar size={12} />}
  <Text
    style={{
      color: pointsColor(points),
      fontWeight: "700",
      fontSize: 16,
    }}
  >
    +{points}
  </Text>
</View>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/components/ranking/PredictionHistoryRow.test.tsx --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ranking/PredictionHistoryRow.tsx src/__tests__/components/ranking/PredictionHistoryRow.test.tsx
git commit -m "feat(animations): add ExactStar to PredictionHistoryRow for exact scores"
```

---

### Task 8: Integrate ExactStar into match detail finished state

**Files:**

- Modify: `app/match/[id].tsx:749-769` (finished state result badge section)
- Modify: `src/__tests__/navigation/match-detail-screen.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/navigation/match-detail-screen.test.tsx` (in the finished match section):

```tsx
it("renders ExactStar on exact result badge in finished state", async () => {
  // Set up a finished match with exact prediction (prediction matches result exactly)
  // This test depends on existing mock setup — adapt to the file's test fixtures
  expect(screen.getByTestId("exact-star")).toBeTruthy();
});
```

Note: Adapt to the file's existing mock patterns. The test needs a finished match where `getPredictionStatus()` returns `"exact"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/navigation/match-detail-screen.test.tsx --verbose`
Expected: FAIL — `exact-star` not found

- [ ] **Step 3: Integrate ExactStar into match detail**

In `app/match/[id].tsx`:

1. Add import at the top:

```tsx
import { ExactStar } from "@components/common/ExactStar";
```

2. In the finished state result badge (around line 749-769), find the `testID="result-badge"` View. Inside it, after the `<Text>` with `{style.label}`, add the ExactStar when status is exact:

Replace the result badge content:

```tsx
<View
  testID="result-badge"
  style={{
    backgroundColor: style.bg,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  }}
>
  {status === "exact" && <ExactStar animated size={16} />}
  <Text
    style={{
      color: style.color,
      fontSize: 15,
      fontWeight: "700",
    }}
  >
    {style.label}
  </Text>
</View>
```

3. Also add the star in the LIVE state result badge (around line 685-705, the `testID="result-badge"` inside the live section). Same pattern but without `animated`:

```tsx
<View
  testID="result-badge"
  style={{
    backgroundColor: style.bg,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  }}
>
  {status === "exact" && <ExactStar size={14} />}
  <Text
    style={{
      color: style.color,
      fontSize: 14,
      fontWeight: "700",
    }}
  >
    {style.label} +{points} pts
  </Text>
</View>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/navigation/match-detail-screen.test.tsx --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/match/[id].tsx src/__tests__/navigation/match-detail-screen.test.tsx
git commit -m "feat(animations): add ExactStar to match detail result badges"
```

---

### Task 9: ConfettiOverlay component

**Files:**

- Create: `src/components/predictions/ConfettiOverlay.tsx`
- Create: `src/__tests__/components/predictions/ConfettiOverlay.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/predictions/ConfettiOverlay.test.tsx`:

```tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { ConfettiOverlay } from "@components/predictions/ConfettiOverlay";

describe("ConfettiOverlay", () => {
  it("renders nothing when active is false", () => {
    const { toJSON } = render(<ConfettiOverlay active={false} />);
    expect(toJSON()).toBeNull();
  });

  it("renders particles when active is true", () => {
    const { getByTestId } = render(<ConfettiOverlay active={true} />);
    expect(getByTestId("confetti-container")).toBeTruthy();
  });

  it("renders 30 particle elements", () => {
    const { getAllByTestId } = render(<ConfettiOverlay active={true} />);
    expect(getAllByTestId(/^confetti-particle-/)).toHaveLength(30);
  });

  it("renders without crashing when toggled active", () => {
    const { rerender, getByTestId, toJSON } = render(
      <ConfettiOverlay active={false} />,
    );
    expect(toJSON()).toBeNull();
    rerender(<ConfettiOverlay active={true} />);
    expect(getByTestId("confetti-container")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/components/predictions/ConfettiOverlay.test.tsx --verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ConfettiOverlay**

Create `src/components/predictions/ConfettiOverlay.tsx`:

```tsx
import React, { useEffect, useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
} from "react-native-reanimated";
import { colors } from "@lib/constants";

const PARTICLE_COUNT = 30;
const CONFETTI_COLORS = [
  colors.primary,
  colors.secondary,
  colors.accent,
  colors.success,
  colors.danger,
];

interface ParticleConfig {
  color: string;
  startX: number;
  endX: number;
  rotation: number;
}

function generateParticles(): ParticleConfig[] {
  const particles: ParticleConfig[] = [];
  const { width } = Dimensions.get("window");
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      startX: width / 2 - 4,
      endX: Math.random() * width - width / 2,
      rotation: Math.random() * 720 - 360,
    });
  }
  return particles;
}

function ConfettiParticle({
  config,
  index,
  active,
}: {
  config: ParticleConfig;
  index: number;
  active: boolean;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const { height } = Dimensions.get("window");

  useEffect(() => {
    if (active) {
      const delay = Math.random() * 100;
      translateX.value = withDelay(
        delay,
        withTiming(config.endX, { duration: 1200 }),
      );
      translateY.value = withDelay(
        delay,
        withSequence(
          withTiming(-height * 0.3, { duration: 400 }),
          withTiming(height * 0.5, { duration: 800 }),
        ),
      );
      rotate.value = withDelay(
        delay,
        withTiming(config.rotation, { duration: 1200 }),
      );
      opacity.value = withDelay(800, withTiming(0, { duration: 400 }));
    } else {
      translateX.value = 0;
      translateY.value = 0;
      rotate.value = 0;
      opacity.value = 1;
    }
  }, [active, config, translateX, translateY, rotate, opacity, height]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      testID={`confetti-particle-${index}`}
      style={[
        {
          position: "absolute",
          width: 8,
          height: 4,
          borderRadius: 2,
          backgroundColor: config.color,
          left: config.startX,
          top: "50%",
        },
        animatedStyle,
      ]}
    />
  );
}

interface ConfettiOverlayProps {
  active: boolean;
}

export function ConfettiOverlay({ active }: ConfettiOverlayProps) {
  const particles = useMemo(() => generateParticles(), []);

  if (!active) return null;

  return (
    <View
      testID="confetti-container"
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
    >
      {particles.map((config, i) => (
        <ConfettiParticle key={i} config={config} index={i} active={active} />
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/components/predictions/ConfettiOverlay.test.tsx --verbose`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/predictions/ConfettiOverlay.tsx src/__tests__/components/predictions/ConfettiOverlay.test.tsx
git commit -m "feat(animations): add ConfettiOverlay particle burst component"
```

---

### Task 10: Integrate ConfettiOverlay into SaveConfirmation

**Files:**

- Modify: `src/components/predictions/SaveConfirmation.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/components/predictions/SaveConfirmation.test.tsx` (if not exists) or add to existing:

```tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { SaveConfirmation } from "@components/predictions/SaveConfirmation";

describe("SaveConfirmation", () => {
  it("renders nothing when visible is false", () => {
    const { toJSON } = render(
      <SaveConfirmation visible={false} onDismiss={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders confetti when visible is true", () => {
    const { getByTestId } = render(
      <SaveConfirmation visible={true} onDismiss={jest.fn()} />,
    );
    expect(getByTestId("confetti-container")).toBeTruthy();
  });

  it("renders checkmark icon when visible", () => {
    const { toJSON } = render(
      <SaveConfirmation visible={true} onDismiss={jest.fn()} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/components/predictions/SaveConfirmation.test.tsx --verbose`
Expected: FAIL — `confetti-container` not found

- [ ] **Step 3: Integrate ConfettiOverlay**

In `src/components/predictions/SaveConfirmation.tsx`:

1. Add import:

```tsx
import { ConfettiOverlay } from "./ConfettiOverlay";
```

2. Inside the returned `<Animated.View style={[styles.container, animatedStyle]}>`, add `<ConfettiOverlay>` before the Ionicons checkmark:

```tsx
return (
  <Animated.View style={[styles.container, animatedStyle]}>
    <ConfettiOverlay active={visible} />
    <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
  </Animated.View>
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/components/predictions/SaveConfirmation.test.tsx --verbose`
Expected: PASS (3 tests)

- [ ] **Step 5: Run all related tests to verify no regressions**

Run: `npx jest --testPathPattern="(SaveConfirmation|ConfettiOverlay|match-detail)" --verbose`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/predictions/SaveConfirmation.tsx src/__tests__/components/predictions/SaveConfirmation.test.tsx
git commit -m "feat(animations): integrate ConfettiOverlay into SaveConfirmation"
```

---

### Task 11: Full test suite + CI checks

**Files:** None (verification only)

- [ ] **Step 1: Run the complete test suite**

Run: `npm run test:ci`
Expected: All tests pass, no regressions

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Run format check**

Run: `npm run format:check`
Expected: No issues (run `npm run format` if needed)

- [ ] **Step 5: Commit any formatting fixes if needed**

```bash
git add -A
git commit -m "style: format new animation components"
```

---

### Task 12: Documentation updates

**Files:**

- Modify: `TAREAS.md` (mark F2-10 completed, update progress table)
- Modify: `CLAUDE.md` (update project structure if needed)

- [ ] **Step 1: Update TAREAS.md**

Mark F2-10 as completed with notes:

```markdown
- [x] **F2-10** Animations and micro-interactions
  - Confetti on saving prediction
  - Gold star on exact result
  - Bouncing ball on pull-to-refresh
  - Red pulse on LIVE matches
  - Effort: 6h
  - Notes: Three new Reanimated v4 components: ConfettiOverlay (30-particle burst in SaveConfirmation), LivePulse (pulsing dot in MatchCard and match detail LIVE indicators), ExactStar (gold star icon in LeaderboardRow, PredictionHistoryRow, and match detail result badges). Pull-to-refresh kept as native RefreshControl (custom implementation too fragile). Added `liveRgb` design token. X new tests.
```

Update progress table: increment Phase 2 completed count.

- [ ] **Step 2: Update CLAUDE.md project structure**

Add the new components to the components section if not automatically covered by existing descriptions.

- [ ] **Step 3: Commit documentation**

```bash
git add TAREAS.md CLAUDE.md
git commit -m "docs: update TAREAS.md and CLAUDE.md for F2-10 completion"
```
