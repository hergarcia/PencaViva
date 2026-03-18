# F1-14 Group Detail (Members + Info) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tabbed Members/Info view to the existing group detail screen, showing the member list with roles and group information (scoring system, assigned tournaments + invite section).

**Architecture:** Extend the service layer with `fetchGroupMembers` and `fetchGroupTournaments`, update `useGroupDetail` to fetch all three in parallel, create a `MemberRow` presentational component, and refactor `app/groups/[id].tsx` into a two-tab layout.

**Tech Stack:** React Native (FlatList, ScrollView, TouchableOpacity), Supabase PostgREST, TypeScript strict mode, Jest + RNTL.

**Spec:** `docs/superpowers/specs/2026-03-17-f1-14-group-detail-members-info-design.md`

---

## File Map

| Action | File                                                 |
| ------ | ---------------------------------------------------- |
| Modify | `src/lib/groups-service.ts`                          |
| Modify | `src/hooks/use-group-detail.ts`                      |
| Create | `src/components/groups/MemberRow.tsx`                |
| Modify | `app/groups/[id].tsx`                                |
| Modify | `src/__tests__/lib/groups-service.test.ts`           |
| Modify | `src/__tests__/hooks/use-group-detail.test.ts`       |
| Create | `src/__tests__/components/groups/MemberRow.test.tsx` |
| Modify | `src/__tests__/navigation/group-screens.test.tsx`    |

---

## Task 1: Service layer — new types, `fetchGroupMembers`, `fetchGroupTournaments`, and `scoring_system` in `UserGroup`

**Files:**

- Modify: `src/lib/groups-service.ts`
- Modify: `src/__tests__/lib/groups-service.test.ts`

- [ ] **Step 1.1: Write failing tests for `fetchGroupMembers`**

Add this describe block to `src/__tests__/lib/groups-service.test.ts`. Place it after the `fetchGroupById` describe block. Also add `fetchGroupMembers` and `fetchGroupTournaments` to the require destructuring at line 22.

```typescript
describe("fetchGroupMembers", () => {
  it("returns members sorted admin first then joined_at", async () => {
    mockChain.eq.mockReturnThis();
    mockChain.eq.mockReturnThis();
    mockChain.eq = jest.fn(() => mockChain);
    mockChain.eq.mockReturnThis();
    // last call resolves
    mockChain.select.mockReturnValueOnce({
      ...mockChain,
    });
    // Use the terminal eq to resolve
    const mockData = [
      {
        user_id: "u2",
        role: "member",
        joined_at: "2024-01-01T00:00:00Z",
        profile: {
          display_name: "Alice",
          username: "alice",
          avatar_url: null,
          points_total: 10,
        },
      },
      {
        user_id: "u1",
        role: "admin",
        joined_at: "2024-01-01T00:00:00Z",
        profile: {
          display_name: "Bob",
          username: "bob",
          avatar_url: null,
          points_total: 20,
        },
      },
    ];

    // The chain ends with the second .eq() call resolving
    let eqCallCount = 0;
    mockChain.eq = jest.fn(() => {
      eqCallCount++;
      if (eqCallCount >= 2) {
        return Promise.resolve({ data: mockData, error: null });
      }
      return mockChain;
    });

    const result = await fetchGroupMembers("g1");

    expect(result[0].role).toBe("admin");
    expect(result[0].display_name).toBe("Bob");
    expect(result[1].role).toBe("member");
    expect(result[1].display_name).toBe("Alice");
  });

  it("throws on Supabase error", async () => {
    let eqCallCount = 0;
    mockChain.eq = jest.fn(() => {
      eqCallCount++;
      if (eqCallCount >= 2) {
        return Promise.resolve({ data: null, error: new Error("DB error") });
      }
      return mockChain;
    });

    await expect(fetchGroupMembers("g1")).rejects.toThrow("DB error");
  });

  it("returns empty array when group has no members", async () => {
    let eqCallCount = 0;
    mockChain.eq = jest.fn(() => {
      eqCallCount++;
      if (eqCallCount >= 2) {
        return Promise.resolve({ data: [], error: null });
      }
      return mockChain;
    });

    const result = await fetchGroupMembers("g1");
    expect(result).toEqual([]);
  });
});

describe("fetchGroupTournaments", () => {
  it("returns tournaments for a group", async () => {
    mockChain.order.mockReturnValueOnce({
      data: [
        {
          tournament: {
            id: "t1",
            name: "Premier League",
            short_name: "PL",
            logo_url: null,
          },
        },
      ],
      error: null,
    });

    const result = await fetchGroupTournaments("g1");

    expect(result).toEqual([
      { id: "t1", name: "Premier League", short_name: "PL", logo_url: null },
    ]);
  });

  it("returns empty array when no tournaments assigned", async () => {
    mockChain.order.mockReturnValueOnce({ data: [], error: null });

    const result = await fetchGroupTournaments("g1");
    expect(result).toEqual([]);
  });

  it("throws on Supabase error", async () => {
    mockChain.order.mockReturnValueOnce({
      data: null,
      error: new Error("DB error"),
    });

    await expect(fetchGroupTournaments("g1")).rejects.toThrow("DB error");
  });
});
```

