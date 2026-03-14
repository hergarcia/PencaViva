# F1-12: Join Group by Code — Design Spec

## Overview

Allow users to join an existing group by entering an 8-character invite code. The screen shows a single-screen layout with character-box input, auto-triggered group lookup, inline preview, and a Join confirmation button.

**Task**: F1-12 from TAREAS.md
**Depends on**: F0-07 (DB schema)
**Effort estimate**: 4h

## UX Decisions

| Decision        | Choice                                           | Rationale                                        |
| --------------- | ------------------------------------------------ | ------------------------------------------------ |
| Layout          | Single screen, inline preview                    | Simpler than bottom sheet, no navigation step    |
| Code input      | 8 individual character boxes                     | Visual clarity, auto-advance focus between boxes |
| Lookup trigger  | Auto-trigger on 8th character                    | Fixed-length code makes it unambiguous           |
| Error display   | Inline text below input                          | Lightweight, matches complete-profile pattern    |
| Preview content | Name, avatar, description, member count, scoring | Enough to confirm the right group                |

## Database Layer

### Migration 00009: Join Group RPCs

Two SECURITY DEFINER functions with `SET search_path = public`. SECURITY DEFINER is required because the calling user is not yet a group member, so normal RLS on the `groups` table (which restricts SELECT to members or public groups) would block the invite code lookup.

#### `lookup_group_by_invite_code(p_invite_code TEXT)`

Purpose: Return group preview info for any authenticated user with a valid invite code.

```sql
-- Returns: id, name, description, avatar_url, member_count, max_members, scoring_system
-- Auth: requires auth.uid() to be non-null
-- Errors: RAISE EXCEPTION 'group_not_found' when no group matches the code
-- Note: case-insensitive lookup (LOWER comparison)
```

Returns a single row with computed `member_count` (COUNT of active group_members).

#### `join_group_by_code(p_invite_code TEXT)`

Purpose: Atomically validate and insert a new group member.

```sql
-- Returns: id, name, invite_code (matches create_group_for_user shape)
-- Auth: requires auth.uid() to be non-null
-- Execution sequence:
--   1. SELECT ... FOR UPDATE on groups row (acquires row lock to prevent races)
--   2. Check group exists (else RAISE 'group_not_found')
--   3. Check user not already an active member (else RAISE 'already_member')
--   4. COUNT active members from group_members (within same transaction, after lock)
--   5. Compare count to max_members (else RAISE 'group_full')
--   6. INSERT into group_members (or UPDATE is_active=true for rejoining inactive members)
-- Returns: group id, name, invite_code
```

## Service Layer

### New types in `groups-service.ts`

```typescript
export interface GroupPreview {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  max_members: number;
  scoring_system: ScoringSystem;
}

// Reuse existing CreatedGroup type (identical shape: id, name, invite_code)
// No new JoinedGroup type needed
```

### New functions in `groups-service.ts`

```typescript
export async function lookupGroupByInviteCode(
  code: string,
): Promise<GroupPreview>;
// Validates code.length === 8 before calling RPC
// Calls supabase.rpc('lookup_group_by_invite_code', { p_invite_code: code.toUpperCase() })
// Throws on RPC error

export async function joinGroupByCode(code: string): Promise<CreatedGroup>;
// Validates code.length === 8 before calling RPC
// Calls supabase.rpc('join_group_by_code', { p_invite_code: code.toUpperCase() })
// Throws on RPC error
```

## UI Layer

### Screen: `app/(tabs)/groups/join.tsx`

Replaces the existing stub.

#### States

1. **Idle** — 8 character boxes (empty), no preview, no error
2. **Loading lookup** — 8 characters entered, spinner in preview area
3. **Preview** — Group card shown (avatar, name, description, member count, scoring chips), "Join Group" button enabled
4. **Error** — Inline red error text below code input. Errors:
   - `group_not_found` → "No group found with this code"
   - `group_full` → "This group is full"
   - `already_member` → "You're already a member of this group"
   - Network error → "Something went wrong. Please try again."
