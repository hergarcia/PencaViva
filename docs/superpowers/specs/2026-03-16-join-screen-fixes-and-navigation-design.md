# Join Screen Fixes & Navigation Architecture

**Date:** 2026-03-16
**Status:** Approved

## Overview

Three bugs found during testing of F1-13 (deep link invitations), plus a global navigation architecture decision that affects all current and future screens.

## Issues Being Fixed

### Bug 1 — Pre-fill does not trigger lookup

When arriving via deep link (`pencaviva://join/ABC12345`), the join screen pre-fills all 8 code boxes but never triggers `triggerLookup`. The user sees 8 filled boxes and nothing happens — no group preview, no error. They have to delete a character and retype it to trigger the search.

**Root cause:** The pre-fill `useEffect` in `join.tsx` calls `updateDigits(code.split(""))` but not `triggerLookup`. The auto-lookup only fires inside `handleChangeText`, which the pre-fill bypasses.

**Fix:** After calling `updateDigits` in the pre-fill effect, also call `triggerLookup(codeParam.toUpperCase())`.

### Bug 2 — Join screen is visually sparse (resolved by Bug 1 fix + layout improvement)

When no preview is shown, the screen shows 8 boxes and nothing else — no explanation, no feedback. The fix for Bug 1 makes the error state appear automatically after pre-fill. Additionally, add:

- A subtitle below the header: `"Enter the 8-character code shared by your group"`
- A contextual empty/error state below the code boxes when `state === "error"`: an icon (🔍) and helper text `"Ask your admin for the correct invite code"` — shown instead of (or alongside) the existing error message
- A paste tip at the bottom when idle: `"Tip: you can paste the full code at once"`

### Bug 3 — Back navigation from deep link goes to wrong tab

When arriving via `pencaviva://join/ABC12345`, the landing route `app/join/[code].tsx` calls `router.replace("/(tabs)/groups/join?code=...")`. The `replace` wipes navigation history, so pressing back has no destination and Expo Router falls back to the Inicio tab.

**Fix:** Change `router.replace` to `router.push` in `app/join/[code].tsx` for the authenticated + profile complete path. `router.push` keeps history so back returns correctly to the groups list.

## Global Navigation Architecture Decision

### Rule

**The 5-tab bar is the app's home base.** Any screen that is not itself a tab root must render above the tab bar with no tabs visible. The back arrow always returns to the screen that launched it.

### Current problem

`join.tsx`, `create.tsx`, and `[id].tsx` live inside `app/(tabs)/groups/`. Because they are inside the tabs navigator, the tab bar remains visible while on these screens and the back arrow navigates within the tab's internal stack. This is wrong.

### Correct structure

Screens that should render above the tab bar live in `app/groups/` (root level), not `app/(tabs)/groups/`. The root `_layout.tsx` already provides a root `<Stack>` that renders above the tab bar. `app/match/[id].tsx` already follows this pattern correctly.

### File moves

| Current path                    | New path                | Reason                  |
| ------------------------------- | ----------------------- | ----------------------- |
| `app/(tabs)/groups/join.tsx`    | `app/groups/join.tsx`   | Action screen — no tabs |
| `app/(tabs)/groups/create.tsx`  | `app/groups/create.tsx` | Action screen — no tabs |
| `app/(tabs)/groups/[id].tsx`    | `app/groups/[id].tsx`   | Detail screen — no tabs |
| `app/(tabs)/groups/_layout.tsx` | deleted                 | No longer needed        |

`app/(tabs)/groups/index.tsx` stays where it is — it IS the Groups tab root, tab bar should be visible.

### Navigation call updates

All `router.push` / `router.replace` calls that reference `/(tabs)/groups/join`, `/(tabs)/groups/create`, or `/(tabs)/groups/[id]` must be updated to the new root paths `/groups/join`, `/groups/create`, `/groups/[id]`.

Files that contain these calls:

- `app/(tabs)/groups/index.tsx` — links to join, create, and [id]
- `app/(tabs)/groups/join.tsx` → `app/groups/join.tsx` — `handleJoin` navigates to `/(tabs)/groups/${result.id}` after a successful join; must become `/groups/${result.id}`
- `app/(tabs)/groups/create.tsx` → `app/groups/create.tsx` — navigates to `/(tabs)/groups/${created.id}` after group creation; must become `/groups/${created.id}`
- `app/join/[code].tsx` — links to `/(tabs)/groups/join?code=...` (also changes replace → push)
- `app/index.tsx` — links to `/(tabs)/groups/join?code=...` in the pending invite redirect

### Forward-looking rule

All new screens added to the app follow this same pattern:

- **Tab root screens** → `app/(tabs)/<name>.tsx` (tab bar visible)
- **All other screens** → `app/<feature>/<name>.tsx` at root level (no tab bar, back arrow to previous screen)

This applies to all future features across all tabs (predict, ranking, profile, etc.).

## Component Details

### `app/groups/join.tsx` (moved from `app/(tabs)/groups/join.tsx`)

Identical to current implementation with these additions:

1. **Subtitle** — below the header row, above the "INVITE CODE" label:

   ```tsx
   <Text
     style={{
       color: colors.textSecondary,
       fontSize: 13,
       paddingHorizontal: 24,
       marginBottom: 8,
     }}
   >
     Enter the 8-character code shared by your group
   </Text>
   ```

2. **Auto-lookup on pre-fill** — in the existing `useEffect`:

   ```ts
   useEffect(() => {
     if (!codeParam || !/^[0-9a-fA-F]{8}$/.test(codeParam)) return;
     updateDigits(codeParam.toUpperCase().split(""));
     triggerLookup(codeParam.toUpperCase()); // ADD THIS
   }, [codeParam, updateDigits, triggerLookup]);
   ```

