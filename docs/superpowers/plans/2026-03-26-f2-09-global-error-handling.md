# F2-09: Global Error Handling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add error boundaries, a toast notification system, automatic retry with exponential backoff, and a standardized `ErrorState` component to replace inconsistent inline error UIs across the app.

**Architecture:** Four new focused files: `retry.ts` (pure utility), `ErrorState.tsx` (presentational component), `Toast.tsx` (context provider + hook + animated UI), and `ErrorBoundary.tsx` (class component). Root layout wraps the app with ErrorBoundary + ToastProvider. All data-fetching hooks get `withRetry` for transient failures. Screens replace inline error UIs with `ErrorState` and add toast notifications for transient feedback.

**Tech Stack:** React Native, Reanimated v4, Expo Router (ErrorBoundary convention), Ionicons, existing design tokens from `src/lib/constants.ts`.

---

## File Structure

### New Files

| File                               | Responsibility                                                         |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/retry.ts`                 | `withRetry()` utility — exponential backoff, transient error detection |
| `src/components/ErrorState.tsx`    | Reusable full-screen error display with retry button                   |
| `src/components/Toast.tsx`         | `ToastProvider`, `useToast` hook, animated toast banner                |
| `src/components/ErrorBoundary.tsx` | Global error boundary class component                                  |

### Test Files

| File                                              | Tests                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/__tests__/lib/retry.test.ts`                 | withRetry: success, retry on transient, skip retry on 4xx/RLS, backoff timing |
| `src/__tests__/components/ErrorState.test.tsx`    | Renders message, icon, retry button, calls onRetry                            |
| `src/__tests__/components/Toast.test.tsx`         | ToastProvider + useToast: show/dismiss, types, auto-dismiss                   |
| `src/__tests__/components/ErrorBoundary.test.tsx` | Catches render error, shows recovery UI, resets                               |

### Modified Files

| File                                              | Changes                                                     |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `app/_layout.tsx`                                 | Wrap with ErrorBoundary + ToastProvider                     |
| `app/(tabs)/_layout.tsx`                          | Export Expo Router `ErrorBoundary`                          |
| `src/hooks/use-group-detail.ts`                   | Add `withRetry` around parallel fetches                     |
| `src/hooks/use-group-leaderboard.ts`              | Add `withRetry` around fetch                                |
| `src/hooks/use-group-matches.ts`                  | Add `withRetry` around fetch                                |
| `src/hooks/use-group-predictions.ts`              | Add `withRetry` around fetch                                |
| `src/hooks/use-match-detail.ts`                   | Add `withRetry` around fetch (not save)                     |
| `src/hooks/use-player-stats.ts`                   | Add `withRetry` around fetch                                |
| `src/hooks/use-active-group.ts`                   | Add `error` state + `withRetry`                             |
| `src/hooks/use-user-groups.ts`                    | Add `withRetry` around fetch                                |
| `app/(tabs)/predict.tsx`                          | Replace inline error with `ErrorState` + toast              |
| `app/(tabs)/ranking.tsx`                          | Replace inline error with `ErrorState` + toast              |
| `app/(tabs)/profile.tsx`                          | Replace inline error with `ErrorState` + toast on save      |
| `app/(tabs)/groups/index.tsx`                     | Replace inline error with `ErrorState` + toast              |
| `app/match/[id].tsx`                              | Replace full-screen error with `ErrorState` + toast on save |
| `app/groups/[id].tsx`                             | Replace inline error with `ErrorState`                      |
| `app/player-stats/[userId].tsx`                   | Replace inline error with `ErrorState` + toast              |
| `src/components/predictions/GroupPredictions.tsx` | Replace inline error with `ErrorState`                      |

---

## Task 1: Retry Utility

**Files:**

- Create: `src/lib/retry.ts`
- Test: `src/__tests__/lib/retry.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/lib/retry.test.ts`:

```typescript
import { withRetry, isTransientError } from "@lib/retry";

describe("withRetry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns result on first success", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient error and succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { baseDelay: 100 });

    // Advance past the first retry delay
    await jest.advanceTimersByTimeAsync(150);

    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after all retries exhausted", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("network error"));

    const promise = withRetry(fn, { maxRetries: 2, baseDelay: 100 });

    // Advance through both retry delays (100ms + 200ms)
    await jest.advanceTimersByTimeAsync(350);

    await expect(promise).rejects.toThrow("network error");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("does not retry on non-transient error", async () => {
    const fn = jest
      .fn()
      .mockRejectedValue(new Error("row-level security violation"));

    await expect(withRetry(fn)).rejects.toThrow("row-level security");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry when custom shouldRetry returns false", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("custom error"));

    await expect(withRetry(fn, { shouldRetry: () => false })).rejects.toThrow(
      "custom error",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("isTransientError", () => {
  it("returns false for RLS errors", () => {
    expect(isTransientError(new Error("row-level security"))).toBe(false);
  });

  it("returns false for validation errors", () => {
    expect(isTransientError(new Error("already_member"))).toBe(false);
    expect(isTransientError(new Error("group_not_found"))).toBe(false);
    expect(isTransientError(new Error("group_full"))).toBe(false);
  });

  it("returns true for network errors", () => {
    expect(isTransientError(new Error("network error"))).toBe(true);
    expect(isTransientError(new Error("Failed to fetch"))).toBe(true);
  });

  it("returns true for unknown errors", () => {
    expect(isTransientError(new Error("something unexpected"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/lib/retry.test.ts --no-coverage`

Expected: FAIL — `Cannot find module '@lib/retry'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/retry.ts`:

```typescript
// Non-transient error patterns — these should not be retried
const NON_TRANSIENT_PATTERNS = [
  "row-level security",
  "already_member",
  "group_not_found",
  "group_full",
  "invalid",
  "required",
  "not found",
  "unauthorized",
  "forbidden",
] as const;

export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const msg = error.message.toLowerCase();
  return !NON_TRANSIENT_PATTERNS.some((pattern) => msg.includes(pattern));
}

export type RetryOptions = {
  maxRetries?: number;
  baseDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const baseDelay = options?.baseDelay ?? 1000;
  const shouldRetry = options?.shouldRetry ?? isTransientError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      await delay(baseDelay * Math.pow(2, attempt));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw lastError;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/lib/retry.test.ts --no-coverage`

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/retry.ts src/__tests__/lib/retry.test.ts
git commit -m "feat(error-handling): add withRetry utility with exponential backoff (F2-09)"
```

---

## Task 2: ErrorState Component

**Files:**

- Create: `src/components/ErrorState.tsx`
- Test: `src/__tests__/components/ErrorState.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/ErrorState.test.tsx`:

```typescript
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ErrorState } from "@components/ErrorState";

