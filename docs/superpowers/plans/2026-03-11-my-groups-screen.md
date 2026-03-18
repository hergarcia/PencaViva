# F1-09: "My Groups" Screen Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "My Groups" screen that lists the authenticated user's groups with avatar, name, description, member count, and user role — plus an empty state with CTAs to create or join a group.

**Architecture:** Service layer (`groups-service.ts`) queries Supabase for the user's groups via `group_members` join. The screen (`app/(tabs)/groups/index.tsx`) uses local React state for loading/error/data, renders a `FlatList` of group cards, and navigates to group detail on tap. Empty state shows CTAs that navigate to the existing `create.tsx` and `join.tsx` stub routes.

**Tech Stack:** React Native, Expo Router, Supabase JS, NativeWind v5, Jest + RNTL

---

## File Structure

| Action | Path                                                 | Responsibility                                          |
| ------ | ---------------------------------------------------- | ------------------------------------------------------- |
| Create | `src/lib/groups-service.ts`                          | Supabase queries: fetch user's groups with member count |
| Create | `src/__tests__/lib/groups-service.test.ts`           | Unit tests for groups service                           |
| Create | `src/components/groups/GroupCard.tsx`                | Presentational card component for a single group        |
| Create | `src/__tests__/components/groups/GroupCard.test.tsx` | Unit tests for GroupCard                                |
| Modify | `app/(tabs)/groups/index.tsx`                        | Replace placeholder with full My Groups screen          |
| Create | `src/__tests__/navigation/groups-screen.test.tsx`    | Unit tests for GroupsScreen                             |

---

## Chunk 1: Service Layer

### Task 1: Groups Service — `fetchUserGroups`

**Files:**

- Create: `src/lib/groups-service.ts`
- Create: `src/__tests__/lib/groups-service.test.ts`

#### Step 1: Write types and failing test for fetchUserGroups happy path

Create the test file first. Follow the same Supabase mock chain pattern as `profile-service.test.ts`.

- [ ] **Step 1a: Create test file with mock setup and first test**

```typescript
// src/__tests__/lib/groups-service.test.ts

// ── Mock Supabase with chainable builder ────────────────────────────
const mockChain: Record<string, jest.Mock> = {};
mockChain.select = jest.fn(() => mockChain);
mockChain.eq = jest.fn(() => mockChain);
mockChain.order = jest.fn(() => mockChain);

jest.mock("@lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => mockChain),
  },
}));

// Must import AFTER mock is set up
/* eslint-disable @typescript-eslint/no-require-imports */
const { fetchUserGroups } = require("@lib/groups-service");
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
  mockChain.select = jest.fn(() => mockChain);
  mockChain.eq = jest.fn(() => mockChain);
  mockChain.order = jest.fn(() => mockChain);
});

describe("fetchUserGroups", () => {
  it("returns user groups with member count", async () => {
    mockChain.order.mockReturnValueOnce({
      data: [
        {
          role: "admin",
          group: {
            id: "g1",
            name: "Weekend Warriors",
            description: "Sunday league predictions",
            avatar_url: null,
            invite_code: "abc12345",
            created_by: "user-1",
            group_members: [{ count: 5 }],
          },
        },
      ],
      error: null,
    });

    const result = await fetchUserGroups("user-1");

    expect(result).toEqual([
      {
        id: "g1",
        name: "Weekend Warriors",
        description: "Sunday league predictions",
        avatar_url: null,
        invite_code: "abc12345",
        created_by: "user-1",
        member_count: 5,
        role: "admin",
      },
    ]);
  });

  it("filters by user_id and is_active", async () => {
    mockChain.order.mockReturnValueOnce({ data: [], error: null });

    await fetchUserGroups("user-1");

    expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockChain.eq).toHaveBeenCalledWith("is_active", true);
  });
});
```

- [ ] **Step 1b: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/groups-service.test.ts --no-coverage`
Expected: FAIL — `Cannot find module '@lib/groups-service'`

#### Step 2: Create groups-service with types and fetchUserGroups

- [ ] **Step 2a: Create the service file**

```typescript
// src/lib/groups-service.ts

import { supabase } from "@/lib/supabase";

// ── Types ───────────────────────────────────────────────────────────

export type GroupRole = "admin" | "moderator" | "member";

export type UserGroup = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  invite_code: string;
  created_by: string;
  member_count: number;
  role: GroupRole;
};

// ── Supabase queries ────────────────────────────────────────────────

/**
 * Fetch all groups the user is an active member of.
 * Uses group_members as the base table, joining groups and counting members.
 * Note: member_count includes all members (active + inactive) because PostgREST
 * embedded resource counts cannot be filtered. Acceptable for MVP.
 */