5. **Joining** — "Join Group" button shows loading indicator
6. **Success** — Navigate to group detail screen `/(tabs)/groups/[id]`

#### Code Input Behavior

- 8 `TextInput` refs with `maxLength={1}`
- Auto-advance: typing a character focuses the next box
- Backspace: clears current box and focuses previous
- Paste support: distributing a pasted 8-char string across all boxes
- Case-insensitive: all input uppercased on entry
- Valid characters: 0-9 and A-F (hex only, matching DB `md5(random())` generation). Non-hex characters are rejected on input.
- Auto-trigger: when all 8 boxes filled, call `lookupGroupByInviteCode`
- Clearing any box resets to idle state (hides preview/error)

#### Group Preview Card

- Avatar (image or letter fallback, same pattern as GroupCard)
- Group name (bold, white)
- Member count ("X / Y members")
- Description (if present, secondary text)
- Scoring chips (exact, result, goal diff points)

#### Navigation

- Back button returns to groups list
- On successful join, invalidate user groups query cache before navigating
- Navigate to group detail: `router.replace('/(tabs)/groups/[id]')`
- Deep link pre-fill (code passed via route params from QR scan / shared link) is deferred to F1-13

### Design Tokens

Uses existing `colors` from `@lib/constants` — `background`, `surface`, `surfaceBorder`, `primary`, `textPrimary`, `textSecondary`.

Error text color: `#FF4444` (standard red for dark backgrounds).

## Testing Plan

### SQL Integration Tests (`supabase/__tests__/db-functions/join-group.test.ts`)

- `lookup_group_by_invite_code`: returns correct group data, raises on invalid code
- `join_group_by_code`: successful join, already_member error, group_full error, reactivates inactive member
- Race condition: concurrent joins respect max_members (FOR UPDATE lock)

### Service Unit Tests (`src/__tests__/lib/groups-service.test.ts`)

- `lookupGroupByInviteCode`: calls RPC with uppercased code, returns typed GroupPreview, throws on error
- `joinGroupByCode`: calls RPC with uppercased code, returns CreatedGroup, throws on error

### Screen Tests (`src/__tests__/navigation/join-group.test.tsx`)

- Renders idle state with 8 empty input boxes
- Auto-advance focus between boxes on character entry
- Auto-triggers lookup when 8th character entered
- Shows loading spinner during lookup
- Shows group preview card on successful lookup
- Shows inline error on failed lookup (not found, full, already member)
- Join button triggers joinGroupByCode
- Shows loading on join button during join
- Navigates to group detail on successful join
- Clearing a character resets to idle
- Paste support fills all boxes

## Security Considerations

- **Code enumeration**: Any authenticated user can probe invite codes (16^8 = ~4.3B hex possibilities). Accepted risk for a social app at MVP scale. Rate limiting can be added at API gateway level later if needed.
- **SECURITY DEFINER scope**: Both RPCs bypass RLS intentionally — they only expose limited group info (preview) or perform a controlled insert (join). No DELETE/UPDATE exposure.
- **Rejoin handling**: Inactive members are reactivated rather than creating duplicate rows, maintaining the `(group_id, user_id)` primary key constraint.

## Files Changed

| File                                                 | Action                               |
| ---------------------------------------------------- | ------------------------------------ |
| `supabase/migrations/00009_join_group_rpcs.sql`      | Create (new migration)               |
| `supabase/__tests__/db-functions/join-group.test.ts` | Create (SQL integration tests)       |
| `src/lib/groups-service.ts`                          | Edit (add types + 2 functions)       |
| `src/__tests__/lib/groups-service.test.ts`           | Edit (add tests for new functions)   |
| `app/(tabs)/groups/join.tsx`                         | Edit (replace stub with full screen) |
| `src/__tests__/navigation/join-group.test.tsx`       | Create (screen tests)                |
