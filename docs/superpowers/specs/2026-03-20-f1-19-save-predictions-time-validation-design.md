# F1-19: Save Predictions with Time Validation — Design Spec

**Date:** 2026-03-20
**Task:** F1-19
**Effort estimate:** 4h
**Status:** Approved

---

## Overview

F1-18 built the prediction input UI (ScoreStepper, SaveConfirmation, `use-match-detail` hook with basic save, `prediction-service.ts` with UPSERT). F1-19 adds:

1. **True optimistic UI with rollback** — prediction state updates before the save completes; rolls back on failure
2. **Client-side kickoff-time lock** — dual check: `status === "scheduled"` AND `!isExpired` (countdown-based)
3. **Live countdown to kickoff** — "Locks in 2h 34m" displayed while the match is still open
4. **Graceful RLS error handling** — when post-kickoff save is blocked, show friendly message and auto-transition to read-only view

Server-side enforcement (RLS in migration 00003) already blocks `INSERT`/`UPDATE` when `kickoff_time <= now()`. No new migration is needed.

---

## Architecture

### Files changed

| File                            | Change                                                                     |
| ------------------------------- | -------------------------------------------------------------------------- |
| `src/hooks/use-countdown.ts`    | **New** — pure timer hook                                                  |
| `src/hooks/use-match-detail.ts` | Add optimistic save, rollback, `isLockedByServer` flag                     |
| `app/match/[id].tsx`            | Compose countdown, update `isEditable`, show countdown UI, auto-transition |
| `src/lib/prediction-service.ts` | No change                                                                  |
| `src/lib/mock/fixtures.ts`      | Add `scheduledExpired` fixture variant                                     |

---

## `use-countdown` Hook

**File:** `src/hooks/use-countdown.ts`

```typescript
useCountdown(targetDate: string | Date | null): {
  secondsRemaining: number  // 0 when expired
  isExpired: boolean        // true when now >= targetDate
  formatted: string         // "2h 34m" | "4m 23s" | "42s" | "" when expired
}
```

### Internals

- **Tick strategy:** Each interval tick recomputes `secondsRemaining` from `Date.now()` and `targetDate` (rather than decrementing a counter). This avoids drift over long sessions and ensures accuracy after the app is foregrounded from background.
- **Initial state:** Computed synchronously before the first interval fires (no off-by-one on mount).
- **Interval:** `setInterval(1000)`, cleared on unmount via `useEffect` cleanup. Also cleared and restarted when `targetDate` changes (include `targetDate` in the `useEffect` dependency array).
- **Null input:** Returns `{ secondsRemaining: 0, isExpired: true, formatted: "" }` immediately.

### `formatted` rules (inclusive bounds)

| Condition                       | Example output |
| ------------------------------- | -------------- |
| `secondsRemaining >= 3600`      | `"2h 34m"`     |
| `60 <= secondsRemaining < 3600` | `"4m 23s"`     |
| `1 <= secondsRemaining < 60`    | `"42s"`        |
| `secondsRemaining === 0`        | `""`           |

At exactly 3600s → `"1h 0m"` (not `"60m 0s"`).

---

## `use-match-detail` Changes

### New state

```typescript
const [isLockedByServer, setIsLockedByServer] = useState(false);
```

`isLockedByServer` resets to `false` at the **start of every `loadData()` call** (including refetch). This ensures a background refetch (e.g., after RLS error) can recover to an editable state if the match was postponed or clock skew resolves.

### Optimistic save with rollback

```typescript
const save = useCallback(
  async (home: number, away: number): Promise<boolean> => {
    if (!user?.id || !matchId || !groupId) return false;

    const previousPrediction = prediction; // capture for rollback

    // Optimistic update — show result immediately
    setPrediction({
      id: "optimistic",
      home_score_pred: home,
      away_score_pred: away,
    });
    setIsSaving(true);
    setSaveError(null);

    try {
      await savePrediction(matchId, groupId, user.id, home, away);
      // Background refetch to replace fake optimistic ID with the real DB row
      refetch();
      return true;
    } catch (err: unknown) {
      // Rollback
      setPrediction(previousPrediction);
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (isRLSError(msg)) {
        setSaveError("Predictions are locked — the match has already started.");
        setIsLockedByServer(true);
        refetch(); // background refetch to sync match status
      } else {
        setSaveError(msg);
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  },
  [matchId, groupId, user?.id, prediction, refetch],
);
```

### RLS error detection

`savePrediction` wraps Supabase errors as `new Error(error.message)`, stripping the Postgres error code. Detection matches on the substring present in all RLS violation messages:

```typescript
function isRLSError(message: string): boolean {
  return message.toLowerCase().includes("row-level security");
}
```