> **Note on mock complexity:** The `fetchGroupMembers` query chain ends with `.eq()` (no `.order()` — client-side sort instead). Because `mockChain` is shared and `.eq()` is called twice, the test above tracks call count to resolve on the second call. This is the same pattern used elsewhere in the test file.

- [ ] **Step 1.2: Run failing tests**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && npm run test:unit -- --testPathPattern="groups-service" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `fetchGroupMembers` and `fetchGroupTournaments` are not defined.

- [ ] **Step 1.3: Add `GroupMember`, `GroupTournament` types, add `scoring_system` to `UserGroup`, and implement both functions**

In `src/lib/groups-service.ts`:

**Add `scoring_system` to `UserGroup` type** (after `member_count`):

```typescript
scoring_system: ScoringSystem;
```

**Add new types** after the `Tournament` interface:

```typescript
export type GroupMember = {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  points_total: number;
  role: GroupRole;
  joined_at: string;
};

export type GroupTournament = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
};
```

**Update `fetchGroupById`** — add `scoring_system` to the inner select and return mapping:

In the `.select()` call, change the groups sub-select to include `scoring_system`:

```typescript
    group:groups!inner (
      id,
      name,
      description,
      avatar_url,
      invite_code,
      created_by,
      scoring_system,
      group_members ( count )
    )
```

In the return statement, add `scoring_system` after `created_by`:

```typescript
    scoring_system: g.scoring_system as ScoringSystem,
```

**Add `fetchGroupMembers`** after `fetchGroupById`:

```typescript
const ROLE_ORDER: Record<string, number> = {
  admin: 0,
  moderator: 1,
  member: 2,
};

/**
 * Fetch all active members of a group, joined with their profile data.
 * Sorted admin → moderator → member, then joined_at ascending.
 * RLS allows members to query group_members for their own groups.
 */
export async function fetchGroupMembers(
  groupId: string,
): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select(
      `
      user_id,
      role,
      joined_at,
      profile:profiles!user_id (
        display_name,
        username,
        avatar_url,
        points_total
      )
    `,
    )
    .eq("group_id", groupId)
    .eq("is_active", true);

  if (error) throw error;

  type RawMember = {
    user_id: string;
    role: string;
    joined_at: string;
    profile: {
      display_name: string;
      username: string;
      avatar_url: string | null;
      points_total: number;
    };
  };

  return ((data ?? []) as RawMember[])
    .map((row) => ({
      user_id: row.user_id,
      display_name: row.profile.display_name,
      username: row.profile.username,
      avatar_url: row.profile.avatar_url,
      points_total: row.profile.points_total,
      role: row.role as GroupRole,
      joined_at: row.joined_at,
    }))
    .sort((a, b) => {
      const roleDiff = (ROLE_ORDER[a.role] ?? 2) - (ROLE_ORDER[b.role] ?? 2);
      if (roleDiff !== 0) return roleDiff;
      return a.joined_at.localeCompare(b.joined_at);
    });
}
```

**Add `fetchGroupTournaments`** after `fetchGroupMembers`:

```typescript
/**
 * Fetch tournaments assigned to a group, ordered by when they were added.
 * RLS allows group members to query group_tournaments.
 */
export async function fetchGroupTournaments(
  groupId: string,
): Promise<GroupTournament[]> {
  const { data, error } = await supabase
    .from("group_tournaments")
    .select(
      `
      tournament:tournaments!tournament_id (
        id,
        name,
        short_name,
        logo_url
      )
    `,
    )
    .eq("group_id", groupId)
    .order("added_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    return row.tournament as GroupTournament;
  });
}
```

- [ ] **Step 1.4: Update `fetchGroupById` tests to include `scoring_system`**

In `src/__tests__/lib/groups-service.test.ts`, update the `fakeGroup` object (and the expected result in "returns UserGroup on success") to include `scoring_system`:

```typescript
const fakeGroup = {
  id: "g1",
  name: "Test Group",
  description: "desc",
  avatar_url: null,
  invite_code: "ABC12345",
  created_by: "u1",
  scoring_system: {
    exact_score: 5,
    correct_result: 3,
    correct_goal_diff: 1,
    wrong: 0,
  },
  group_members: [{ count: 3 }],
};
```

And update the expected result in "returns UserGroup on success":

