# F1-12: Join Group by Code — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authenticated users to join a group by entering an 8-character hex invite code, with group preview before confirming.

**Architecture:** Two SECURITY DEFINER RPCs (lookup + join) bypass RLS for non-members. Service layer wraps RPCs with validation. Single-screen UI with character-box input auto-triggers lookup, shows inline preview, then joins on confirmation.

**Tech Stack:** PostgreSQL (RPCs), TypeScript, React Native, Expo Router, Supabase JS SDK, Jest + RNTL

**Spec:** `docs/superpowers/specs/2026-03-14-f1-12-join-group-by-code-design.md`

---

## File Structure

| File                                                 | Action | Responsibility                                             |
| ---------------------------------------------------- | ------ | ---------------------------------------------------------- |
| `supabase/migrations/00009_join_group_rpcs.sql`      | Create | Two SECURITY DEFINER RPCs for lookup and join              |
| `supabase/__tests__/db-functions/join-group.test.ts` | Create | SQL integration tests for both RPCs                        |
| `src/lib/groups-service.ts`                          | Edit   | Add `GroupPreview` type + 2 service functions              |
| `src/__tests__/lib/groups-service.test.ts`           | Edit   | Add tests for `lookupGroupByInviteCode`, `joinGroupByCode` |
| `app/(tabs)/groups/join.tsx`                         | Edit   | Replace stub with full join screen                         |
| `src/__tests__/navigation/join-group.test.tsx`       | Create | Screen tests for all UI states                             |

---

## Chunk 1: Database RPCs + Integration Tests

### Task 1: Write the SQL migration and integration tests together

**Files:**

- Create: `supabase/migrations/00009_join_group_rpcs.sql`
- Create: `supabase/__tests__/db-functions/join-group.test.ts`

> **Note on TDD for SQL:** Integration tests require the migration to be applied to the local DB before they can run. We write both the migration and tests in the same task, apply the migration, then run the tests. This is the pragmatic TDD approach for database code.

- [ ] **Step 1: Create the migration file with both RPCs**

```sql
-- Migration 009: Join group RPC functions
-- Two SECURITY DEFINER RPCs for looking up and joining groups by invite code.
-- SECURITY DEFINER is required because the calling user is not yet a group member,
-- so normal RLS on the groups table would block the invite code lookup.

-- =============================================
-- LOOKUP GROUP BY INVITE CODE
-- Returns group preview info for any authenticated user with a valid invite code.
-- =============================================
CREATE OR REPLACE FUNCTION public.lookup_group_by_invite_code(
  p_invite_code TEXT
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  avatar_url TEXT,
  member_count BIGINT,
  max_members INTEGER,
  scoring_system JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_group_id UUID;
BEGIN
  -- Auth check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find group by invite code (case-insensitive)
  SELECT g.id INTO v_group_id
  FROM groups g
  WHERE LOWER(g.invite_code) = LOWER(p_invite_code);

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'group_not_found';
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.description,
    g.avatar_url,
    (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.is_active = true),
    g.max_members,
    g.scoring_system
  FROM groups g
  WHERE g.id = v_group_id;
END;
$$;

-- =============================================
-- JOIN GROUP BY CODE
-- Atomically validates and inserts a new group member.
-- Uses FOR UPDATE to prevent race conditions on max_members check.
-- =============================================
CREATE OR REPLACE FUNCTION public.join_group_by_code(
  p_invite_code TEXT
)
RETURNS TABLE(id UUID, name TEXT, invite_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_group_id UUID;
  v_group_name TEXT;
  v_invite_code TEXT;
  v_max_members INTEGER;
  v_current_count BIGINT;
  v_existing_active BOOLEAN;
  v_existing_inactive BOOLEAN;
BEGIN
  -- Auth check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the group row to prevent race conditions
  SELECT g.id, g.name, g.invite_code, g.max_members
  INTO v_group_id, v_group_name, v_invite_code, v_max_members
  FROM groups g
  WHERE LOWER(g.invite_code) = LOWER(p_invite_code)
  FOR UPDATE;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'group_not_found';
  END IF;

  -- Check if user is already an active member
  SELECT EXISTS(
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = v_group_id AND gm.user_id = v_user_id AND gm.is_active = true
  ) INTO v_existing_active;

  IF v_existing_active THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  -- Check if user is an inactive member (can rejoin)
  SELECT EXISTS(
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = v_group_id AND gm.user_id = v_user_id AND gm.is_active = false
  ) INTO v_existing_inactive;

  -- Count active members (within locked transaction)
  SELECT COUNT(*) INTO v_current_count
  FROM group_members gm
  WHERE gm.group_id = v_group_id AND gm.is_active = true;

  IF v_current_count >= v_max_members THEN
    RAISE EXCEPTION 'group_full';
  END IF;

  -- Insert or reactivate
  IF v_existing_inactive THEN
    UPDATE group_members gm
    SET is_active = true, role = 'member', joined_at = now()
    WHERE gm.group_id = v_group_id AND gm.user_id = v_user_id;
  ELSE
    INSERT INTO group_members (group_id, user_id, role, is_active)
    VALUES (v_group_id, v_user_id, 'member', true);
  END IF;

  RETURN QUERY SELECT v_group_id, v_group_name, v_invite_code;
END;
$$;
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db reset` (or `npx supabase migration up` if local Supabase is running)
Expected: Migration applies without errors.