export async function fetchUserGroups(userId: string): Promise<UserGroup[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select(
      `
      role,
      group:groups!inner (
        id,
        name,
        description,
        avatar_url,
        invite_code,
        created_by,
        group_members ( count )
      )
    `,
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("joined_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const group = row.group as Record<string, unknown>;
    const memberCountArr = group.group_members as { count: number }[];
    return {
      id: group.id as string,
      name: group.name as string,
      description: group.description as string | null,
      avatar_url: group.avatar_url as string | null,
      invite_code: group.invite_code as string,
      created_by: group.created_by as string,
      member_count: memberCountArr?.[0]?.count ?? 0,
      role: row.role as GroupRole,
    };
  });
}
```

- [ ] **Step 2b: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/groups-service.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 2c: Commit**

```bash
git add src/lib/groups-service.ts src/__tests__/lib/groups-service.test.ts
git commit -m "feat(groups): add groups-service with fetchUserGroups query"
```

#### Step 3: Add remaining service tests

- [ ] **Step 3a: Add test for empty groups list**

```typescript
it("returns empty array when user has no groups", async () => {
  mockChain.order.mockReturnValueOnce({ data: [], error: null });

  const result = await fetchUserGroups("user-no-groups");
  expect(result).toEqual([]);
});
```

- [ ] **Step 3b: Add test for multiple groups with different roles**

```typescript
it("maps multiple groups with different roles", async () => {
  mockChain.order.mockReturnValueOnce({
    data: [
      {
        role: "admin",
        group: {
          id: "g1",
          name: "Group A",
          description: null,
          avatar_url: "https://example.com/a.png",
          invite_code: "aaa11111",
          created_by: "user-1",
          group_members: [{ count: 10 }],
        },
      },
      {
        role: "member",
        group: {
          id: "g2",
          name: "Group B",
          description: "Fun group",
          avatar_url: null,
          invite_code: "bbb22222",
          created_by: "user-2",
          group_members: [{ count: 3 }],
        },
      },
    ],
    error: null,
  });

  const result = await fetchUserGroups("user-1");

  expect(result).toHaveLength(2);
  expect(result[0].role).toBe("admin");
  expect(result[0].member_count).toBe(10);
  expect(result[1].role).toBe("member");
  expect(result[1].name).toBe("Group B");
});
```

- [ ] **Step 3c: Add test for Supabase error**

```typescript
it("throws on supabase error", async () => {
  mockChain.order.mockReturnValueOnce({
    data: null,
    error: new Error("DB error"),
  });

  await expect(fetchUserGroups("user-1")).rejects.toThrow("DB error");
});
```

- [ ] **Step 3d: Add test for null data fallback**

```typescript
it("returns empty array when data is null", async () => {
  mockChain.order.mockReturnValueOnce({ data: null, error: null });

  const result = await fetchUserGroups("user-1");
  expect(result).toEqual([]);
});
```

- [ ] **Step 3e: Run all tests to verify they pass**

Run: `npx jest src/__tests__/lib/groups-service.test.ts --no-coverage`
Expected: PASS (5 tests)

- [ ] **Step 3f: Commit**

```bash
git add src/__tests__/lib/groups-service.test.ts
git commit -m "test(groups): add edge case tests for fetchUserGroups"
```

---

## Chunk 2: GroupCard Component

### Task 2: GroupCard Presentational Component

**Files:**

- Create: `src/components/groups/GroupCard.tsx`
- Create: `src/__tests__/components/groups/GroupCard.test.tsx`

#### Step 1: Write failing test for GroupCard rendering

- [ ] **Step 1a: Create test file**

```typescript
// src/__tests__/components/groups/GroupCard.test.tsx

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { GroupCard } from "@components/groups/GroupCard";
import type { UserGroup } from "@lib/groups-service";

const baseGroup: UserGroup = {
  id: "g1",
  name: "Weekend Warriors",
  description: "Sunday league predictions",
  avatar_url: null,
  invite_code: "abc12345",
  created_by: "user-1",
  member_count: 5,
  role: "admin",
};