```typescript
expect(result).toEqual({
  id: "g1",
  name: "Test Group",
  description: "desc",
  avatar_url: null,
  invite_code: "ABC12345",
  created_by: "u1",
  member_count: 3,
  scoring_system: {
    exact_score: 5,
    correct_result: 3,
    correct_goal_diff: 1,
    wrong: 0,
  },
  role: "admin",
});
```

- [ ] **Step 1.5: Run all service tests**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && npm run test:unit -- --testPathPattern="groups-service" --no-coverage 2>&1 | tail -30
```

Expected: all PASS. Fix any failures before continuing.

- [ ] **Step 1.6: Commit**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && git add src/lib/groups-service.ts src/__tests__/lib/groups-service.test.ts && git commit -m "feat(groups): add GroupMember/GroupTournament types, fetchGroupMembers, fetchGroupTournaments, scoring_system in UserGroup"
```

---

## Task 2: Extend `useGroupDetail` hook

**Files:**

- Modify: `src/hooks/use-group-detail.ts`
- Modify: `src/__tests__/hooks/use-group-detail.test.ts`

- [ ] **Step 2.1: Write failing tests for updated hook shape**

Replace the contents of `src/__tests__/hooks/use-group-detail.test.ts` with:

```typescript
import { renderHook, waitFor } from "@testing-library/react-native";
import type {
  UserGroup,
  GroupMember,
  GroupTournament,
} from "@lib/groups-service";

jest.mock("@lib/groups-service", () => ({
  fetchGroupById: jest.fn(),
  fetchGroupMembers: jest.fn(),
  fetchGroupTournaments: jest.fn(),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { useGroupDetail } = require("@hooks/use-group-detail");
const {
  fetchGroupById,
  fetchGroupMembers,
  fetchGroupTournaments,
} = require("@lib/groups-service");
const { useAuth } = require("@hooks/use-auth");
/* eslint-enable @typescript-eslint/no-require-imports */

const fakeGroup: UserGroup = {
  id: "g1",
  name: "Test Group",
  description: null,
  avatar_url: null,
  invite_code: "ABC12345",
  created_by: "u1",
  member_count: 3,
  role: "admin",
  scoring_system: {
    exact_score: 5,
    correct_result: 3,
    correct_goal_diff: 1,
    wrong: 0,
  },
};

const fakeMembers: GroupMember[] = [
  {
    user_id: "u1",
    display_name: "Bob",
    username: "bob",
    avatar_url: null,
    points_total: 20,
    role: "admin",
    joined_at: "2024-01-01T00:00:00Z",
  },
];

const fakeTournaments: GroupTournament[] = [
  { id: "t1", name: "Premier League", short_name: "PL", logo_url: null },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useGroupDetail", () => {
  it("returns group, members, and tournaments on success", async () => {
    useAuth.mockReturnValue({ user: { id: "u1" }, isInitialized: true });
    fetchGroupById.mockResolvedValueOnce(fakeGroup);
    fetchGroupMembers.mockResolvedValueOnce(fakeMembers);
    fetchGroupTournaments.mockResolvedValueOnce(fakeTournaments);

    const { result } = renderHook(() => useGroupDetail("g1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.group).toEqual(fakeGroup);
    expect(result.current.members).toEqual(fakeMembers);
    expect(result.current.tournaments).toEqual(fakeTournaments);
    expect(result.current.error).toBeNull();
    expect(fetchGroupById).toHaveBeenCalledWith("g1");
    expect(fetchGroupMembers).toHaveBeenCalledWith("g1");
    expect(fetchGroupTournaments).toHaveBeenCalledWith("g1");
  });

  it("does not fetch while isInitialized is false", () => {
    useAuth.mockReturnValue({ user: null, isInitialized: false });

    renderHook(() => useGroupDetail("g1"));

    expect(fetchGroupById).not.toHaveBeenCalled();
    expect(fetchGroupMembers).not.toHaveBeenCalled();
    expect(fetchGroupTournaments).not.toHaveBeenCalled();
  });

  it("sets loading false and returns empty members/tournaments when no user", async () => {
    useAuth.mockReturnValue({ user: null, isInitialized: true });

    const { result } = renderHook(() => useGroupDetail("g1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.group).toBeNull();
    expect(result.current.members).toEqual([]);
    expect(result.current.tournaments).toEqual([]);
    expect(fetchGroupById).not.toHaveBeenCalled();
  });

  it("sets error on fetch failure and returns empty members/tournaments", async () => {
    useAuth.mockReturnValue({ user: { id: "u1" }, isInitialized: true });
    fetchGroupById.mockRejectedValueOnce(new Error("Network error"));
    fetchGroupMembers.mockResolvedValueOnce([]);
    fetchGroupTournaments.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useGroupDetail("g1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network error");
    expect(result.current.group).toBeNull();
    expect(result.current.members).toEqual([]);
    expect(result.current.tournaments).toEqual([]);
  });
});
```