- [ ] **Step 3: Write integration tests for both RPCs**

Create `supabase/__tests__/db-functions/join-group.test.ts`. See Task 2 and Task 3 below for the complete test content.

- [ ] **Step 4: Apply migration and run tests**

Run: `npx supabase db reset` (or `npx supabase migration up` if local Supabase is running)
Then: `npm run test:supabase:local -- --testPathPattern=join-group`
Expected: All 9 tests PASS.

- [ ] **Step 5: Commit migration + tests together**

```bash
git add supabase/migrations/00009_join_group_rpcs.sql supabase/__tests__/db-functions/join-group.test.ts
git commit -m "feat(db): add lookup and join group by invite code RPCs with tests"
```

---

### Task 2: Test content — lookup_group_by_invite_code

**Files:**

- Create: `supabase/__tests__/db-functions/join-group.test.ts`

- [ ] **Step 1: Write the test file with lookup tests**

```typescript
import { pool, isSupabaseAvailable, closePool } from "../setup";
import {
  withTransaction,
  createTestUser,
  createTestGroup,
  setAuthContext,
  addGroupMember,
} from "../helpers";

afterAll(closePool);

const describeFn = isSupabaseAvailable ? describe : describe.skip;

describeFn("lookup_group_by_invite_code", () => {
  it("returns group preview for valid invite code", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client, { displayName: "Admin" });
      const searcher = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id, {
        name: "Test Group",
      });

      // Get the invite code that was created
      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );
      const inviteCode = codeResult.rows[0].invite_code;

      // Call as the searching user (not a member)
      await setAuthContext(client, searcher.id);
      const result = await client.query(
        `SELECT * FROM lookup_group_by_invite_code($1)`,
        [inviteCode],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(groupId);
      expect(result.rows[0].name).toBe("Test Group");
      expect(Number(result.rows[0].member_count)).toBe(1); // admin only
      expect(result.rows[0].max_members).toBe(50);
      expect(result.rows[0].scoring_system).toBeDefined();
    });
  });

  it("is case-insensitive for invite code", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client);
      const searcher = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id);

      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );
      const inviteCode = codeResult.rows[0].invite_code;

      await setAuthContext(client, searcher.id);
      const result = await client.query(
        `SELECT * FROM lookup_group_by_invite_code($1)`,
        [inviteCode.toUpperCase()],
      );
      expect(result.rows).toHaveLength(1);
    });
  });

  it("raises group_not_found for invalid code", async () => {
    await withTransaction(pool!, async (client) => {
      const user = await createTestUser(client);
      await setAuthContext(client, user.id);

      await expect(
        client.query(`SELECT * FROM lookup_group_by_invite_code($1)`, [
          "ZZZZZZZZ",
        ]),
      ).rejects.toThrow("group_not_found");
    });
  });

  it("returns correct member count with multiple members", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client);
      const member1 = await createTestUser(client);
      const member2 = await createTestUser(client);
      const searcher = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id);
      await addGroupMember(client, groupId, member1.id);
      await addGroupMember(client, groupId, member2.id);

      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );

      await setAuthContext(client, searcher.id);
      const result = await client.query(
        `SELECT * FROM lookup_group_by_invite_code($1)`,
        [codeResult.rows[0].invite_code],
      );
      expect(Number(result.rows[0].member_count)).toBe(3);
    });
  });
});
```

---

### Task 3: Test content — join_group_by_code

**Files:**

- Modify: `supabase/__tests__/db-functions/join-group.test.ts`

- [ ] **Step 1: Add join_group_by_code tests to the same file**

Append the following `describeFn` block after the `lookup_group_by_invite_code` block:

```typescript
describeFn("join_group_by_code", () => {
  it("successfully joins a group as member", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client);
      const joiner = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id, {
        name: "Join Me",
      });

      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );
      const inviteCode = codeResult.rows[0].invite_code;

      await setAuthContext(client, joiner.id);
      const result = await client.query(
        `SELECT * FROM join_group_by_code($1)`,
        [inviteCode],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(groupId);
      expect(result.rows[0].name).toBe("Join Me");

      // Verify membership was created
      const memberResult = await client.query(
        `SELECT role, is_active FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, joiner.id],
      );
      expect(memberResult.rows[0].role).toBe("member");
      expect(memberResult.rows[0].is_active).toBe(true);
    });
  });

  it("raises already_member for active member", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client);
      const member = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id);
      await addGroupMember(client, groupId, member.id);

      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );

      await setAuthContext(client, member.id);
      await expect(
        client.query(`SELECT * FROM join_group_by_code($1)`, [
          codeResult.rows[0].invite_code,
        ]),
      ).rejects.toThrow("already_member");
    });
  });

  it("raises group_full when group is at max capacity", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client);
      const joiner = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id);

      // Set max_members to 1 (admin already fills it)
      await client.query(`UPDATE groups SET max_members = 1 WHERE id = $1`, [
        groupId,
      ]);

      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );

      await setAuthContext(client, joiner.id);
      await expect(
        client.query(`SELECT * FROM join_group_by_code($1)`, [
          codeResult.rows[0].invite_code,
        ]),
      ).rejects.toThrow("group_full");
    });
  });

  it("reactivates an inactive member instead of inserting", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client);
      const rejoiner = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id);

      // Add then deactivate the user
      await addGroupMember(client, groupId, rejoiner.id);
      await client.query(
        `UPDATE group_members SET is_active = false WHERE group_id = $1 AND user_id = $2`,
        [groupId, rejoiner.id],
      );

      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );

      await setAuthContext(client, rejoiner.id);
      const result = await client.query(
        `SELECT * FROM join_group_by_code($1)`,
        [codeResult.rows[0].invite_code],
      );
      expect(result.rows).toHaveLength(1);

      // Verify reactivated (not duplicate row)
      const memberResult = await client.query(
        `SELECT is_active, role FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, rejoiner.id],
      );
      expect(memberResult.rows).toHaveLength(1);
      expect(memberResult.rows[0].is_active).toBe(true);
      expect(memberResult.rows[0].role).toBe("member");
    });
  });

  it("raises group_not_found for invalid code", async () => {
    await withTransaction(pool!, async (client) => {
      const user = await createTestUser(client);
      await setAuthContext(client, user.id);

      await expect(
        client.query(`SELECT * FROM join_group_by_code($1)`, ["ZZZZZZZZ"]),
      ).rejects.toThrow("group_not_found");
    });
  });
});
```

---

## Chunk 2: Service Layer

### Task 4: Service layer tests for lookupGroupByInviteCode and joinGroupByCode

**Files:**

- Modify: `src/__tests__/lib/groups-service.test.ts`

- [ ] **Step 1: Write failing tests**

Add these two `describe` blocks at the end of the file, after the existing `fetchGroupById` describe block. The imports at the top (`mockRpc` etc.) are already defined.

Also add `lookupGroupByInviteCode` and `joinGroupByCode` to the destructured require at the top of the file:

```typescript
const {
  fetchUserGroups,
  createGroup,
  fetchActiveTournaments,
  fetchGroupById,
  lookupGroupByInviteCode,
  joinGroupByCode,
} = require("@lib/groups-service");
```

Then add these test blocks:

```typescript
describe("lookupGroupByInviteCode", () => {
  it("calls RPC with uppercased code and returns GroupPreview", async () => {
    const preview = {
      id: "g-1",
      name: "Test Group",
      description: "A group",
      avatar_url: null,
      member_count: 5,
      max_members: 50,
      scoring_system: {
        exact_score: 5,
        correct_result: 3,
        correct_goal_diff: 1,
        wrong: 0,
      },
    };
    mockRpc.mockResolvedValueOnce({ data: preview, error: null });

    const result = await lookupGroupByInviteCode("abc12345");

    expect(mockRpc).toHaveBeenCalledWith("lookup_group_by_invite_code", {
      p_invite_code: "ABC12345",
    });
    expect(result).toEqual(preview);
  });

  it("throws on RPC error", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: new Error("group_not_found"),
    });

    await expect(lookupGroupByInviteCode("abc12345")).rejects.toThrow(
      "group_not_found",
    );
  });

  it("throws when code is not 8 characters", async () => {
    await expect(lookupGroupByInviteCode("short")).rejects.toThrow();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("joinGroupByCode", () => {
  it("calls RPC with uppercased code and returns CreatedGroup", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { id: "g-1", name: "Test Group", invite_code: "ABC12345" },
      error: null,
    });

    const result = await joinGroupByCode("abc12345");

    expect(mockRpc).toHaveBeenCalledWith("join_group_by_code", {
      p_invite_code: "ABC12345",
    });
    expect(result).toEqual({
      id: "g-1",
      name: "Test Group",
      invite_code: "ABC12345",
    });
  });

  it("throws on RPC error", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: new Error("already_member"),
    });

    await expect(joinGroupByCode("abc12345")).rejects.toThrow("already_member");
  });

  it("throws when code is not 8 characters", async () => {
    await expect(joinGroupByCode("short")).rejects.toThrow();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --testPathPattern=groups-service`
Expected: FAIL — `lookupGroupByInviteCode` and `joinGroupByCode` are not defined.

- [ ] **Step 3: Implement the service functions**

Add to `src/lib/groups-service.ts` after the existing `fetchActiveTournaments` function:

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

/**
 * Look up a group by its 8-character invite code.
 * Returns a preview with group info, member count, and scoring.
 * SECURITY DEFINER RPC — bypasses RLS so non-members can preview.
 */
export async function lookupGroupByInviteCode(
  code: string,
): Promise<GroupPreview> {
  if (code.length !== 8) {
    throw new Error("Invite code must be exactly 8 characters");
  }
  const { data, error } = await supabase.rpc("lookup_group_by_invite_code", {
    p_invite_code: code.toUpperCase(),
  });
  if (error) throw error;
  return data as GroupPreview;
}

/**
 * Join a group by its 8-character invite code.
 * Atomically validates membership capacity and inserts the user.
 * SECURITY DEFINER RPC — handles all validation server-side.
 */
export async function joinGroupByCode(code: string): Promise<CreatedGroup> {
  if (code.length !== 8) {
    throw new Error("Invite code must be exactly 8 characters");
  }
  const { data, error } = await supabase.rpc("join_group_by_code", {
    p_invite_code: code.toUpperCase(),
  });
  if (error) throw error;
  return data as CreatedGroup;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --testPathPattern=groups-service`
Expected: All tests PASS (existing + 6 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/groups-service.ts src/__tests__/lib/groups-service.test.ts
git commit -m "feat(groups): add lookupGroupByInviteCode and joinGroupByCode service functions"
```

---

## Chunk 3: Join Group Screen

### Task 5: Screen tests for idle and code input behavior

**Files:**

- Create: `src/__tests__/navigation/join-group.test.tsx`

- [ ] **Step 1: Write failing tests for idle state and input behavior**

```tsx
import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// ── Mocks ────────────────────────────────────────────────────────────

jest.mock("@lib/groups-service", () => ({
  lookupGroupByInviteCode: jest.fn(),
  joinGroupByCode: jest.fn(),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: jest.fn(),
}));

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: mockBack,
  }),
}));

// Must import AFTER mocks
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  lookupGroupByInviteCode,
  joinGroupByCode,
} = require("@lib/groups-service");
const { useAuth } = require("@hooks/use-auth");
const JoinGroupScreen = require("../../../app/(tabs)/groups/join").default;
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: { id: "user-1" } });
});

describe("JoinGroupScreen", () => {
  it("renders 8 empty input boxes in idle state", () => {
    const { getAllByTestId, queryByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);
    expect(inputs).toHaveLength(8);
    expect(queryByTestId("group-preview")).toBeNull();
    expect(queryByTestId("error-message")).toBeNull();
  });

  it("renders the Join Group title", () => {
    const { getByText } = render(<JoinGroupScreen />);
    expect(getByText("Join Group")).toBeTruthy();
  });

  it("auto-triggers lookup when all 8 characters are entered", async () => {
    lookupGroupByInviteCode.mockResolvedValueOnce({
      id: "g-1",
      name: "Test Group",
      description: null,
      avatar_url: null,
      member_count: 5,
      max_members: 50,
      scoring_system: {
        exact_score: 5,
        correct_result: 3,
        correct_goal_diff: 1,
        wrong: 0,
      },
    });

    const { getAllByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);

    // Type 8 hex characters
    const code = "AB12CD34";
    await act(async () => {
      for (let i = 0; i < 8; i++) {
        fireEvent.changeText(inputs[i], code[i]);
      }
    });

    await waitFor(() => {
      expect(lookupGroupByInviteCode).toHaveBeenCalledWith("AB12CD34");
    });
  });

  it("does not trigger lookup with fewer than 8 characters", () => {
    const { getAllByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);

    for (let i = 0; i < 7; i++) {
      fireEvent.changeText(inputs[i], "A");
    }

    expect(lookupGroupByInviteCode).not.toHaveBeenCalled();
  });

  it("uppercases input characters", () => {
    const { getAllByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);

    fireEvent.changeText(inputs[0], "a");

    // The displayed value should be uppercased
    expect(inputs[0].props.value).toBe("A");
  });

  it("rejects non-hex characters", () => {
    const { getAllByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);

    fireEvent.changeText(inputs[0], "G");
    expect(inputs[0].props.value).toBe("");

    fireEvent.changeText(inputs[0], "Z");
    expect(inputs[0].props.value).toBe("");

    // Valid hex should work
    fireEvent.changeText(inputs[0], "F");
    expect(inputs[0].props.value).toBe("F");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --testPathPattern=join-group`
Expected: FAIL — screen renders stub, no code inputs found.

- [ ] **Step 3: Commit failing tests**

```bash
git add src/__tests__/navigation/join-group.test.tsx
git commit -m "test(groups): add failing tests for join group screen idle state and input"
```

---

### Task 6: Implement join screen — code input and lookup

**Files:**

- Modify: `app/(tabs)/groups/join.tsx`

- [ ] **Step 1: Implement the full join screen**

Replace the entire content of `app/(tabs)/groups/join.tsx`:

```tsx
import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@hooks/use-auth";
import { lookupGroupByInviteCode, joinGroupByCode } from "@lib/groups-service";
import type { GroupPreview, ScoringSystem } from "@lib/groups-service";
import { colors } from "@lib/constants";

const CODE_LENGTH = 8;
const HEX_REGEX = /^[0-9a-fA-F]$/;

type ScreenState = "idle" | "loading" | "preview" | "error" | "joining";

/** Map RPC error messages to user-friendly text. */
function getErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("group_not_found")) return "No group found with this code";
  if (msg.includes("group_full")) return "This group is full";
  if (msg.includes("already_member"))
    return "You're already a member of this group";
  return "Something went wrong. Please try again.";
}

export default function JoinGroupScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [state, setState] = useState<ScreenState>("idle");
  const [groupPreview, setGroupPreview] = useState<GroupPreview | null>(null);
  const [errorText, setErrorText] = useState("");

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const resetToIdle = useCallback(() => {
    setState("idle");
    setGroupPreview(null);
    setErrorText("");
  }, []);

  const triggerLookup = useCallback(async (code: string) => {
    setState("loading");
    setErrorText("");
    setGroupPreview(null);
    try {
      const preview = await lookupGroupByInviteCode(code);
      setGroupPreview(preview);
      setState("preview");
    } catch (err) {
      setErrorText(getErrorMessage(err));
      setState("error");
    }
  }, []);

  const handleChangeText = useCallback(
    (text: string, index: number) => {
      // Handle paste: if text is multiple characters, distribute across boxes
      if (text.length > 1) {
        const chars = text
          .toUpperCase()
          .split("")
          .filter((c) => HEX_REGEX.test(c))
          .slice(0, CODE_LENGTH);
        if (chars.length === 0) return;

        const newDigits = [...digits];
        for (let i = 0; i < chars.length && index + i < CODE_LENGTH; i++) {
          newDigits[index + i] = chars[i];
        }
        setDigits(newDigits);

        // Focus the next empty box or last filled box
        const nextEmpty = newDigits.findIndex((d) => d === "");
        const focusIdx =
          nextEmpty >= 0
            ? nextEmpty
            : Math.min(index + chars.length, CODE_LENGTH - 1);
        inputRefs.current[focusIdx]?.focus();

        // Check if all filled
        if (newDigits.every((d) => d !== "")) {
          triggerLookup(newDigits.join(""));
        } else {
          resetToIdle();
        }
        return;
      }

      const char = text.toUpperCase();

      // Reject non-hex or empty
      if (text === "") {
        // Clearing — handled by backspace handler
        const newDigits = [...digits];
        newDigits[index] = "";
        setDigits(newDigits);
        resetToIdle();
        return;
      }

      if (!HEX_REGEX.test(char)) return;

      const newDigits = [...digits];
      newDigits[index] = char;
      setDigits(newDigits);

      // Auto-advance to next box
      if (index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Check if all filled
      if (newDigits.every((d) => d !== "")) {
        triggerLookup(newDigits.join(""));
      }
    },
    [digits, triggerLookup, resetToIdle],
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === "Backspace") {
        if (digits[index] === "" && index > 0) {
          // Empty box: move back and clear previous
          const newDigits = [...digits];
          newDigits[index - 1] = "";
          setDigits(newDigits);
          inputRefs.current[index - 1]?.focus();
          resetToIdle();
        } else if (digits[index] !== "") {
          // Current box has value: clear it
          const newDigits = [...digits];
          newDigits[index] = "";
          setDigits(newDigits);
          resetToIdle();
        }
      }
    },
    [digits, resetToIdle],
  );

  const handleJoin = useCallback(async () => {
    if (!groupPreview || !user) return;
    setState("joining");
    try {
      const result = await joinGroupByCode(digits.join(""));
      router.replace(`/(tabs)/groups/${result.id}`);
    } catch (err) {
      setErrorText(getErrorMessage(err));
      setState("error");
    }
  }, [groupPreview, user, digits, router]);

  if (!user) return null;

  const scoring = groupPreview?.scoring_system as ScoringSystem | undefined;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      testID="join-group-screen"
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          padding: 24,
          paddingBottom: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} testID="back-button">
          <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 20,
            fontWeight: "bold",
          }}
        >
          Join Group
        </Text>
      </View>

      {/* Code Input */}
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          Invite Code
        </Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {Array.from({ length: CODE_LENGTH }).map((_, i) => (
            <TextInput
              key={i}
              ref={(ref) => {
                inputRefs.current[i] = ref;
              }}
              testID={`code-input-${i}`}
              value={digits[i]}
              onChangeText={(text) => handleChangeText(text, i)}
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(nativeEvent.key, i)
              }
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType="default"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: digits[i] ? colors.primary : colors.surfaceBorder,
                borderRadius: 8,
                width: 38,
                height: 48,
                textAlign: "center",
                color: colors.textPrimary,
                fontSize: 22,
                fontWeight: "bold",
              }}
            />
          ))}
        </View>

        {/* Error text */}
        {state === "error" && errorText ? (
          <Text
            testID="error-message"
            style={{
              color: "#FF4444",
              fontSize: 14,
              textAlign: "center",
              marginTop: 12,
            }}
          >
            {errorText}
          </Text>
        ) : null}
      </View>

      {/* Loading spinner */}
      {state === "loading" ? (
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            marginTop: 32,
          }}
        >
          <ActivityIndicator
            size="large"
            color={colors.primary}
            testID="loading-indicator"
          />
        </View>
      ) : null}

      {/* Group Preview */}
      {(state === "preview" || state === "joining") && groupPreview ? (
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <View
            testID="group-preview"
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.surfaceBorder,
            }}
          >
            {/* Avatar + Name */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              {groupPreview.avatar_url ? (
                <Image
                  source={{ uri: groupPreview.avatar_url }}
                  style={{ width: 44, height: 44, borderRadius: 10 }}
                />
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: colors.secondary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontWeight: "bold",
                      fontSize: 18,
                    }}
                  >
                    {groupPreview.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontWeight: "bold",
                    fontSize: 16,
                  }}
                >
                  {groupPreview.name}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {groupPreview.member_count} / {groupPreview.max_members}{" "}
                  members
                </Text>
              </View>
            </View>

            {/* Description */}
            {groupPreview.description ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  lineHeight: 18,
                  marginBottom: 10,
                }}
              >
                {groupPreview.description}
              </Text>
            ) : null}

            {/* Scoring chips */}
            {scoring ? (
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <View
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 6,
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                    Exact: {scoring.exact_score}pts
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 6,
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                    Result: {scoring.correct_result}pts
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 6,
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                    Diff: {scoring.correct_goal_diff}pts
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Join button */}
          <TouchableOpacity
            testID="join-button"
            onPress={handleJoin}
            disabled={state === "joining"}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              marginTop: 16,
              opacity: state === "joining" ? 0.6 : 1,
            }}
          >
            {state === "joining" ? (
              <ActivityIndicator
                size="small"
                color={colors.background}
                testID="join-loading"
              />
            ) : (
              <Text
                style={{
                  color: colors.background,
                  fontWeight: "bold",
                  fontSize: 16,
                }}
              >
                Join Group
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm run test:unit -- --testPathPattern=join-group`
Expected: All tests from Task 5 PASS.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/groups/join.tsx
git commit -m "feat(groups): implement join group screen with code input and preview"
```

---

### Task 7: Screen tests for preview, error, and join flow

**Files:**

- Modify: `src/__tests__/navigation/join-group.test.tsx`

- [ ] **Step 1: Add tests for preview, errors, join, and navigation**

Append inside the existing `describe("JoinGroupScreen")` block:

```tsx
it("shows group preview card on successful lookup", async () => {
  lookupGroupByInviteCode.mockResolvedValueOnce({
    id: "g-1",
    name: "Uruguay Squad",
    description: "Predictions for Copa America",
    avatar_url: null,
    member_count: 12,
    max_members: 50,
    scoring_system: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
  });

  const { getAllByTestId, getByTestId, getByText } = render(
    <JoinGroupScreen />,
  );
  const inputs = getAllByTestId(/^code-input-/);

  await act(async () => {
    const code = "AB12CD34";
    for (let i = 0; i < 8; i++) {
      fireEvent.changeText(inputs[i], code[i]);
    }
  });

  await waitFor(() => {
    expect(getByTestId("group-preview")).toBeTruthy();
  });

  expect(getByText("Uruguay Squad")).toBeTruthy();
  expect(getByText("12 / 50 members")).toBeTruthy();
  expect(getByText("Predictions for Copa America")).toBeTruthy();
  expect(getByText("Exact: 5pts")).toBeTruthy();
  expect(getByTestId("join-button")).toBeTruthy();
});

it("shows loading spinner during lookup", async () => {
  // Never resolves — stays in loading state
  lookupGroupByInviteCode.mockReturnValueOnce(new Promise(() => {}));

  const { getAllByTestId, getByTestId } = render(<JoinGroupScreen />);
  const inputs = getAllByTestId(/^code-input-/);

  await act(async () => {
    const code = "AB12CD34";
    for (let i = 0; i < 8; i++) {
      fireEvent.changeText(inputs[i], code[i]);
    }
  });

  expect(getByTestId("loading-indicator")).toBeTruthy();
});

it("shows error for group_not_found", async () => {
  lookupGroupByInviteCode.mockRejectedValueOnce(new Error("group_not_found"));

  const { getAllByTestId, getByTestId, getByText } = render(
    <JoinGroupScreen />,
  );
  const inputs = getAllByTestId(/^code-input-/);

  await act(async () => {
    const code = "AB12CD34";
    for (let i = 0; i < 8; i++) {
      fireEvent.changeText(inputs[i], code[i]);
    }
  });

  await waitFor(() => {
    expect(getByTestId("error-message")).toBeTruthy();
  });
  expect(getByText("No group found with this code")).toBeTruthy();
});

it("shows error for group_full on join", async () => {
  lookupGroupByInviteCode.mockResolvedValueOnce({
    id: "g-1",
    name: "Full Group",
    description: null,
    avatar_url: null,
    member_count: 50,
    max_members: 50,
    scoring_system: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
  });
  joinGroupByCode.mockRejectedValueOnce(new Error("group_full"));

  const { getAllByTestId, getByTestId, getByText } = render(
    <JoinGroupScreen />,
  );
  const inputs = getAllByTestId(/^code-input-/);

  await act(async () => {
    const code = "AB12CD34";
    for (let i = 0; i < 8; i++) {
      fireEvent.changeText(inputs[i], code[i]);
    }
  });

  await waitFor(() => {
    expect(getByTestId("join-button")).toBeTruthy();
  });

  await act(async () => {
    fireEvent.press(getByTestId("join-button"));
  });

  await waitFor(() => {
    expect(getByText("This group is full")).toBeTruthy();
  });
});

it("shows error for already_member on join", async () => {
  lookupGroupByInviteCode.mockResolvedValueOnce({
    id: "g-1",
    name: "Test Group",
    description: null,
    avatar_url: null,
    member_count: 5,
    max_members: 50,
    scoring_system: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
  });
  joinGroupByCode.mockRejectedValueOnce(new Error("already_member"));

  const { getAllByTestId, getByTestId, getByText } = render(
    <JoinGroupScreen />,
  );
  const inputs = getAllByTestId(/^code-input-/);

  await act(async () => {
    const code = "AB12CD34";
    for (let i = 0; i < 8; i++) {
      fireEvent.changeText(inputs[i], code[i]);
    }
  });

  await waitFor(() => {
    expect(getByTestId("join-button")).toBeTruthy();
  });

  await act(async () => {
    fireEvent.press(getByTestId("join-button"));
  });

  await waitFor(() => {
    expect(getByText("You're already a member of this group")).toBeTruthy();
  });
});

it("navigates to group detail on successful join", async () => {
  lookupGroupByInviteCode.mockResolvedValueOnce({
    id: "g-1",
    name: "Test Group",
    description: null,
    avatar_url: null,
    member_count: 5,
    max_members: 50,
    scoring_system: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
  });
  joinGroupByCode.mockResolvedValueOnce({
    id: "g-1",
    name: "Test Group",
    invite_code: "AB12CD34",
  });

  const { getAllByTestId, getByTestId } = render(<JoinGroupScreen />);
  const inputs = getAllByTestId(/^code-input-/);

  // Enter code
  await act(async () => {
    const code = "AB12CD34";
    for (let i = 0; i < 8; i++) {
      fireEvent.changeText(inputs[i], code[i]);
    }
  });

  // Wait for preview
  await waitFor(() => {
    expect(getByTestId("join-button")).toBeTruthy();
  });

  // Press join
  await act(async () => {
    fireEvent.press(getByTestId("join-button"));
  });

  await waitFor(() => {
    expect(joinGroupByCode).toHaveBeenCalledWith("AB12CD34");
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/groups/g-1");
  });
});

it("shows generic error on network failure during join", async () => {
  lookupGroupByInviteCode.mockResolvedValueOnce({
    id: "g-1",
    name: "Test Group",
    description: null,
    avatar_url: null,
    member_count: 5,
    max_members: 50,
    scoring_system: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
  });
  joinGroupByCode.mockRejectedValueOnce(new Error("Network request failed"));

  const { getAllByTestId, getByTestId, getByText } = render(
    <JoinGroupScreen />,
  );
  const inputs = getAllByTestId(/^code-input-/);

  await act(async () => {
    const code = "AB12CD34";
    for (let i = 0; i < 8; i++) {
      fireEvent.changeText(inputs[i], code[i]);
    }
  });

  await waitFor(() => {
    expect(getByTestId("join-button")).toBeTruthy();
  });

  await act(async () => {
    fireEvent.press(getByTestId("join-button"));
  });

  await waitFor(() => {
    expect(getByText("Something went wrong. Please try again.")).toBeTruthy();
  });
});

it("clears preview when a character is deleted", async () => {
  lookupGroupByInviteCode.mockResolvedValueOnce({
    id: "g-1",
    name: "Test Group",
    description: null,
    avatar_url: null,
    member_count: 5,
    max_members: 50,
    scoring_system: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
  });

  const { getAllByTestId, getByTestId, queryByTestId } = render(
    <JoinGroupScreen />,
  );
  const inputs = getAllByTestId(/^code-input-/);

  // Enter full code
  await act(async () => {
    const code = "AB12CD34";
    for (let i = 0; i < 8; i++) {
      fireEvent.changeText(inputs[i], code[i]);
    }
  });

  await waitFor(() => {
    expect(getByTestId("group-preview")).toBeTruthy();
  });

  // Clear a character
  await act(async () => {
    fireEvent.changeText(inputs[7], "");
  });

  expect(queryByTestId("group-preview")).toBeNull();
});
```

- [ ] **Step 2: Run all tests**

Run: `npm run test:unit -- --testPathPattern=join-group`
Expected: All tests PASS.

- [ ] **Step 3: Update group-screens.test.tsx**

The existing `group-screens.test.tsx` has a test "renders join group screen" that checks for `getByText("Join Group")`. This should still pass since the new screen has that text. Run it to verify:

Run: `npm run test:unit -- --testPathPattern=group-screens`
Expected: PASS — the existing test finds "Join Group" title in the new screen.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/navigation/join-group.test.tsx
git commit -m "test(groups): add screen tests for join group preview, errors, and navigation"
```

---

## Chunk 4: Quality + Final

### Task 8: Run full CI checks and fix any issues

- [ ] **Step 1: Format check**

Run: `npm run format:check`
Expected: PASS. If not, run `npm run format` and commit.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS. If not, run `npm run lint:fix` and commit.

- [ ] **Step 3: Type check**

Run: `npm run typecheck`
Expected: PASS. Fix any type errors in the new code.

- [ ] **Step 4: Run all unit tests**

Run: `npm run test:ci`
Expected: All tests PASS.

- [ ] **Step 5: Fix anything that fails and commit**

```bash
git add -A
git commit -m "fix(groups): address CI issues in join group implementation"
```

(Only if fixes were needed.)

---

### Task 9: Update documentation

**Files:**

- Modify: `TAREAS.md`
- Modify: `CLAUDE.md` (if needed)

- [ ] **Step 1: Mark F1-12 as complete in TAREAS.md**

Change `- [ ] **F1-12** Join group (by code)` to `- [x] **F1-12** Join group (by code)` and add notes.

Update the progress summary table: Phase 1 completed goes from 8 to 9.

- [ ] **Step 2: Update CLAUDE.md if needed**

If the groups-service API or navigation changed in a way worth documenting, update the relevant section.

- [ ] **Step 3: Commit docs**

```bash
git add TAREAS.md CLAUDE.md
git commit -m "docs: update TAREAS.md and CLAUDE.md for F1-12 completion"
```

---

### Task 10: Push and create PR

- [ ] **Step 1: Push the feature branch**

```bash
git push -u origin feature/F1-12-join-group-by-code
```

- [ ] **Step 2: Create PR to develop**

```bash
gh pr create --title "feat(groups): join group by invite code (F1-12)" --body "$(cat <<'EOF'
## Summary
- Add two SECURITY DEFINER RPCs: `lookup_group_by_invite_code` and `join_group_by_code`
- Add service layer functions with 8-char code validation
- Replace join group stub with full screen: 8 hex character boxes, auto-lookup, inline preview, join confirmation
- Handle edge cases: group not found, group full, already member, rejoin inactive member

## Test plan
- [ ] SQL integration tests pass (`npm run test:supabase:local`)
- [ ] Service unit tests pass (6 new tests)
- [ ] Screen tests pass (13+ new tests)
- [ ] Full CI passes (`format:check`, `lint`, `typecheck`, `test:ci`)
- [ ] Manual test: enter valid invite code → see preview → join → navigate to group
- [ ] Manual test: enter invalid code → see error message
- [ ] Manual test: try to join full group → see "group is full" error

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