describe("GroupCard", () => {
  it("renders group name", () => {
    const { getByText } = render(
      <GroupCard group={baseGroup} onPress={jest.fn()} />,
    );
    expect(getByText("Weekend Warriors")).toBeTruthy();
  });

  it("renders description when provided", () => {
    const { getByText } = render(
      <GroupCard group={baseGroup} onPress={jest.fn()} />,
    );
    expect(getByText("Sunday league predictions")).toBeTruthy();
  });

  it("renders member count", () => {
    const { getByText } = render(
      <GroupCard group={baseGroup} onPress={jest.fn()} />,
    );
    expect(getByText("5 members")).toBeTruthy();
  });

  it("renders singular 'member' for count of 1", () => {
    const group = { ...baseGroup, member_count: 1 };
    const { getByText } = render(
      <GroupCard group={group} onPress={jest.fn()} />,
    );
    expect(getByText("1 member")).toBeTruthy();
  });

  it("renders role badge for admin", () => {
    const { getByTestId } = render(
      <GroupCard group={baseGroup} onPress={jest.fn()} />,
    );
    expect(getByTestId("role-badge")).toBeTruthy();
  });

  it("does not render role badge for member", () => {
    const group = { ...baseGroup, role: "member" as const };
    const { queryByTestId } = render(
      <GroupCard group={group} onPress={jest.fn()} />,
    );
    expect(queryByTestId("role-badge")).toBeNull();
  });

  it("calls onPress with group id when pressed", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <GroupCard group={baseGroup} onPress={onPress} />,
    );
    fireEvent.press(getByTestId("group-card-g1"));
    expect(onPress).toHaveBeenCalledWith("g1");
  });

  it("renders letter avatar when no avatar_url", () => {
    const { getByText } = render(
      <GroupCard group={baseGroup} onPress={jest.fn()} />,
    );
    expect(getByText("W")).toBeTruthy(); // First letter of "Weekend Warriors"
  });

  it("renders image avatar when avatar_url is provided", () => {
    const group = { ...baseGroup, avatar_url: "https://example.com/a.png" };
    const { getByTestId } = render(
      <GroupCard group={group} onPress={jest.fn()} />,
    );
    expect(getByTestId("group-avatar-image")).toBeTruthy();
  });

  it("does not render description when null", () => {
    const group = { ...baseGroup, description: null };
    const { queryByTestId } = render(
      <GroupCard group={group} onPress={jest.fn()} />,
    );
    expect(queryByTestId("group-description")).toBeNull();
  });
});
```

- [ ] **Step 1b: Run test to verify it fails**

Run: `npx jest src/__tests__/components/groups/GroupCard.test.tsx --no-coverage`
Expected: FAIL — `Cannot find module '@components/groups/GroupCard'`

#### Step 2: Implement GroupCard

- [ ] **Step 2a: Create the component**

```typescript
// src/components/groups/GroupCard.tsx

import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { colors } from "@lib/constants";
import type { UserGroup } from "@lib/groups-service";

type GroupCardProps = {
  group: UserGroup;
  onPress: (groupId: string) => void;
};

