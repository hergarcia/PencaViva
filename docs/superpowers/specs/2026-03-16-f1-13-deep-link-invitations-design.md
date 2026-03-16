# F1-13: Deep Link for Invitations

**Date:** 2026-03-16
**Task:** F1-13
**Status:** Approved

## Overview

Enable `pencaviva://join/<code>` deep links to open the join screen with the invite code pre-filled. Works for both authenticated users (hot path) and unauthenticated users (cold start — code is persisted through the auth flow).

## Scope

- Custom scheme only (`pencaviva://`) — no universal links for MVP
- No "redirect to store if not installed" — deferred until `pencaviva.app` is live
- Pre-fill code in join screen; user taps "Join Group" to trigger lookup (no auto-lookup)

## Architecture

Three pieces:

1. **`app/join/[code].tsx`** — Deep link landing route. Expo Router maps `pencaviva://join/ABC12345` here via the existing `scheme: "pencaviva"` in `app.config.ts`. Checks auth state and either forwards directly to the join screen or saves the code to SecureStore and routes through auth.

2. **`src/lib/pending-invite.ts`** — Thin module wrapping the existing storage helpers for reading, writing, and clearing a pending invite code. Requires `deleteStorageItem` to be added to `src/lib/storage.ts`.

3. **`app/index.tsx` (modified)** — After the existing 4-way redirect resolves to authenticated + profile complete, adds a 5th check: if a pending invite code exists, clear it and redirect to `/(tabs)/groups/join?code=<code>` instead of `/(tabs)`.

## Data Flow

### Cold start (unauthenticated)

```
pencaviva://join/ABC12345
  → app/join/[code].tsx
  → validate code (8 hex chars)
  → save to SecureStore
  → redirect to /(auth)/welcome or /(auth)/login (based on onboarding state)
  → user completes onboarding + auth + profile
  → app/index.tsx finds pending code in SecureStore
  → clear pending code
  → redirect to /(tabs)/groups/join?code=ABC12345
  → join screen pre-fills 8 boxes
  → user taps "Join Group"
```

### Hot path (already authenticated + profile complete)

```
pencaviva://join/ABC12345
  → app/join/[code].tsx
  → validate code
  → redirect directly to /(tabs)/groups/join?code=ABC12345
  → join screen pre-fills 8 boxes
  → user taps "Join Group"
```

## Component Details

### `src/lib/pending-invite.ts`

```ts
savePendingInviteCode(code: string): Promise<void>
getPendingInviteCode(): Promise<string | null>
clearPendingInviteCode(): Promise<void>
```

Uses `setStorageItem` / `getStorageItem` / `deleteStorageItem` from `src/lib/storage.ts`. Storage key: `"pending_invite_code"`. `deleteStorageItem` must be added to `src/lib/storage.ts` following the existing platform-safe pattern: `localStorage.removeItem(key)` on web, `SecureStore.deleteItemAsync(key)` on native.

### `app/join/[code].tsx`

- Reads `code` from `useLocalSearchParams<{ code: string }>()`
- Validates: exactly 8 chars, all hex (`/^[0-9a-fA-F]{8}$/`)
- Reads `isInitialized`, `session`, `user` from `useAuthStore`; reads onboarding completion from SecureStore (async)
- Maintains a `isReady` boolean state (false until both `isInitialized` is true AND the onboarding SecureStore read resolves)
- Renders a loading spinner while `!isReady` — gates on both async reads, not just auth init
- Decision tree (only evaluated once `isReady` is true):
  - Invalid code → `router.replace('/(tabs)/groups/join')` (empty join screen)
  - Auth'd + profile complete → `router.replace('/(tabs)/groups/join?code=<code>')`
  - Auth'd + profile incomplete → `savePendingInviteCode(code)` → `router.replace('/')` (index.tsx routes to complete-profile; after completion, complete-profile.tsx must navigate to `/` not `/(tabs)` so index.tsx re-runs and picks up the pending code)
  - Not authenticated → `savePendingInviteCode(code)` → `router.replace('/')` (index.tsx routes to welcome or login)
  - **Always use `router.replace('/')` for the "save and defer" path** — never redirect directly to auth screens; let `app/index.tsx` decide the destination based on full state
