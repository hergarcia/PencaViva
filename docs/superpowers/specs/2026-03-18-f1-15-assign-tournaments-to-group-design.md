# F1-15: Assign Tournaments to Group — Design Spec

## Summary

Allow group admins to add or remove tournament associations from an existing group via a dedicated manage-tournaments screen. Non-admin members see tournaments read-only (existing behavior).

## Context

- `group_tournaments` table already exists with composite PK `(group_id, tournament_id)` and `added_at` timestamp
- RLS policies already enforce: members can SELECT, admins can INSERT/DELETE
- `fetchActiveTournaments()` and `fetchGroupTournaments()` already exist in groups-service
- Create group screen already has a working tournament chip picker pattern
- Group detail screen (Info tab) already displays assigned tournaments read-only

## Approach: Dedicated Screen with Diff-Based Save

### Why not inline edit mode?

The group detail screen is already 448 lines. Adding inline edit state, tournament fetching, and save logic would bloat it further. A separate screen:

- Follows the navigation pattern (non-tab screens at `app/<feature>/`)
- Is independently testable
- Keeps the detail screen focused on display

### Why not an RPC?

RLS already handles authorization for INSERT/DELETE on `group_tournaments`. Direct Supabase client operations are simpler and sufficient. No SECURITY DEFINER function needed.

## Architecture

### Service Layer (`src/lib/groups-service.ts`)

New function:

```typescript
async function updateGroupTournaments(
  groupId: string,
  newTournamentIds: string[],
): Promise<void>;
```

**Logic:**

1. Fetch current tournament IDs via `fetchGroupTournaments(groupId)`
2. Compute diff: `toAdd = new - current`, `toRemove = current - new`
3. If no changes, return early
4. Execute DELETE for `toRemove` and INSERT for `toAdd` (parallel)
5. RLS enforces admin-only access; non-admins get a Supabase error

### Hook (`src/hooks/use-group-detail.ts`)

Add a `refetch()` function to the return value. When called, re-runs the `Promise.all` fetch. The manage-tournaments screen calls this after successful save (via route params or callback).

**Simpler approach:** Use a `refreshKey` counter state. The manage-tournaments screen navigates back with a param, and the detail screen increments the key to trigger refetch.

### Screen (`app/groups/manage-tournaments.tsx`)

**Route params:** `groupId` (required)

**Behavior:**

1. On mount, fetch `fetchActiveTournaments()` and `fetchGroupTournaments(groupId)` in parallel
2. Pre-select currently assigned tournament IDs
3. Display all active tournaments as toggleable chips (same pattern as create screen)
4. Save button calls `updateGroupTournaments(groupId, selectedIds)`
5. On success, navigate back (router.back())
6. On error, show Alert

**States:** loading, error, empty (no active tournaments), ready

### Group Detail Screen Changes (`app/groups/[id].tsx`)

- Add "Manage" button next to "Tournaments" heading, visible only when `group.role === 'admin'`
- Button navigates to `/groups/manage-tournaments?groupId=${id}`
- Add `refetch` from useGroupDetail; trigger on focus (useIsFocused or useFocusEffect) to pick up changes when returning from manage screen

## Data Flow

```
[Group Detail Info Tab]
    |
    | Admin taps "Manage"
    v
[Manage Tournaments Screen]
    |
    | Loads active tournaments + current assignments
    | User toggles chips
    | Taps Save
    v
[updateGroupTournaments()]
    |
    | Diffs current vs new
    | DELETE removed, INSERT added
    v
[router.back()]
    |
    | useFocusEffect triggers refetch
    v
[Group Detail shows updated tournaments]
```

## UI Design

### Manage Tournaments Screen

- ScreenHeader with "Manage Tournaments" title
- Section: toggleable tournament chips (reuse create screen pattern)
- Sticky bottom: Save button (primary green) — disabled when no changes or saving
- Loading state: ActivityIndicator centered
- Empty state: "No active tournaments available." text

### Group Detail Changes

- "Tournaments" heading gets a row layout with "Manage" text button on the right (admin only)
- Manage button: primary color text, no background

## Testing Strategy

### Service Tests

- `updateGroupTournaments`: mock fetchGroupTournaments + supabase insert/delete
- Test: adds new tournaments (insert called, delete not called)
- Test: removes tournaments (delete called, insert not called)
- Test: mixed add/remove
- Test: no changes = no operations
- Test: error propagation

### Hook Tests

- `useGroupDetail` refetch: verify data updates after refetch call

### Screen Tests

- Manage tournaments screen: loading state, empty state, chip rendering, toggle behavior, save flow, error handling
- Group detail: manage button visible for admin, hidden for non-admin

## Files Changed

| File                                                   | Change                                    |
| ------------------------------------------------------ | ----------------------------------------- |
| `src/lib/groups-service.ts`                            | Add `updateGroupTournaments()`            |
| `src/hooks/use-group-detail.ts`                        | Add `refetch()` to return value           |
| `app/groups/manage-tournaments.tsx`                    | New screen                                |
| `app/groups/[id].tsx`                                  | Add admin "Manage" button + focus refetch |
| `src/__tests__/lib/groups-service.test.ts`             | Tests for updateGroupTournaments          |
| `src/__tests__/hooks/use-group-detail.test.ts`         | Tests for refetch                         |
| `src/__tests__/navigation/manage-tournaments.test.tsx` | Screen tests                              |
| `src/__tests__/navigation/group-screens.test.tsx`      | Test manage button visibility             |

## No Migration Needed

All DB infrastructure (table, RLS policies, indexes) already exists. Direct client INSERT/DELETE on `group_tournaments` is sufficient.