export function GroupCard({ group, onPress }: GroupCardProps) {
  const initial = group.name[0]?.toUpperCase() ?? "?";
  const memberLabel =
    group.member_count === 1
      ? `${group.member_count} member`
      : `${group.member_count} members`;
  const showRoleBadge = group.role !== "member";

  return (
    <TouchableOpacity
      testID={`group-card-${group.id}`}
      onPress={() => onPress(group.id)}
      activeOpacity={0.7}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      {/* Avatar */}
      {group.avatar_url ? (
        <Image
          source={{ uri: group.avatar_url }}
          style={{ width: 48, height: 48, borderRadius: 24 }}
          testID="group-avatar-image"
        />
      ) : (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.primary + "20",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: colors.primary,
              fontSize: 20,
              fontWeight: "bold",
            }}
          >
            {initial}
          </Text>
        </View>
      )}

      {/* Content */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
              flex: 1,
            }}
            numberOfLines={1}
          >
            {group.name}
          </Text>
          {showRoleBadge && (
            <View
              testID="role-badge"
              style={{
                backgroundColor: colors.primary + "20",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 8,
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 11,
                  fontWeight: "600",
                  textTransform: "capitalize",
                }}
              >
                {group.role}
              </Text>
            </View>
          )}
        </View>

        {group.description ? (
          <Text
            testID="group-description"
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {group.description}
          </Text>
        ) : null}

        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {memberLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2b: Run test to verify it passes**

Run: `npx jest src/__tests__/components/groups/GroupCard.test.tsx --no-coverage`
Expected: PASS (10 tests)

- [ ] **Step 2c: Commit**

```bash
git add src/components/groups/GroupCard.tsx src/__tests__/components/groups/GroupCard.test.tsx
git commit -m "feat(groups): add GroupCard presentational component with tests"
```

---

## Chunk 3: Groups Screen

### Task 3: My Groups Screen

**Files:**

- Modify: `app/(tabs)/groups/index.tsx`
- Create: `src/__tests__/navigation/groups-screen.test.tsx`

#### Step 1: Write failing tests for the screen

- [ ] **Step 1a: Create test file with mocks and loading state test**

```typescript
// src/__tests__/navigation/groups-screen.test.tsx

import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react-native";

// ── Mocks ────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: jest.fn(),
}));

const mockFetchUserGroups = jest.fn();
jest.mock("@lib/groups-service", () => ({
  fetchUserGroups: (...args: unknown[]) => mockFetchUserGroups(...args),
}));

// Must import AFTER mocks
/* eslint-disable @typescript-eslint/no-require-imports */
const { useAuth } = require("@hooks/use-auth");
const GroupsScreen = require("../../../app/(tabs)/groups/index").default;
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({
    user: { id: "user-1" },
  });
});

describe("GroupsScreen", () => {
  it("shows loading indicator while fetching", () => {
    // Never-resolving promise to keep loading state
    mockFetchUserGroups.mockReturnValue(new Promise(() => {}));

    const { getByTestId } = render(<GroupsScreen />);
    expect(getByTestId("loading-indicator")).toBeTruthy();
  });
});
```

- [ ] **Step 1b: Run test to verify it fails**

Run: `npx jest src/__tests__/navigation/groups-screen.test.tsx --no-coverage`
Expected: FAIL — screen doesn't have loading indicator yet

#### Step 2: Add tests for all screen states

- [ ] **Step 2a: Add test for groups list rendering**

```typescript
  it("renders list of groups after loading", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([
      {
        id: "g1",
        name: "Test Group",
        description: "A test group",
        avatar_url: null,
        invite_code: "abc12345",
        created_by: "user-1",
        member_count: 3,
        role: "admin",
      },
    ]);

    const { getByText, queryByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(queryByTestId("loading-indicator")).toBeNull();
    });

    expect(getByText("Test Group")).toBeTruthy();
  });
```

- [ ] **Step 2b: Add test for empty state**

```typescript
  it("shows empty state when user has no groups", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([]);

    const { getByTestId, getByText } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("empty-state")).toBeTruthy();
    });

    expect(getByText("No groups yet")).toBeTruthy();
  });
```

- [ ] **Step 2c: Add test for error state with retry**

```typescript
  it("shows error state with retry button on fetch failure", async () => {
    mockFetchUserGroups.mockRejectedValueOnce(new Error("Network error"));

    const { getByTestId, getByText } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("error-message")).toBeTruthy();
    });

    expect(getByText("Failed to load groups.")).toBeTruthy();
    expect(getByTestId("retry-button")).toBeTruthy();
  });

  it("retries fetch when retry button is pressed", async () => {
    mockFetchUserGroups
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce([]);

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("retry-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("retry-button"));

    await waitFor(() => {
      expect(mockFetchUserGroups).toHaveBeenCalledTimes(2);
    });
  });
```

- [ ] **Step 2d: Add test for navigation to group detail**

```typescript
  it("navigates to group detail when card is pressed", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([
      {
        id: "g1",
        name: "Test Group",
        description: null,
        avatar_url: null,
        invite_code: "abc12345",
        created_by: "user-1",
        member_count: 2,
        role: "member",
      },
    ]);

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("group-card-g1")).toBeTruthy();
    });

    fireEvent.press(getByTestId("group-card-g1"));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/g1");
  });
```

- [ ] **Step 2e: Add test for Create Group button navigation**

```typescript
  it("navigates to create group screen when create button is pressed", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([]);

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("create-group-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("create-group-button"));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/create");
  });
```

- [ ] **Step 2f: Add test for Join Group button navigation**

```typescript
  it("navigates to join group screen when join button is pressed", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([]);

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("join-group-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("join-group-button"));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/join");
  });
```

- [ ] **Step 2g: Add test for null user guard**

```typescript
  it("returns null when user is not authenticated", () => {
    useAuth.mockReturnValue({ user: null });

    const { toJSON } = render(<GroupsScreen />);
    expect(toJSON()).toBeNull();
  });
```

- [ ] **Step 2h: Add test for header create button (when groups exist)**

```typescript
  it("shows header create button when groups exist", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([
      {
        id: "g1",
        name: "Test Group",
        description: null,
        avatar_url: null,
        invite_code: "abc12345",
        created_by: "user-1",
        member_count: 2,
        role: "member",
      },
    ]);

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("header-create-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("header-create-button"));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/create");
  });
```

- [ ] **Step 2i: Run all tests to verify they fail**

Run: `npx jest src/__tests__/navigation/groups-screen.test.tsx --no-coverage`
Expected: FAIL — screen is still placeholder

#### Step 3: Implement the Groups screen

- [ ] **Step 3a: Replace placeholder with full implementation**

```typescript
// app/(tabs)/groups/index.tsx

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@hooks/use-auth";
import { fetchUserGroups } from "@lib/groups-service";
import { colors } from "@lib/constants";
import { GroupCard } from "@components/groups/GroupCard";
import type { UserGroup } from "@lib/groups-service";

export default function GroupsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await fetchUserGroups(user.id);
      setGroups(data);
    } catch {
      setFetchError("Failed to load groups.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleGroupPress = useCallback(
    (groupId: string) => {
      router.push(`/(tabs)/groups/${groupId}`);
    },
    [router],
  );

  const handleCreateGroup = useCallback(() => {
    router.push("/(tabs)/groups/create");
  }, [router]);

  const handleJoinGroup = useCallback(() => {
    router.push("/(tabs)/groups/join");
  }, [router]);

  // ── Guards ──────────────────────────────────────────────────────

  if (!user) return null;

  // ── Loading state ───────────────────────────────────────────────

  if (isLoading) {
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
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator
            size="large"
            color={colors.primary}
            testID="loading-indicator"
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ─────────────────────────────────────────────────

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
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <Text
            style={{ color: colors.textPrimary, textAlign: "center" }}
            testID="error-message"
          >
            {fetchError}
          </Text>
          <TouchableOpacity
            onPress={loadGroups}
            style={{ marginTop: 16 }}
            testID="retry-button"
          >
            <Text style={{ color: colors.primary }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────

  if (groups.length === 0) {
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
        <View
          testID="empty-state"
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Ionicons
            name="people-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 20,
              fontWeight: "bold",
              marginTop: 16,
            }}
          >
            No groups yet
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: 8,
              lineHeight: 20,
            }}
          >
            Create a group to start predicting with friends, or join one with an
            invite code.
          </Text>

          <TouchableOpacity
            testID="create-group-button"
            onPress={handleCreateGroup}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 32,
              marginTop: 24,
              width: "100%",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.background,
                fontWeight: "bold",
                fontSize: 16,
              }}
            >
              Create Group
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="join-group-button"
            onPress={handleJoinGroup}
            style={{
              borderColor: colors.surfaceBorder,
              borderWidth: 1,
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 32,
              marginTop: 12,
              width: "100%",
              alignItems: "center",
            }}
          >
            <Text
              style={{ color: colors.textPrimary, fontWeight: "bold", fontSize: 16 }}
            >
              Join Group
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Groups list ─────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      testID="groups-screen"
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 24,
          paddingBottom: 12,
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 28,
            fontWeight: "bold",
          }}
        >
          My Groups
        </Text>
        <TouchableOpacity
          testID="header-create-button"
          onPress={handleCreateGroup}
          style={{
            backgroundColor: colors.primary + "20",
            borderRadius: 20,
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GroupCard group={item} onPress={handleGroupPress} />
        )}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        testID="groups-list"
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3b: Run tests to verify they pass**

Run: `npx jest src/__tests__/navigation/groups-screen.test.tsx --no-coverage`
Expected: PASS (10 tests)

- [ ] **Step 3c: Commit**

```bash
git add app/(tabs)/groups/index.tsx src/__tests__/navigation/groups-screen.test.tsx
git commit -m "feat(groups): implement My Groups screen with list, empty, error states"
```

---

## Chunk 4: Quality Checks & Documentation

### Task 4: Full CI Checks and Documentation Updates

**Files:**

- Modify: `TAREAS.md` (mark F1-09 complete, update progress table)

#### Step 1: Run full CI checks

- [ ] **Step 1a: Run all tests**

Run: `npm run test:ci`
Expected: All tests pass

- [ ] **Step 1b: Run linter**

Run: `npm run lint`
Expected: No errors (warnings OK)

- [ ] **Step 1c: Run formatter check**

Run: `npm run format:check`
Expected: All files formatted

- [ ] **Step 1d: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 1e: Fix any issues found**

If any check fails, fix the issue and re-run.

#### Step 2: Update documentation

- [ ] **Step 2a: Update TAREAS.md**

Mark F1-09 as completed `[x]`, add notes, update progress table.

- [ ] **Step 2b: Update CLAUDE.md if needed**

Add any new patterns or files to the project structure section if relevant.

- [ ] **Step 2c: Commit documentation**

```bash
git add TAREAS.md
git commit -m "docs: mark F1-09 complete, update progress"
```

#### Step 3: Create PR

- [ ] **Step 3a: Push branch and create PR to develop**

```bash
git push -u origin feature/F1-09-my-groups-screen
gh pr create --base develop --title "feat: My Groups screen (F1-09)" --body "..."
```
