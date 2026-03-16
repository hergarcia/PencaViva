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

2. **`src/lib/pending-invite.ts`** — Thin module wrapping the existing `getStorageItem`/`setStorageItem` storage helpers for reading, writing, and clearing a pending invite code.

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

Uses `setStorageItem` / `getStorageItem` from `src/lib/storage.ts`. Storage key: `"pending_invite_code"`.

### `app/join/[code].tsx`

- Reads `code` from `useLocalSearchParams<{ code: string }>()`
- Validates: exactly 8 chars, all hex (`/^[0-9a-fA-F]{8}$/`)
- Reads `isInitialized`, `session`, `user` from `useAuthStore`; reads onboarding from SecureStore
- Renders a loading spinner while resolving state (no content flash)
- Decision tree:
  - Invalid code → `router.replace('/(tabs)/groups/join')` (empty join screen)
  - Auth'd + profile complete → `router.replace('/(tabs)/groups/join?code=<code>')`
  - Otherwise → `savePendingInviteCode(code)` → redirect through normal auth flow

### `app/index.tsx` (modified)

After `isProfileComplete` resolves to `true`, check `getPendingInviteCode()`:

- Found → clear it + `router.replace('/(tabs)/groups/join?code=<code>')`
- Not found → existing `router.replace('/(tabs)')` behavior

The profile completion check already waits for `user?.id` — the pending invite check runs inside that resolved state, so no new loading states are needed.

### `app/(tabs)/groups/join.tsx` (modified)

- Add `useLocalSearchParams<{ code?: string }>()`
- `useEffect` on mount: if `code` param is present and valid (8 hex chars), pre-fill `digits` state and `digitsRef` from the param chars
- No auto-lookup — user sees the pre-filled code and taps the existing "Join Group" button to trigger lookup + join

## Error Handling & Edge Cases

| Case                                               | Behavior                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| Invalid code in deep link (wrong length / non-hex) | Redirect to empty join screen — no error shown                             |
| Group no longer exists                             | Existing "No group found with this code" error in join screen              |
| User already a member                              | Existing "You're already a member" error in join screen                    |
| App killed mid-auth                                | SecureStore persists — code survives, picked up on next cold start         |
| Multiple deep links tapped                         | Last write wins — `savePendingInviteCode` overwrites existing pending code |

## Testing Plan

| Test                                                                        | File                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `savePendingInviteCode` / `getPendingInviteCode` / `clearPendingInviteCode` | `src/__tests__/lib/pending-invite.test.ts`                          |
| `app/join/[code].tsx` — auth'd path, unauth'd path, invalid code            | `src/__tests__/navigation/deep-link.test.tsx`                       |
| `app/index.tsx` — pending invite branch redirects to join screen            | `src/__tests__/navigation/index.test.tsx` (extend existing)         |
| `join.tsx` — pre-fills digits from `code` param on mount                    | `src/__tests__/navigation/group-screens.test.tsx` (extend existing) |

No SQL integration tests needed — no new DB logic.

## Files Changed

| File                                              | Change                                                   |
| ------------------------------------------------- | -------------------------------------------------------- |
| `src/lib/pending-invite.ts`                       | New                                                      |
| `app/join/[code].tsx`                             | New                                                      |
| `app/index.tsx`                                   | Modified — pending invite check after profile resolution |
| `app/(tabs)/groups/join.tsx`                      | Modified — pre-fill from `code` param                    |
| `src/__tests__/lib/pending-invite.test.ts`        | New                                                      |
| `src/__tests__/navigation/deep-link.test.tsx`     | New                                                      |
| `src/__tests__/navigation/index.test.tsx`         | Extended                                                 |
| `src/__tests__/navigation/group-screens.test.tsx` | Extended                                                 |