- [ ] **Step 2.2: Run failing hook tests**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && npm run test:unit -- --testPathPattern="use-group-detail" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — hook doesn't return `members` or `tournaments` yet.

- [ ] **Step 2.3: Update `useGroupDetail` hook implementation**

Replace `src/hooks/use-group-detail.ts` with:

```typescript
import { useState, useEffect } from "react";
import { useAuth } from "@hooks/use-auth";
import {
  fetchGroupById,
  fetchGroupMembers,
  fetchGroupTournaments,
} from "@lib/groups-service";
import type {
  UserGroup,
  GroupMember,
  GroupTournament,
} from "@lib/groups-service";

type UseGroupDetailResult = {
  group: UserGroup | null;
  members: GroupMember[];
  tournaments: GroupTournament[];
  loading: boolean;
  error: string | null;
};

/**
 * Hook that loads a group, its members, and its assigned tournaments in parallel.
 * Guards on isInitialized (not isLoading) — isLoading is only true during
 * sign-in/sign-out operations, while isInitialized indicates auth hydration.
 */
export function useGroupDetail(groupId: string): UseGroupDetailResult {
  const { user, isInitialized } = useAuth();
  const [group, setGroup] = useState<UserGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [tournaments, setTournaments] = useState<GroupTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized) return;

    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchGroupById(groupId),
      fetchGroupMembers(groupId),
      fetchGroupTournaments(groupId),
    ])
      .then(([g, m, t]) => {
        if (!cancelled) {
          setGroup(g);
          setMembers(m);
          setTournaments(t);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [groupId, user, isInitialized]);

  return { group, members, tournaments, loading, error };
}
```

- [ ] **Step 2.4: Run hook tests**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && npm run test:unit -- --testPathPattern="use-group-detail" --no-coverage 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 2.5: Commit**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && git add src/hooks/use-group-detail.ts src/__tests__/hooks/use-group-detail.test.ts && git commit -m "feat(groups): extend useGroupDetail to fetch members and tournaments in parallel"
```

---

## Task 3: `MemberRow` component

**Files:**

- Create: `src/components/groups/MemberRow.tsx`
- Create: `src/__tests__/components/groups/MemberRow.test.tsx`

- [ ] **Step 3.1: Write failing tests**

Create `src/__tests__/components/groups/MemberRow.test.tsx`:

```typescript
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { MemberRow } from "@components/groups/MemberRow";
import type { GroupMember } from "@lib/groups-service";

const baseMember: GroupMember = {
  user_id: "u1",
  display_name: "Alice Smith",
  username: "alice",
  avatar_url: null,
  points_total: 42,
  role: "admin",
  joined_at: "2024-01-01T00:00:00Z",
};

