# F2-09: Global Error Handling — Design Spec

**Date:** 2026-03-26
**Task:** F2-09 — Global error handling
**Scope:** Error boundaries, toast notification system, retry logic, standardized error states

---

## 1. Problem Statement

The app currently has no centralized error handling. Each screen implements its own inline error UI with inconsistent styling and behavior. There are no error boundaries to catch render crashes, no toast/snackbar system for transient feedback, and no automatic retry logic for network failures. This results in:

- White screens on unhandled render errors
- Inconsistent error presentation across screens
- Transient network failures shown as persistent errors
- Duplicated error UI code across ~6 screens

## 2. Design

### 2.1 Error Boundary Layers

Two layers of error boundaries provide defense-in-depth:

**Global Error Boundary (`src/components/ErrorBoundary.tsx`):**

- Class component wrapping the root `Stack` in `app/_layout.tsx`
- Catches any unhandled render error in the component tree
- Renders a full-screen "Something went wrong" recovery UI with a "Restart" button
- "Restart" calls `ErrorBoundary.resetErrorBoundary()` to re-render the tree
- Logs error + componentStack to `console.error` (Sentry integration deferred to Phase 4+)

**Tabs Error Boundary (`app/(tabs)/_layout.tsx`):**

- Uses Expo Router's `ErrorBoundary` export convention
- Catches crashes within individual tabs without killing the whole app
- Shows a recovery UI with "Try Again" button that re-renders the tab
- More granular recovery — user stays in the app, only the broken tab resets

### 2.2 Toast Notification System

**Architecture:**

- `ToastProvider` context wrapping the app in `app/_layout.tsx` (inside ErrorBoundary, outside Stack)
- `useToast()` hook exposes `showToast(type, message, duration?)` to any component
- Single file: `src/components/Toast.tsx` exports `ToastProvider`, `useToast`, and internal `Toast` component

**Toast Types:**
| Type | Color | Icon | Use Case |
|------|-------|------|----------|
| `success` | `#00D4AA` (primary) | `checkmark-circle` | Save confirmed, action completed |
| `error` | `#FF4757` (danger) | `alert-circle` | Network failure, save failed |
| `info` | `#7C5CFC` (secondary) | `information-circle` | Informational messages |

**Behavior:**

- Position: top of screen, below status bar / safe area
- Animation: slide down from top + fade in (Reanimated `withTiming`, 300ms)
- Auto-dismiss: 3 seconds default (configurable via `duration` param)
- Swipe-to-dismiss: swipe up gesture dismisses early
- Queue: only one toast at a time — new toast replaces current (with exit animation first)
- Z-index: renders above all content via portal-like positioning in provider

**Styling:**

- Dark semi-transparent background with colored left border (4px)
- Icon + message text in a single row
- Rounded corners, consistent with app's surface styling (`#1A1A2E` base)
- Text: 14px, white, single line with ellipsis for overflow

### 2.3 Retry Utility

**`src/lib/retry.ts` — `withRetry(fn, options?)` utility:**

```typescript
type RetryOptions = {
  maxRetries?: number; // default: 2
  baseDelay?: number; // default: 1000ms
  shouldRetry?: (error: unknown) => boolean;
};

function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
```

**Behavior:**

- Retries up to `maxRetries` times with exponential backoff (1s, 2s by default)
- Default `shouldRetry` skips retry for:
  - RLS errors (detected via existing `isRLSError()` pattern)
  - HTTP 4xx client errors (bad request, unauthorized, forbidden, not found)
  - Validation errors (message contains "invalid", "required", "already_member", etc.)
- Only retries on: network errors, timeouts, HTTP 5xx, unknown errors
- Returns result on first success; throws final error after all retries exhausted

### 2.4 Reusable ErrorState Component

**`src/components/ErrorState.tsx`:**

```typescript
type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  icon?: string; // Ionicons name, default: "alert-circle-outline"
};
```

- Centered layout matching `EmptyState` component pattern
- Icon (48px, muted color) + message text + optional "Try Again" button
- "Try Again" button styled consistently with existing retry buttons
- Replaces inline error UIs across all screens

### 2.5 Hook Integration

**Pattern for all data-fetching hooks:**

```typescript
// Before (current pattern):
const data = await someService();

// After:
const data = await withRetry(() => someService());
```