3. **Contextual error state** — when `state === "error"`, below the existing error message text, show:

   ```tsx
   <View style={{ alignItems: "center", marginTop: 24, paddingHorizontal: 24 }}>
     <Text style={{ fontSize: 28, marginBottom: 8 }}>🔍</Text>
     <Text
       style={{
         color: colors.textSecondary,
         fontSize: 13,
         textAlign: "center",
       }}
     >
       Ask your admin for the correct invite code
     </Text>
   </View>
   ```

4. **Paste tip** — at the bottom of the screen, visible when `state === "idle"`:
   ```tsx
   <Text
     style={{
       color: colors.textSecondary,
       fontSize: 11,
       textAlign: "center",
       marginTop: 16,
       opacity: 0.6,
     }}
   >
     Tip: you can paste the full code at once
   </Text>
   ```

### `app/join/[code].tsx` (modified)

Change the authenticated + profile complete redirect from:

```ts
router.replace(`/(tabs)/groups/join?code=${code}`);
```

to:

```ts
router.push(`/groups/join?code=${code}`);
```

Also update the invalid code fallback from:

```ts
router.replace("/(tabs)/groups/join");
```

to:

```ts
router.replace("/groups/join");
```

### `app/index.tsx` (modified)

Update the pending invite redirect from:

```ts
router.replace(`/(tabs)/groups/join?code=${pendingInviteCode}`);
```

to:

```ts
router.replace(`/groups/join?code=${pendingInviteCode}`);
```

### `app/(tabs)/groups/index.tsx` (modified)

Update all navigation calls from `/(tabs)/groups/<screen>` to `/groups/<screen>`.

## Error Handling & Edge Cases

| Case                                       | Behavior                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Deep link with valid code, group exists    | `router.push` → join screen, auto-lookup fires, preview shows                                   |
| Deep link with valid code, group not found | `router.push` → join screen, auto-lookup fires, error + 🔍 empty state shows                    |
| Deep link with invalid code                | `router.replace("/groups/join")` → empty join screen                                            |
| Back from join/create/detail               | Returns to Groups tab list (index), tab bar reappears                                           |
| Pending invite redirect from index.tsx     | `router.replace("/groups/join?code=...")` — replace is correct here (coming from root redirect) |

## Testing Plan

| Test                                             | File                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| Pre-fill triggers lookup on mount                | `src/__tests__/navigation/join-group.test.tsx` (extend)               |
| Pre-fill with nonexistent code shows error state | `src/__tests__/navigation/join-group.test.tsx` (extend)               |
| Paste tip visible in idle state                  | `src/__tests__/navigation/join-group.test.tsx` (extend)               |
| Deep link uses router.push for auth'd path       | `src/__tests__/navigation/deep-link.test.tsx` (update)                |
| Deep link invalid code uses /groups/join path    | `src/__tests__/navigation/deep-link.test.tsx` (update)                |
| index.tsx pending invite uses /groups/join path  | `src/__tests__/navigation/index-redirect.test.tsx` (update)           |
| groups/index navigation calls use new paths      | `src/__tests__/navigation/groups-screen.test.tsx` (update)            |
| Import paths updated after file moves            | `src/__tests__/navigation/group-screens.test.tsx` (update)            |
| Import path updated after join move              | `src/__tests__/navigation/join-group.test.tsx` (update import path)   |
| Import path updated after create move            | `src/__tests__/navigation/create-group.test.tsx` (update import path) |

No SQL changes needed.

## Files Changed

| File                                               | Change                                                                                                                                                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/(tabs)/groups/join.tsx`                       | Moved to `app/groups/join.tsx` + subtitle + auto-lookup on pre-fill + error empty state + paste tip + update internal nav call (`/(tabs)/groups/${id}` → `/groups/${id}`)                                   |
| `app/(tabs)/groups/create.tsx`                     | Moved to `app/groups/create.tsx` + update internal nav call (`/(tabs)/groups/${id}` → `/groups/${id}`)                                                                                                      |
| `app/(tabs)/groups/[id].tsx`                       | Moved to `app/groups/[id].tsx`                                                                                                                                                                              |
| `app/(tabs)/groups/_layout.tsx`                    | Deleted — contains only a passthrough `<Stack headerShown={false}>` with no custom options; safe to remove                                                                                                  |
| `app/(tabs)/groups/index.tsx`                      | Updated nav calls to `/groups/<screen>`                                                                                                                                                                     |
| `app/join/[code].tsx`                              | replace → push for auth'd path; update paths to `/groups/join`                                                                                                                                              |
| `app/index.tsx`                                    | Update pending invite path to `/groups/join`                                                                                                                                                                |
| `src/__tests__/navigation/join-group.test.tsx`     | Update import path + update existing `/(tabs)/groups/g-1` assertion to `/groups/g-1` + delete the "does not auto-trigger lookup when pre-filling" test (inverted by Bug 1 fix) + extend with new test cases |
| `src/__tests__/navigation/deep-link.test.tsx`      | Update path assertions                                                                                                                                                                                      |
| `src/__tests__/navigation/index-redirect.test.tsx` | Update path assertions                                                                                                                                                                                      |
| `src/__tests__/navigation/groups-screen.test.tsx`  | Update 5 path assertions to `/groups/<screen>`                                                                                                                                                              |
| `src/__tests__/navigation/group-screens.test.tsx`  | Update import paths to new file locations                                                                                                                                                                   |
| `src/__tests__/navigation/create-group.test.tsx`   | Update import path to new file location + update `/(tabs)/groups/g-1` assertion to `/groups/g-1`                                                                                                            |