describe("MemberRow", () => {
  it("renders display_name and username", () => {
    render(<MemberRow member={baseMember} isCurrentUser={false} />);
    expect(screen.getByText("Alice Smith")).toBeTruthy();
    expect(screen.getByText("@alice")).toBeTruthy();
  });

  it("renders role badge", () => {
    render(<MemberRow member={baseMember} isCurrentUser={false} />);
    expect(screen.getByTestId("role-badge-u1")).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("renders 'You' badge when isCurrentUser is true", () => {
    render(<MemberRow member={baseMember} isCurrentUser={true} />);
    expect(screen.getByTestId("you-badge-u1")).toBeTruthy();
  });

  it("does not render 'You' badge when isCurrentUser is false", () => {
    render(<MemberRow member={baseMember} isCurrentUser={false} />);
    expect(screen.queryByTestId("you-badge-u1")).toBeNull();
  });

  it("renders letter avatar from first char of display_name", () => {
    render(<MemberRow member={baseMember} isCurrentUser={false} />);
    expect(screen.getByText("A")).toBeTruthy();
  });

  it("renders 'Mod' label for moderator role", () => {
    render(
      <MemberRow
        member={{ ...baseMember, role: "moderator" }}
        isCurrentUser={false}
      />,
    );
    expect(screen.getByText("Mod")).toBeTruthy();
  });

  it("renders 'Member' label for member role", () => {
    render(
      <MemberRow
        member={{ ...baseMember, role: "member" }}
        isCurrentUser={false}
      />,
    );
    expect(screen.getByText("Member")).toBeTruthy();
  });

  it("has correct testID on the row container", () => {
    render(<MemberRow member={baseMember} isCurrentUser={false} />);
    expect(screen.getByTestId("member-row-u1")).toBeTruthy();
  });
});
```

- [ ] **Step 3.2: Run failing tests**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && npm run test:unit -- --testPathPattern="MemberRow" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `MemberRow` module does not exist.

- [ ] **Step 3.3: Implement `MemberRow`**

Create `src/components/groups/MemberRow.tsx`:

```typescript
import React from "react";
import { View, Text } from "react-native";
import { colors } from "@lib/constants";
import type { GroupMember, GroupRole } from "@lib/groups-service";

const ROLE_LABEL: Record<GroupRole, string> = {
  admin: "Admin",
  moderator: "Mod",
  member: "Member",
};

const ROLE_COLOR: Record<GroupRole, string> = {
  admin: colors.accent,
  moderator: colors.secondary,
  member: colors.textSecondary,
};

interface MemberRowProps {
  member: GroupMember;
  isCurrentUser: boolean;
}

export function MemberRow({ member, isCurrentUser }: MemberRowProps) {
  const letter = member.display_name.charAt(0).toUpperCase();

  return (
    <View
      testID={`member-row-${member.user_id}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceBorder,
      }}
    >
      {/* Letter avatar */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.primary + "33",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Text
          style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}
        >
          {letter}
        </Text>
      </View>

      {/* Name + username */}
      <View style={{ flex: 1 }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "600",
              fontSize: 15,
            }}
            numberOfLines={1}
          >
            {member.display_name}
          </Text>
          {isCurrentUser && (
            <Text
              testID={`you-badge-${member.user_id}`}
              style={{ color: colors.primary, fontSize: 11 }}
            >
              You
            </Text>
          )}
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          @{member.username}
        </Text>
      </View>

      {/* Role badge */}
      <Text
        testID={`role-badge-${member.user_id}`}
        style={{
          color: ROLE_COLOR[member.role],
          fontSize: 12,
          fontWeight: "600",
          marginLeft: 8,
        }}
      >
        {ROLE_LABEL[member.role]}
      </Text>
    </View>
  );
}
```

- [ ] **Step 3.4: Run component tests**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && npm run test:unit -- --testPathPattern="MemberRow" --no-coverage 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 3.5: Commit**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && git add src/components/groups/MemberRow.tsx src/__tests__/components/groups/MemberRow.test.tsx && git commit -m "feat(groups): add MemberRow component with avatar, name, role badge"
```

---

## Task 4: Refactor group detail screen to tabbed layout

**Files:**

- Modify: `app/groups/[id].tsx`
- Modify: `src/__tests__/navigation/group-screens.test.tsx`

- [ ] **Step 4.1: Update mock + write failing tests for group-screens**

In `src/__tests__/navigation/group-screens.test.tsx`:

1. Add `fetchGroupMembers` and `fetchGroupTournaments` to the `@lib/groups-service` mock at the top:

```typescript
jest.mock("@lib/groups-service", () => ({
  createGroup: jest.fn(),
  fetchActiveTournaments: jest.fn().mockResolvedValue([]),
  fetchGroupById: jest.fn(),
  fetchGroupMembers: jest.fn(),
  fetchGroupTournaments: jest.fn(),
  lookupGroupByInviteCode: jest.fn(),
  joinGroupByCode: jest.fn(),
}));
```

2. Add `scoring_system` to `loadedGroup`:

```typescript
const loadedGroup = {
  id: "7",
  name: "My Penca",
  description: null,
  avatar_url: null,
  invite_code: "ABCD1234",
  created_by: "u1",
  member_count: 5,
  role: "admin" as const,
  scoring_system: {
    exact_score: 5,
    correct_result: 3,
    correct_goal_diff: 1,
    wrong: 0,
  },
};
```

3. Update the `useGroupDetail` mock default return value to include `members` and `tournaments`:

```typescript
jest.mock("@hooks/use-group-detail", () => ({
  useGroupDetail: jest.fn().mockReturnValue({
    group: null,
    members: [],
    tournaments: [],
    loading: true,
    error: null,
  }),
}));
```

4. In the "renders group name, back button, and invite code when loaded" test, update the `mockReturnValueOnce` to include `members` and `tournaments`:

```typescript
(useGroupDetail as jest.Mock).mockReturnValueOnce({
  group: loadedGroup,
  members: [],
  tournaments: [],
  loading: false,
  error: null,
});
```

5. In the `Invite code section` describe block, update the `beforeEach` mock:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  (useGroupDetail as jest.Mock).mockReturnValue({
    group: loadedGroup,
    members: [],
    tournaments: [],
    loading: false,
    error: null,
  });
});
```

6. Add a new describe block at the end of the file for the new tab behavior:

```typescript
describe("Group detail tabs", () => {
  const { useGroupDetail } = require("@hooks/use-group-detail");

  const members = [
    {
      user_id: "user-1",
      display_name: "Bob",
      username: "bob",
      avatar_url: null,
      points_total: 20,
      role: "admin" as const,
      joined_at: "2024-01-01T00:00:00Z",
    },
    {
      user_id: "user-2",
      display_name: "Alice",
      username: "alice",
      avatar_url: null,
      points_total: 10,
      role: "member" as const,
      joined_at: "2024-01-02T00:00:00Z",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useGroupDetail as jest.Mock).mockReturnValue({
      group: loadedGroup,
      members,
      tournaments: [],
      loading: false,
      error: null,
    });
  });

  it("renders Members tab by default", () => {
    render(<GroupDetailScreen />);
    expect(screen.getByTestId("tab-members")).toBeTruthy();
    expect(screen.getByTestId("tab-info")).toBeTruthy();
    expect(screen.getByTestId("members-list")).toBeTruthy();
  });

  it("renders member rows", () => {
    render(<GroupDetailScreen />);
    expect(screen.getByTestId("member-row-user-1")).toBeTruthy();
    expect(screen.getByTestId("member-row-user-2")).toBeTruthy();
  });

  it("marks the current user's row with You badge", () => {
    render(<GroupDetailScreen />);
    expect(screen.getByTestId("you-badge-user-1")).toBeTruthy();
    expect(screen.queryByTestId("you-badge-user-2")).toBeNull();
  });

  it("switches to Info tab when tapped", () => {
    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    expect(screen.getByTestId("group-info-tab")).toBeTruthy();
  });

  it("renders scoring grid on Info tab", () => {
    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    expect(screen.getByTestId("scoring-exact-score")).toBeTruthy();
    expect(screen.getByTestId("scoring-correct-result")).toBeTruthy();
  });

  it("renders invite code on Info tab", () => {
    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    expect(screen.getByTestId("invite-code")).toBeTruthy();
  });

  it("renders no-tournaments message when tournaments list is empty", () => {
    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    expect(screen.getByText("No tournaments assigned yet.")).toBeTruthy();
  });

  it("renders tournament items when tournaments exist", () => {
    (useGroupDetail as jest.Mock).mockReturnValue({
      group: loadedGroup,
      members,
      tournaments: [
        { id: "t1", name: "Premier League", short_name: "PL", logo_url: null },
      ],
      loading: false,
      error: null,
    });
    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    expect(screen.getByTestId("tournament-t1")).toBeTruthy();
    expect(screen.getByText("Premier League (PL)")).toBeTruthy();
  });
});
```

- [ ] **Step 4.2: Run failing screen tests**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && npm run test:unit -- --testPathPattern="group-screens" --no-coverage 2>&1 | tail -30
```

Expected: FAIL — new tab tests fail, and existing tests may fail if `scoring_system` is required.

- [ ] **Step 4.3: Rewrite `app/groups/[id].tsx`**

Replace the entire file with:

```typescript
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import Clipboard from "@react-native-clipboard/clipboard";
import { colors, APP_BASE_URL } from "@lib/constants";
import { useGroupDetail } from "@hooks/use-group-detail";
import { useAuth } from "@hooks/use-auth";
import { ScreenHeader } from "@components/common/ScreenHeader";
import { MemberRow } from "@components/groups/MemberRow";
import type { GroupMember } from "@lib/groups-service";

type Tab = "members" | "info";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { group, members, tournaments, loading, error } = useGroupDetail(id);
  const [activeTab, setActiveTab] = useState<Tab>("members");

  const inviteUrl = group ? `${APP_BASE_URL}/join/${group.invite_code}` : "";
  const [copiedState, setCopiedState] = useState<"code" | "link" | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  function copyWithFeedback(text: string, type: "code" | "link") {
    Clipboard.setString(text);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    setCopiedState(type);
    copyTimeoutRef.current = setTimeout(() => setCopiedState(null), 1500);
  }

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        testID="loading-indicator"
      >
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <Text
            testID="error-message"
            style={{
              color: colors.textSecondary,
              textAlign: "center",
              fontSize: 15,
            }}
          >
            {error ?? "Group not found."}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 16 }}
          >
            <Text style={{ color: colors.primary, fontWeight: "600" }}>
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={group.name} />

      {/* Tab bar */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceBorder,
        }}
      >
        {(["members", "info"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            testID={`tab-${tab}`}
            onPress={() => setActiveTab(tab)}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor:
                activeTab === tab ? colors.primary : "transparent",
            }}
          >
            <Text
              style={{
                color:
                  activeTab === tab ? colors.primary : colors.textSecondary,
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              {tab === "members"
                ? `Members (${group.member_count})`
                : "Info"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Members tab */}
      {activeTab === "members" && (
        <FlatList
          testID="members-list"
          data={members}
          keyExtractor={(item: GroupMember) => item.user_id}
          renderItem={({ item }: { item: GroupMember }) => (
            <MemberRow
              member={item}
              isCurrentUser={item.user_id === user?.id}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8 }}
          ListEmptyComponent={
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: 24,
                fontSize: 14,
              }}
            >
              No members found.
            </Text>
          }
        />
      )}

      {/* Info tab */}
      {activeTab === "info" && (
        <ScrollView
          testID="group-info-tab"
          contentContainerStyle={{ padding: 24 }}
        >
          {/* Description */}
          {group.description ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 15,
                marginBottom: 16,
              }}
            >
              {group.description}
            </Text>
          ) : null}

          {/* Scoring system */}
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "700",
              fontSize: 16,
              marginBottom: 12,
            }}
          >
            Scoring
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 24,
            }}
          >
            {(
              [
                {
                  label: "Exact score",
                  testId: "scoring-exact-score",
                  value: group.scoring_system.exact_score,
                },
                {
                  label: "Correct result",
                  testId: "scoring-correct-result",
                  value: group.scoring_system.correct_result,
                },
                {
                  label: "Goal difference",
                  testId: "scoring-goal-difference",
                  value: group.scoring_system.correct_goal_diff,
                },
                {
                  label: "Wrong",
                  testId: "scoring-wrong",
                  value: group.scoring_system.wrong,
                },
              ] as const
            ).map(({ label, testId, value }) => (
              <View
                key={label}
                testID={testId}
                style={{
                  width: "47%",
                  backgroundColor: colors.surface,
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 11,
                    marginBottom: 4,
                  }}
                >
                  {label.toUpperCase()}
                </Text>
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 22,
                    fontWeight: "700",
                  }}
                >
                  {value} pts
                </Text>
              </View>
            ))}
          </View>

          {/* Tournaments */}
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "700",
              fontSize: 16,
              marginBottom: 12,
            }}
          >
            Tournaments
          </Text>
          {tournaments.length === 0 ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 14,
                marginBottom: 24,
              }}
            >
              No tournaments assigned yet.
            </Text>
          ) : (
            <View style={{ marginBottom: 24, gap: 8 }}>
              {tournaments.map((t) => (
                <View
                  key={t.id}
                  testID={`tournament-${t.id}`}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 14 }}>
                    {t.name}
                    {t.short_name ? ` (${t.short_name})` : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Invite section */}
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "700",
              fontSize: 16,
              marginBottom: 12,
            }}
          >
            Invite
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 20,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              INVITE CODE
            </Text>

            {/* Tap-to-copy code pill */}
            <TouchableOpacity
              testID="invite-code"
              onPress={() => copyWithFeedback(group.invite_code, "code")}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1.5,
                borderColor: colors.primary + "4D",
                borderRadius: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 12,
                paddingHorizontal: 18,
                width: "100%",
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 26,
                  fontWeight: "700",
                  letterSpacing: 6,
                }}
              >
                {group.invite_code}
              </Text>
              <Ionicons
                name="copy-outline"
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>

            {/* Inline copy feedback */}
            {copiedState !== null ? (
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 12,
                  marginTop: 6,
                  marginBottom: 4,
                }}
              >
                {copiedState === "code" ? "Code copied!" : "Link copied!"}
              </Text>
            ) : null}

            {/* QR code */}
            <View
              style={{
                marginTop: 24,
                backgroundColor: "#FFFFFF",
                padding: 8,
                borderRadius: 8,
              }}
            >
              <QRCode value={inviteUrl} size={160} color="#000000" />
            </View>

            {/* Copy link button */}
            <TouchableOpacity
              testID="copy-link-button"
              onPress={() => copyWithFeedback(inviteUrl, "link")}
              style={{
                marginTop: 16,
                width: "100%",
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
                borderRadius: 8,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Ionicons
                name="link-outline"
                size={16}
                color={colors.textSecondary}
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Copy link
              </Text>
            </TouchableOpacity>
          </View>

          {/* Share button */}
          <TouchableOpacity
            testID="share-button"
            onPress={async () => {
              try {
                await Share.share({
                  message: `Join my group "${group.name}" on PencaViva: ${inviteUrl}`,
                  url: inviteUrl,
                });
              } catch {
                // User cancelled share — no action needed
              }
            }}
            style={{
              marginTop: 16,
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            <Text
              style={{ color: "#000000", fontWeight: "700", fontSize: 16 }}
            >
              Share with friends
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
```

> **Note:** The invite code tests in `Invite code section` describe block press `invite-code` and `copy-link-button`. These testIDs now live inside the Info tab. The tests will need to navigate to the Info tab first — OR we can accept that the existing invite tests need updating to tap the Info tab before pressing the buttons. Update those tests accordingly in the next step.

- [ ] **Step 4.4: Update `Invite code section` tests to navigate to Info tab first**

In `src/__tests__/navigation/group-screens.test.tsx`, update all tests in the `Invite code section` describe block to tap the Info tab before interacting:

```typescript
describe("Invite code section", () => {
  const { useGroupDetail } = require("@hooks/use-group-detail");

  beforeEach(() => {
    jest.clearAllMocks();
    (useGroupDetail as jest.Mock).mockReturnValue({
      group: loadedGroup,
      members: [],
      tournaments: [],
      loading: false,
      error: null,
    });
  });

  function renderAndOpenInfoTab() {
    const utils = render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    return utils;
  }

  it("renders testID='invite-code' pill on Info tab", () => {
    renderAndOpenInfoTab();
    expect(screen.getByTestId("invite-code")).toBeTruthy();
  });

  it("tapping invite-code pill copies the code", () => {
    renderAndOpenInfoTab();
    fireEvent.press(screen.getByTestId("invite-code"));
    expect(Clipboard.setString).toHaveBeenCalledWith("ABCD1234");
  });

  it("tapping copy-link-button copies the full URL", () => {
    renderAndOpenInfoTab();
    fireEvent.press(screen.getByTestId("copy-link-button"));
    expect(Clipboard.setString).toHaveBeenCalledWith(
      "https://pencaviva.app/join/ABCD1234",
    );
  });

  it("shows 'Code copied!' after tapping invite-code pill", () => {
    renderAndOpenInfoTab();
    fireEvent.press(screen.getByTestId("invite-code"));
    expect(screen.getByText("Code copied!")).toBeTruthy();
  });

  it("shows 'Link copied!' after tapping copy-link-button", () => {
    renderAndOpenInfoTab();
    fireEvent.press(screen.getByTestId("copy-link-button"));
    expect(screen.getByText("Link copied!")).toBeTruthy();
  });

  it("does not show 'Code copied!' on initial render", () => {
    renderAndOpenInfoTab();
    expect(screen.queryByText("Code copied!")).toBeNull();
  });
});
```

Also update the test "renders group name, back button, and invite code when loaded" — it checks `invite-code` testID which is now on the Info tab. Either remove this assertion or navigate to the Info tab in that test. The simplest fix is to remove the `invite-code` assertion from that test (since it's covered in the Invite code section describe):

```typescript
  it("renders group name and back button when loaded", () => {
    (useGroupDetail as jest.Mock).mockReturnValueOnce({
      group: loadedGroup,
      members: [],
      tournaments: [],
      loading: false,
      error: null,
    });
    render(<GroupDetailScreen />);
    expect(screen.getByText("My Penca")).toBeTruthy();
    expect(screen.getByTestId("back-button")).toBeTruthy();
    expect(screen.getByTestId("members-list")).toBeTruthy();
  });
```

- [ ] **Step 4.5: Run all group-screens tests**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && npm run test:unit -- --testPathPattern="group-screens" --no-coverage 2>&1 | tail -40
```

Expected: all PASS. Fix any failures before continuing.

- [ ] **Step 4.6: Run full test suite**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && npm run test:ci 2>&1 | tail -30
```

Expected: all PASS with coverage.

- [ ] **Step 4.7: Run typecheck and lint**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && npm run typecheck 2>&1 | tail -20 && npm run lint 2>&1 | tail -20
```

Fix any type errors or lint warnings before committing.

- [ ] **Step 4.8: Commit screen refactor**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && git add app/groups/[id].tsx src/__tests__/navigation/group-screens.test.tsx && git commit -m "feat(groups): tabbed group detail screen — Members list and Info (scoring, tournaments, invite)"
```

---

## Task 5: Mark task complete + update docs

- [ ] **Step 5.1: Mark F1-14 as completed in TAREAS.md**

In `TAREAS.md`, change:

```
- [ ] **F1-14** Group detail (members, info)
```

to:

```
- [x] **F1-14** Group detail (members, info)
```

And append a Notes line:

```
  - Notes: Tabbed layout (Members | Info). Service layer adds `fetchGroupMembers()` (group_members→profiles join, sorted by role then joined_at) and `fetchGroupTournaments()` (group_tournaments→tournaments join). `UserGroup` now includes `scoring_system`. `useGroupDetail` fetches all three in parallel via `Promise.all`. `MemberRow` component with letter avatar + role badge. Info tab: scoring 2×2 grid + tournaments list + invite/QR section (moved from root of screen). No DB migration needed (RLS from 00005 already allows member queries).
```

- [ ] **Step 5.2: Commit docs**

```bash
cd /c/Users/Hernan/Documents/GitHub/PencaViva && git add TAREAS.md && git commit -m "docs: mark F1-14 complete"
```

---

## Verification Checklist

Before considering this task done:

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero warnings
- [ ] `npm run test:ci` — all pass with coverage
- [ ] Members tab renders all active members sorted admin first
- [ ] "You" badge on the current user's row
- [ ] Info tab renders scoring grid (4 cells)
- [ ] Info tab renders tournaments or "No tournaments assigned yet."
- [ ] Invite section (code + QR + share) is on the Info tab
- [ ] Tab switching works
- [ ] Loading and error states still render correctly