**Hooks to update:**
| Hook | Changes |
|------|---------|
| `use-group-detail.ts` | Wrap `fetchGroupDetail` with `withRetry` |
| `use-group-leaderboard.ts` | Wrap `fetchGroupLeaderboardFiltered` with `withRetry` |
| `use-group-matches.ts` | Wrap `fetchGroupMatches` with `withRetry` |
| `use-group-predictions.ts` | Wrap service calls with `withRetry` |
| `use-match-detail.ts` | Wrap fetch with `withRetry`; save already has RLS-aware handling, keep as-is |
| `use-player-stats.ts` | Wrap `fetchPlayerGroupStats` with `withRetry` |
| `use-active-group.ts` | Add `error` state (currently silent-fail); wrap with `withRetry` |
| `use-user-groups.ts` | Wrap `fetchUserGroups` with `withRetry` |

**Toast integration in hooks:**

- On final failure (after retries exhausted), show an error toast in addition to setting error state
- Toast provides transient feedback; ErrorState provides persistent recovery UI
- Hooks that need toast access will accept an optional `showToast` parameter or use a module-level approach

**Decision on toast in hooks:** Since hooks can't use `useToast()` internally without coupling, the pattern is:

- Hooks return `error` state as today
- **Screens** are responsible for showing toasts when `error` changes (via `useEffect` watching error)
- This keeps hooks pure and testable

### 2.6 Screen Updates

Replace inline error UIs with `ErrorState` in:

- `app/(tabs)/predict.tsx` — replace custom error View
- `app/(tabs)/ranking.tsx` — add error state (if missing)
- `app/(tabs)/profile.tsx` — replace inline error text
- `app/(tabs)/groups/index.tsx` — add error state (if missing)
- `app/match/[id].tsx` — replace full-screen error View
- `app/groups/[id].tsx` — replace inline error display
- `src/components/predictions/GroupPredictions.tsx` — replace inline error text
- `app/player-stats/[userId].tsx` — replace inline error display

**Toast usage in screens:**

- Screens use `useToast()` + `useEffect` on `error` to show transient error toasts
- Save operations (predictions, profile) show success toast on completion
- Network retry exhaustion shows error toast

## 3. Files

### New Files

| File                               | Purpose                                          |
| ---------------------------------- | ------------------------------------------------ |
| `src/components/ErrorBoundary.tsx` | Global error boundary class component            |
| `src/components/Toast.tsx`         | ToastProvider, useToast hook, Toast UI component |
| `src/components/ErrorState.tsx`    | Reusable inline error display                    |
| `src/lib/retry.ts`                 | `withRetry` utility with exponential backoff     |

### Modified Files

| File                                              | Changes                                       |
| ------------------------------------------------- | --------------------------------------------- |
| `app/_layout.tsx`                                 | Wrap with ErrorBoundary + ToastProvider       |
| `app/(tabs)/_layout.tsx`                          | Export Expo Router ErrorBoundary              |
| `app/(tabs)/predict.tsx`                          | Use ErrorState, add toast on error            |
| `app/(tabs)/ranking.tsx`                          | Use ErrorState if needed                      |
| `app/(tabs)/profile.tsx`                          | Use ErrorState, toast on save success/failure |
| `app/(tabs)/groups/index.tsx`                     | Use ErrorState if needed                      |
| `app/match/[id].tsx`                              | Use ErrorState, toast on save success/error   |
| `app/groups/[id].tsx`                             | Use ErrorState                                |
| `app/player-stats/[userId].tsx`                   | Use ErrorState                                |
| `src/components/predictions/GroupPredictions.tsx` | Use ErrorState                                |
| `src/hooks/use-group-detail.ts`                   | Add withRetry                                 |
| `src/hooks/use-group-leaderboard.ts`              | Add withRetry                                 |
| `src/hooks/use-group-matches.ts`                  | Add withRetry                                 |
| `src/hooks/use-group-predictions.ts`              | Add withRetry                                 |
| `src/hooks/use-match-detail.ts`                   | Add withRetry (fetch only)                    |
| `src/hooks/use-player-stats.ts`                   | Add withRetry                                 |
| `src/hooks/use-active-group.ts`                   | Add error state + withRetry                   |
| `src/hooks/use-user-groups.ts`                    | Add withRetry                                 |

### Test Files

| File                                              | Purpose                     |
| ------------------------------------------------- | --------------------------- |
| `src/__tests__/lib/retry.test.ts`                 | withRetry unit tests        |
| `src/__tests__/components/ErrorState.test.tsx`    | ErrorState render tests     |
| `src/__tests__/components/Toast.test.tsx`         | Toast provider + hook tests |
| `src/__tests__/components/ErrorBoundary.test.tsx` | Error boundary tests        |

## 4. Out of Scope

- Sentry integration (Phase 4+)
- Offline mode / network status detection
- Per-field form validation (exists where needed already)
- Modifying the auth error flow (already well-handled in Zustand store)