This substring appears in Postgres error messages for code `42501` (e.g., `"new row violates row-level security policy for table \"predictions\""`). It will not fire on unrelated errors (network, unique constraint, etc.).

### Updated return type

```typescript
return {
  match,
  prediction,
  isLoading,
  error,
  refetch,
  save,
  isSaving,
  saveError,
  isLockedByServer, // new
};
```

---

## Screen Changes (`app/match/[id].tsx`)

### `isEditable` — no `activeGroupId` here

`activeGroupId` remains as the **outer render gate** (the entire prediction section is hidden when no group is active — existing behavior, no change). `isEditable` only controls _within_ that section:

```typescript
const { isExpired, formatted: countdownFormatted } = useCountdown(
  match?.kickoff_time ?? null,
);
const isEditable =
  match?.status === "scheduled" && !isExpired && !isLockedByServer;
```

This preserves the existing `activeGroupId &&` outer wrapper on line 241 of `[id].tsx`.

### Countdown display

Shown between the "Your Prediction" heading and the stepper card, when `isEditable && countdownFormatted !== ""`:

```
Locks in 2h 34m   ← amber (#FFB800), fontSize 13, textAlign center
```

When `countdownFormatted` becomes `""` (expired), this line disappears and the form simultaneously locks via `isExpired`.

### Auto-transition on RLS error (Option C)

When `isLockedByServer` becomes `true`:

- `isEditable` flips to `false` → read-only view renders immediately
- `saveError` message is displayed inline in the read-only section
- A `setTimeout(3000)` in the screen clears `saveError` after 3 seconds (the timeout is cleared on unmount via `useEffect` cleanup to prevent state updates on unmounted components)
- `saveError` is rendered in the **read-only branch** of the prediction section (not only in the editable branch) so the message is visible after auto-transition
- The rolled-back prediction (or null) is shown in the read-only view

---

## Mock System

Add a fixture to `src/lib/mock/fixtures.ts`:

```typescript
// A match that is still "scheduled" status but kickoff time is in the past
// Represents the DB sync lag edge case (sync hasn't updated status yet)
MOCK_MATCH_IDS.scheduledExpired = "<uuid>";
// kickoff_time: new Date(Date.now() - 5 * 60 * 1000).toISOString() — 5 minutes ago
// status: "scheduled"
```

This fixture tests the client-side lock path where `status === "scheduled"` but `isExpired === true` — a real edge case when the match-sync cron hasn't run yet.

---

## Error Handling Summary

| Scenario                                         | Behavior                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Save succeeds                                    | Optimistic state shown, background refetch replaces fake ID, `SaveConfirmation` overlay shown                           |
| Save fails — network/other error                 | Rollback + inline error text below save button                                                                          |
| Save fails — RLS (post-kickoff)                  | Rollback + `"Predictions are locked — the match has already started."` + auto-transition to read-only + clears after 3s |
| `isExpired` becomes `true` (countdown hits zero) | Form locks client-side immediately, no server call                                                                      |
| `isLockedByServer` after refetch completes       | Resets to `false` if match is still scheduled (e.g., postponed)                                                         |

---

## Testing Plan

### `use-countdown` (unit)

- Returns correct `secondsRemaining` and `formatted` for future date (>1h, 1m–1h, <1m)
- `isExpired` is `true` immediately when `targetDate` is in the past
- `formatted` returns `""` when expired
- At exactly 3600s → `"1h 0m"` (not `"60m 0s"`)
- Returns expired state when `targetDate` is null
- **Interval cleanup on unmount:** Spy on `global.clearInterval` and assert called on unmount (using Jest fake timers)
- **`targetDate` change:** When `targetDate` prop changes, old interval is cleared and new one starts (no leaked intervals)

### `use-match-detail` (unit)

- Optimistic update: `prediction` state changes before `savePrediction` resolves
- Rollback: prediction restored to previous value on save failure
- `isLockedByServer` set to `true` on RLS error, `false` on other errors
- `isLockedByServer` resets to `false` at start of `loadData()` / `refetch()`
- `refetch()` called automatically on both save success (background ID sync) and RLS error
- `saveError` set to friendly message on RLS error, raw message otherwise

### `app/match/[id].tsx` (integration)

- `isEditable` is `false` when `isExpired` is `true` (even if status is "scheduled")
- `isEditable` is `false` when `isLockedByServer` is `true`
- Countdown label visible when `isEditable && formatted !== ""`
- Countdown label hidden when `formatted === ""`
- Auto-transition to read-only when `isLockedByServer` becomes `true`
- `saveError` clears after 3s timeout (use fake timers)
- Timeout cleared on unmount (no state update after unmount)

### Mock system

- `scheduledExpired` fixture: match with `status === "scheduled"` and past `kickoff_time`
- Verify `useCountdown` with this fixture returns `isExpired: true`