- Profile incomplete note: `app/(auth)/complete-profile.tsx` currently navigates to `/(tabs)` on completion. This must be changed to `router.replace('/')` so `app/index.tsx` runs again and processes the pending invite code.

### `app/index.tsx` (modified)

Add a new state variable `pendingInviteCode: string | null` (initialized to `null`). The pending invite check is integrated into the existing profile-completion `useEffect`: after the `checkProfileComplete` promise resolves with `complete = true`, also `await getPendingInviteCode()` and store it in a local variable, then call `setPendingInviteCode(localCode)` and `setIsProfileChecked(true)` together (React 18 batches these in async callbacks, so no extra render).

Add a new `useEffect` with dependency array `[isProfileChecked, isProfileComplete, pendingInviteCode]` that fires the final redirect:

```ts
useEffect(() => {
  if (!isProfileChecked || !isProfileComplete) return;
  if (pendingInviteCode) {
    clearPendingInviteCode().then(() => {
      router.replace(`/(tabs)/groups/join?code=${pendingInviteCode}`);
    });
  } else {
    router.replace("/(tabs)");
  }
}, [isProfileChecked, isProfileComplete, pendingInviteCode]);
```

Remove the `<Redirect href="/(tabs)" />` JSX branch — replace with `null` (the effect handles navigation). All other redirect branches (`/(auth)/welcome`, `/(auth)/login`, `/(auth)/complete-profile`) remain as `<Redirect>` components unchanged.

### `app/(tabs)/groups/join.tsx` (modified)

- Add `useLocalSearchParams<{ code?: string }>()`
- `useEffect` on mount (dependency: `[code]`): if `code` param is present and valid (8 hex chars), call `updateDigits(code.toUpperCase().split(''))` to pre-fill both `digits` state and `digitsRef.current` (the existing `updateDigits` helper handles both)
- Pre-filling via `updateDigits` does **not** trigger `handleChangeText`, so the auto-lookup (`triggerLookup`) that fires inside `handleChangeText` is NOT called — pre-fill is display-only
- User sees 8 filled boxes and taps "Join Group" to trigger `triggerLookup` (which shows the preview card), then taps the second "Join Group" button in the preview to call `handleJoin`

## Error Handling & Edge Cases

| Case                                               | Behavior                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| Invalid code in deep link (wrong length / non-hex) | Redirect to empty join screen — no error shown                             |
| Group no longer exists                             | Existing "No group found with this code" error in join screen              |
| User already a member                              | Existing "You're already a member" error in join screen                    |
| App killed mid-auth                                | SecureStore persists — code survives, picked up on next cold start         |
| Multiple deep links tapped                         | Last write wins — `savePendingInviteCode` overwrites existing pending code |

## Testing Plan

| Test                                                                        | File                                                                 |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `savePendingInviteCode` / `getPendingInviteCode` / `clearPendingInviteCode` | `src/__tests__/lib/pending-invite.test.ts`                           |
| `app/join/[code].tsx` — auth'd path, unauth'd path, invalid code            | `src/__tests__/navigation/deep-link.test.tsx`                        |
| `app/index.tsx` — pending invite branch redirects to join screen            | `src/__tests__/navigation/index-redirect.test.tsx` (extend existing) |
| `join.tsx` — pre-fills digits from `code` param on mount                    | `src/__tests__/navigation/join-group.test.tsx` (extend existing)     |

No SQL integration tests needed — no new DB logic.

## Files Changed

| File                                               | Change                                                   |
| -------------------------------------------------- | -------------------------------------------------------- |
| `src/lib/storage.ts`                               | Modified — add `deleteStorageItem(key)` helper           |
| `src/lib/pending-invite.ts`                        | New                                                      |
| `app/join/[code].tsx`                              | New                                                      |
| `app/index.tsx`                                    | Modified — pending invite check after profile resolution |
| `app/(tabs)/groups/join.tsx`                       | Modified — pre-fill from `code` param                    |
| `src/__tests__/lib/pending-invite.test.ts`         | New                                                      |
| `src/__tests__/navigation/deep-link.test.tsx`      | New                                                      |
| `app/(auth)/complete-profile.tsx`                  | Modified — navigate to `/` instead of `/(tabs)` on save  |
| `src/__tests__/navigation/index-redirect.test.tsx` | Extended                                                 |
| `src/__tests__/navigation/join-group.test.tsx`     | Extended                                                 |