describe("ErrorState", () => {
  it("renders error message", () => {
    const { getByText } = render(
      <ErrorState message="Something went wrong" />,
    );
    expect(getByText("Something went wrong")).toBeTruthy();
  });

  it("renders default icon", () => {
    const { getByTestId } = render(
      <ErrorState message="Error" />,
    );
    expect(getByTestId("error-state-icon")).toBeTruthy();
  });

  it("renders retry button when onRetry provided", () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <ErrorState message="Error" onRetry={onRetry} />,
    );
    const button = getByText("Try again");
    expect(button).toBeTruthy();
    fireEvent.press(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render retry button when onRetry is undefined", () => {
    const { queryByText } = render(
      <ErrorState message="Error" />,
    );
    expect(queryByText("Try again")).toBeNull();
  });

  it("renders custom title when provided", () => {
    const { getByText } = render(
      <ErrorState message="Details here" title="Custom Title" />,
    );
    expect(getByText("Custom Title")).toBeTruthy();
    expect(getByText("Details here")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/components/ErrorState.test.tsx --no-coverage`

Expected: FAIL — `Cannot find module '@components/ErrorState'`

- [ ] **Step 3: Write the implementation**

Create `src/components/ErrorState.tsx`:

```typescript
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";

type ErrorStateProps = {
  message: string;
  title?: string;
  onRetry?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
};

export function ErrorState({
  message,
  title = "Something went wrong",
  onRetry,
  icon = "alert-circle-outline",
}: ErrorStateProps) {
  return (
    <View
      testID="error-state"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
      }}
    >
      <Ionicons
        testID="error-state-icon"
        name={icon}
        size={48}
        color={colors.accent}
      />
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: "600",
          marginTop: 12,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 14,
          marginTop: 4,
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity
          testID="retry-button"
          onPress={onRetry}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 10,
            borderRadius: 20,
            marginTop: 16,
          }}
        >
          <Text style={{ color: colors.background, fontWeight: "600" }}>
            Try again
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/components/ErrorState.test.tsx --no-coverage`

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ErrorState.tsx src/__tests__/components/ErrorState.test.tsx
git commit -m "feat(error-handling): add reusable ErrorState component (F2-09)"
```

---

## Task 3: Toast Notification System

**Files:**

- Create: `src/components/Toast.tsx`
- Test: `src/__tests__/components/Toast.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/Toast.test.tsx`:

```typescript
import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";
import { View, Text, TouchableOpacity } from "react-native";
import { ToastProvider, useToast } from "@components/Toast";

function TestConsumer() {
  const { showToast } = useToast();
  return (
    <View>
      <TouchableOpacity
        testID="show-error"
        onPress={() => showToast("error", "Something failed")}
      />
      <TouchableOpacity
        testID="show-success"
        onPress={() => showToast("success", "Saved!")}
      />
      <TouchableOpacity
        testID="show-info"
        onPress={() => showToast("info", "FYI")}
      />
    </View>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows error toast with message", () => {
    const { getByTestId, getByText } = render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.press(getByTestId("show-error"));
    expect(getByText("Something failed")).toBeTruthy();
  });

  it("shows success toast with message", () => {
    const { getByTestId, getByText } = render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.press(getByTestId("show-success"));
    expect(getByText("Saved!")).toBeTruthy();
  });

  it("auto-dismisses after duration", () => {
    const { getByTestId, getByText, queryByText } = render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.press(getByTestId("show-error"));
    expect(getByText("Something failed")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3500);
    });

    expect(queryByText("Something failed")).toBeNull();
  });

  it("replaces current toast with new one", () => {
    const { getByTestId, queryByText, getByText } = render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.press(getByTestId("show-error"));
    expect(getByText("Something failed")).toBeTruthy();

    fireEvent.press(getByTestId("show-success"));
    expect(queryByText("Something failed")).toBeNull();
    expect(getByText("Saved!")).toBeTruthy();
  });

  it("throws when useToast is used outside provider", () => {
    function BadConsumer() {
      useToast();
      return null;
    }

    // Suppress console.error for expected error
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<BadConsumer />)).toThrow(
      "useToast must be used within a ToastProvider",
    );
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/components/Toast.test.tsx --no-coverage`

Expected: FAIL — `Cannot find module '@components/Toast'`

- [ ] **Step 3: Write the implementation**

Create `src/components/Toast.tsx`:

```typescript
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";

// ── Types ───────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";

type ToastData = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  showToast: (type: ToastType, message: string, duration?: number) => void;
};

// ── Config ──────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<
  ToastType,
  { borderColor: string; icon: React.ComponentProps<typeof Ionicons>["name"] }
> = {
  success: { borderColor: colors.primary, icon: "checkmark-circle" },
  error: { borderColor: colors.danger, icon: "alert-circle" },
  info: { borderColor: colors.secondary, icon: "information-circle" },
};

const DEFAULT_DURATION = 3000;
const ANIMATION_DURATION = 300;

// ── Context ─────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

// ── Toast UI ────────────────────────────────────────────────────────

function ToastBanner({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    opacity.value = withTiming(1, { duration: ANIMATION_DURATION });
    translateY.value = withTiming(0, { duration: ANIMATION_DURATION });
  }, [opacity, translateY]);

  // Store onDismiss in a ref so the timeout closure always has the latest
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    dismissTimerRef.current = setTimeout(() => {
      onDismissRef.current();
    }, DEFAULT_DURATION);

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [toast.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const config = TOAST_CONFIG[toast.type];

  return (
    <Animated.View
      testID="toast-banner"
      style={[
        {
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          right: 16,
          zIndex: 9999,
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderLeftWidth: 4,
          borderLeftColor: config.borderColor,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          // Shadow
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        },
        animatedStyle,
      ]}
    >
      <Ionicons
        name={config.icon}
        size={20}
        color={config.borderColor}
        style={{ marginRight: 10 }}
      />
      <Text
        numberOfLines={2}
        style={{
          color: colors.textPrimary,
          fontSize: 14,
          flex: 1,
        }}
      >
        {toast.message}
      </Text>
    </Animated.View>
  );
}

// ── Provider ────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      idRef.current += 1;
      setToast({ id: idRef.current, type, message });
    },
    [],
  );

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && <ToastBanner toast={toast} onDismiss={dismiss} />}
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/components/Toast.test.tsx --no-coverage`

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Toast.tsx src/__tests__/components/Toast.test.tsx
git commit -m "feat(error-handling): add toast notification system with Reanimated (F2-09)"
```

---

## Task 4: Error Boundary

**Files:**

- Create: `src/components/ErrorBoundary.tsx`
- Test: `src/__tests__/components/ErrorBoundary.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/ErrorBoundary.test.tsx`:

```typescript
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { GlobalErrorBoundary } from "@components/ErrorBoundary";

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("render crash");
  return <Text>Normal content</Text>;
}

describe("GlobalErrorBoundary", () => {
  // Suppress console.error for expected error boundary logs
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("renders children when no error", () => {
    const { getByText } = render(
      <GlobalErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </GlobalErrorBoundary>,
    );
    expect(getByText("Normal content")).toBeTruthy();
  });

  it("renders error UI when child throws", () => {
    const { getByText } = render(
      <GlobalErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </GlobalErrorBoundary>,
    );
    expect(getByText("Something went wrong")).toBeTruthy();
    expect(getByText("Restart")).toBeTruthy();
  });

  it("recovers when restart is pressed", () => {
    // Start with error, then set shouldThrow to false on re-render
    let shouldThrow = true;

    function DynamicChild() {
      if (shouldThrow) throw new Error("crash");
      return <Text>Recovered</Text>;
    }

    const { getByText } = render(
      <GlobalErrorBoundary>
        <DynamicChild />
      </GlobalErrorBoundary>,
    );

    expect(getByText("Restart")).toBeTruthy();

    // Fix the error before pressing restart
    shouldThrow = false;
    fireEvent.press(getByText("Restart"));

    expect(getByText("Recovered")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/components/ErrorBoundary.test.tsx --no-coverage`

Expected: FAIL — `Cannot find module '@components/ErrorBoundary'`

- [ ] **Step 3: Write the implementation**

Create `src/components/ErrorBoundary.tsx`:

```typescript
import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[GlobalErrorBoundary]", error, info.componentStack);
  }

  handleRestart = () => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View
          testID="global-error-boundary"
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
            paddingHorizontal: 32,
          }}
        >
          <Ionicons
            name="warning-outline"
            size={64}
            color={colors.accent}
          />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 20,
              fontWeight: "700",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              marginTop: 8,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            An unexpected error occurred. Please restart the app.
          </Text>
          <TouchableOpacity
            onPress={this.handleRestart}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 12,
              marginTop: 24,
            }}
          >
            <Text
              style={{
                color: colors.background,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              Restart
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/components/ErrorBoundary.test.tsx --no-coverage`

Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/__tests__/components/ErrorBoundary.test.tsx
git commit -m "feat(error-handling): add GlobalErrorBoundary component (F2-09)"
```

---

## Task 5: Wire Error Boundary + Toast into Root Layout

**Files:**

- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Update root layout**

Edit `app/_layout.tsx` to wrap with ErrorBoundary and ToastProvider:

```typescript
import "../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "@/lib/constants";
import { configureGoogleSignIn } from "@/lib/google-auth";
import { useAuthInit } from "@/hooks/use-auth";
import { GlobalErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";

SplashScreen.preventAutoHideAsync();
configureGoogleSignIn();

const stackContentStyle = { backgroundColor: colors.background };

export default function RootLayout() {
  useAuthInit();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GlobalErrorBoundary>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: stackContentStyle,
            }}
          />
        </ToastProvider>
      </SafeAreaProvider>
    </GlobalErrorBoundary>
  );
}
```

- [ ] **Step 2: Add Expo Router ErrorBoundary to tabs layout**

Edit `app/(tabs)/_layout.tsx` — add the following export at the end of the file, after the `TabsLayout` default export:

```typescript
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ... existing TabsLayout code stays the same ...

// Expo Router convention: catches render errors in tabs
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View
      testID="tabs-error-boundary"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        paddingHorizontal: 32,
      }}
    >
      <Ionicons name="alert-circle-outline" size={48} color={colors.accent} />
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: "600",
          marginTop: 12,
          textAlign: "center",
        }}
      >
        Something went wrong
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 14,
          marginTop: 4,
          textAlign: "center",
        }}
      >
        {error.message}
      </Text>
      <TouchableOpacity
        onPress={retry}
        style={{
          backgroundColor: colors.primary,
          paddingHorizontal: 24,
          paddingVertical: 10,
          borderRadius: 20,
          marginTop: 16,
        }}
      >
        <Text style={{ color: colors.background, fontWeight: "600" }}>
          Try again
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

Note: The `View`, `Text`, `TouchableOpacity` imports need to be added to the existing import from `react-native`. The `Ionicons` import is already present. The `colors` import is already present.

- [ ] **Step 3: Run lint + typecheck**

Run: `npm run lint && npm run typecheck`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx app/\(tabs\)/_layout.tsx
git commit -m "feat(error-handling): wire ErrorBoundary + Toast into root and tabs layouts (F2-09)"
```

---

## Task 6: Add withRetry to All Data-Fetching Hooks

**Files:**

- Modify: `src/hooks/use-group-detail.ts`
- Modify: `src/hooks/use-group-leaderboard.ts`
- Modify: `src/hooks/use-group-matches.ts`
- Modify: `src/hooks/use-group-predictions.ts`
- Modify: `src/hooks/use-match-detail.ts`
- Modify: `src/hooks/use-player-stats.ts`
- Modify: `src/hooks/use-active-group.ts`
- Modify: `src/hooks/use-user-groups.ts`

- [ ] **Step 1: Update use-group-detail.ts**

Add import at top:

```typescript
import { withRetry } from "@lib/retry";
```

Replace the try block contents (line 54):

```typescript
const [g, m, t] = await withRetry(() =>
  Promise.all([
    fetchGroupById(groupId),
    fetchGroupMembers(groupId),
    fetchGroupTournaments(groupId),
  ]),
);
```

- [ ] **Step 2: Update use-group-leaderboard.ts**

Add import at top:

```typescript
import { withRetry } from "@lib/retry";
```

Replace line 50:

```typescript
const data = await withRetry(() =>
  fetchGroupLeaderboardFiltered(groupId, filter),
);
```

- [ ] **Step 3: Update use-group-matches.ts**

Add import at top:

```typescript
import { withRetry } from "@lib/retry";
```

Replace the service call inside try block:

```typescript
const data = await withRetry(() => fetchGroupMatches(groupId, user.id));
```

- [ ] **Step 4: Update use-group-predictions.ts**

Add import at top:

```typescript
import { withRetry } from "@lib/retry";
```

Replace line 37:

```typescript
const data = await withRetry(() => fetchGroupPredictions(matchId, groupId));
```

- [ ] **Step 5: Update use-match-detail.ts (fetch only, not save)**

Add import at top:

```typescript
import { withRetry } from "@lib/retry";
```

Replace line 47:

```typescript
const result = await withRetry(() =>
  fetchMatchDetail(matchId, groupId, user.id),
);
```

- [ ] **Step 6: Update use-player-stats.ts**

Add import at top:

```typescript
import { withRetry } from "@lib/retry";
```

Replace line 47:

```typescript
const data = await withRetry(() => fetchPlayerGroupStats(userId, groupId));
```

- [ ] **Step 7: Update use-active-group.ts — add error state + withRetry**

Add import:

```typescript
import { withRetry } from "@lib/retry";
```

Add `error` to the state and return type:

```typescript
type UseActiveGroupResult = {
  activeGroupId: string | null;
  activeGroup: UserGroup | null;
  groups: UserGroup[];
  setActiveGroupId: (id: string) => void;
  isLoading: boolean;
  error: string | null;
};
```

Add state:

```typescript
const [error, setError] = useState<string | null>(null);
```

Replace the try/catch in loadGroups:

```typescript
setIsLoading(true);
setError(null);
try {
  const data = await withRetry(() => fetchUserGroups(user.id));
  setGroups(data);

  // Auto-select first group if none active
  if (!activeGroupIdRef.current && data.length > 0) {
    setStoreGroupId(data[0].id);
  }
} catch (err: unknown) {
  setError(err instanceof Error ? err.message : "Failed to load groups");
} finally {
  setIsLoading(false);
}
```

Add `error` to the return:

```typescript
return {
  activeGroupId,
  activeGroup,
  groups,
  setActiveGroupId: setStoreGroupId,
  isLoading,
  error,
};
```

- [ ] **Step 8: Update use-user-groups.ts**

Add import at top:

```typescript
import { withRetry } from "@lib/retry";
```

Replace the service call:

```typescript
const data = await withRetry(() => fetchUserGroups(user.id));
```

- [ ] **Step 9: Run all tests**

Run: `npm run test:ci`

Expected: All existing tests PASS (withRetry is transparent — retries only on failure)

- [ ] **Step 10: Commit**

```bash
git add src/hooks/use-group-detail.ts src/hooks/use-group-leaderboard.ts src/hooks/use-group-matches.ts src/hooks/use-group-predictions.ts src/hooks/use-match-detail.ts src/hooks/use-player-stats.ts src/hooks/use-active-group.ts src/hooks/use-user-groups.ts
git commit -m "feat(error-handling): add withRetry to all data-fetching hooks (F2-09)"
```

---

## Task 7: Replace Inline Error UIs with ErrorState

**Files:**

- Modify: `app/(tabs)/predict.tsx`
- Modify: `app/(tabs)/ranking.tsx`
- Modify: `app/(tabs)/profile.tsx`
- Modify: `app/(tabs)/groups/index.tsx`
- Modify: `app/match/[id].tsx`
- Modify: `app/groups/[id].tsx`
- Modify: `app/player-stats/[userId].tsx`
- Modify: `src/components/predictions/GroupPredictions.tsx`

For each screen below, add the import at the top:

```typescript
import { ErrorState } from "@components/ErrorState";
```

- [ ] **Step 1: Update predict.tsx**

Replace the full error View block (the `error ? ( <View ... /> )` branch) with:

```typescript
) : error ? (
  <ErrorState message={error} onRetry={refetch} />
) : (
```

- [ ] **Step 2: Update ranking.tsx**

Replace the full error View block with:

```typescript
) : error ? (
  <ErrorState message={error} onRetry={refetch} />
) : entries.length === 0 ? (
```

- [ ] **Step 3: Update profile.tsx**

Replace the `if (fetchError)` return block with:

```typescript
  if (fetchError) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        testID="profile-screen"
      >
        <ErrorState message={fetchError} onRetry={fetchProfile} />
      </SafeAreaView>
    );
  }
```

- [ ] **Step 4: Update groups/index.tsx**

Replace the `if (fetchError)` return block with:

```typescript
  if (fetchError) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        testID="groups-screen"
      >
        <View style={{ padding: 24 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 28,
              fontWeight: "bold",
            }}
          >
            My Groups
          </Text>
        </View>
        <ErrorState message={fetchError} onRetry={refetch} />
      </SafeAreaView>
    );
  }
```

- [ ] **Step 5: Update match/[id].tsx**

Replace the full-screen error block (`if (error || !match)` section, the inner View with Ionicons + Text + TouchableOpacity) with:

```typescript
  if (error || !match) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header onBack={() => router.back()} />
        <ErrorState
          message={error ?? "Match not found"}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }
```

- [ ] **Step 6: Update groups/[id].tsx**

Replace the error return block with:

```typescript
  if (error || !group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ErrorState
          message={error ?? "Group not found."}
          onRetry={() => router.back()}
          title={error ? "Something went wrong" : "Group not found"}
        />
      </SafeAreaView>
    );
  }
```

Note: For group detail, the "retry" action navigates back since the group may not exist. The `onRetry` label says "Try again" which is acceptable for both retry and back navigation.

- [ ] **Step 7: Update player-stats/[userId].tsx**

Replace the error View block with:

```typescript
) : error ? (
  <ErrorState message={error} onRetry={refetch} />
) : (
```

- [ ] **Step 8: Update GroupPredictions.tsx**

Replace the error return block with:

```typescript
  if (error) {
    return (
      <View style={{ marginTop: 28, alignItems: "center", flex: 1 }}>
        <ErrorState message={error} onRetry={refetch} />
      </View>
    );
  }
```

- [ ] **Step 9: Run lint + typecheck + tests**

Run: `npm run lint && npm run typecheck && npm run test:ci`

Expected: All PASS

- [ ] **Step 10: Commit**

```bash
git add app/\(tabs\)/predict.tsx app/\(tabs\)/ranking.tsx app/\(tabs\)/profile.tsx app/\(tabs\)/groups/index.tsx app/match/\[id\].tsx app/groups/\[id\].tsx app/player-stats/\[userId\].tsx src/components/predictions/GroupPredictions.tsx
git commit -m "refactor(error-handling): replace inline error UIs with ErrorState component (F2-09)"
```

---

## Task 8: Add Toast Notifications to Screens

**Files:**

- Modify: `app/(tabs)/predict.tsx`
- Modify: `app/(tabs)/ranking.tsx`
- Modify: `app/(tabs)/profile.tsx`
- Modify: `app/(tabs)/groups/index.tsx`
- Modify: `app/match/[id].tsx`
- Modify: `app/player-stats/[userId].tsx`

For each screen below, add the import:

```typescript
import { useToast } from "@components/Toast";
```

And add the hook call at the top of the component:

```typescript
const { showToast } = useToast();
```

- [ ] **Step 1: Add error toast to predict.tsx**

Add a `useEffect` that watches `error` from `useGroupMatches`:

```typescript
useEffect(() => {
  if (error) showToast("error", error);
}, [error, showToast]);
```

- [ ] **Step 2: Add error toast to ranking.tsx**

Add a `useEffect` that watches `error` from `useGroupLeaderboard`:

```typescript
useEffect(() => {
  if (error) showToast("error", error);
}, [error, showToast]);
```

- [ ] **Step 3: Add toasts to profile.tsx**

Add error toast for fetchError:

```typescript
useEffect(() => {
  if (fetchError) showToast("error", fetchError);
}, [fetchError, showToast]);
```

Replace the `Alert.alert` in the save catch block with:

```typescript
  } catch {
    showToast("error", copy.saveErrorBody);
  }
```

Add success toast after successful save (inside the save try block, after the `setIsEditing(false)` call):

```typescript
showToast("success", "Profile saved");
```

- [ ] **Step 4: Add error toast to groups/index.tsx**

Add a `useEffect` that watches `fetchError`:

```typescript
useEffect(() => {
  if (fetchError) showToast("error", fetchError);
}, [fetchError, showToast]);
```

- [ ] **Step 5: Add toasts to match/[id].tsx**

Add error toast for fetch error:

```typescript
useEffect(() => {
  if (error) showToast("error", error);
}, [error, showToast]);
```

Add success toast after successful prediction save. Find the save handler where `save(home, away)` is called and it returns `true`:

```typescript
const success = await save(homeScore, awayScore);
if (success) {
  showToast("success", "Prediction saved!");
}
```

Note: The `saveError` is already handled inline with the auto-dismiss banner — keep that for RLS errors. Add a toast only for the generic save error case if desired, but since `saveError` is already shown inline, the fetch error toast is sufficient.

- [ ] **Step 6: Add error toast to player-stats/[userId].tsx**

Add a `useEffect` that watches `error`:

```typescript
useEffect(() => {
  if (error) showToast("error", error);
}, [error, showToast]);
```

- [ ] **Step 7: Run lint + typecheck + tests**

Run: `npm run lint && npm run typecheck && npm run test:ci`

Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add app/\(tabs\)/predict.tsx app/\(tabs\)/ranking.tsx app/\(tabs\)/profile.tsx app/\(tabs\)/groups/index.tsx app/match/\[id\].tsx app/player-stats/\[userId\].tsx
git commit -m "feat(error-handling): add toast notifications to all screens (F2-09)"
```

---

## Task 9: Pre-commit CI Checks + Doc Updates

**Files:**

- Modify: `TAREAS.md` — mark F2-09 as `[x]`
- Modify: `CLAUDE.md` — update components section to list ErrorState, Toast, ErrorBoundary, and retry utility

- [ ] **Step 1: Run full pre-commit checks**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:ci`

Expected: All PASS. If format fails, run `npm run format` first.

- [ ] **Step 2: Update TAREAS.md**

Change `- [ ] **F2-09**` to `- [x] **F2-09**`

- [ ] **Step 3: Update CLAUDE.md**

In the Project Structure section, add under `src/components/`:

```
│   ├── common/         # EmptyState
│   ├── ErrorState.tsx   # Reusable inline error display (icon + message + retry)
│   ├── ErrorBoundary.tsx # Global error boundary class component
│   ├── Toast.tsx        # ToastProvider + useToast hook + animated banner
```

In the Architecture Decisions section, add:

```
- **Error handling**: Two-layer error boundaries (global + Expo Router tabs), toast notifications via custom Reanimated banner (no external lib), `withRetry` utility with exponential backoff for all data-fetching hooks, standardized `ErrorState` component replacing inline error UIs
```

Update the hooks list to mention `withRetry` integration.

- [ ] **Step 4: Commit doc updates**

```bash
git add TAREAS.md CLAUDE.md
git commit -m "docs: update TAREAS.md and CLAUDE.md for F2-09 completion"
```
