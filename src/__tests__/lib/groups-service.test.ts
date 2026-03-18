// ── Mock Supabase with chainable builder ────────────────────────────
const mockChain: Record<string, jest.Mock> = {};
mockChain.select = jest.fn(() => mockChain);
mockChain.eq = jest.fn(() => mockChain);
mockChain.order = jest.fn(() => mockChain);
mockChain.insert = jest.fn(() => mockChain);
mockChain.delete = jest.fn(() => mockChain);
mockChain.in = jest.fn(() => mockChain);
mockChain.single = jest.fn(() => mockChain);

const mockRpc = jest.fn();
const mockGetUser = jest.fn();

jest.mock("@lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => mockChain),
    rpc: mockRpc,
    auth: { getUser: mockGetUser },
  },
}));

// Must import AFTER mock is set up
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  fetchUserGroups,
  createGroup,
  fetchActiveTournaments,
  fetchGroupById,
  lookupGroupByInviteCode,
  joinGroupByCode,
  fetchGroupMembers,
  fetchGroupTournaments,
  updateGroupTournaments,
} = require("@lib/groups-service");
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
  mockChain.select = jest.fn(() => mockChain);
  mockChain.eq = jest.fn(() => mockChain);
  mockChain.order = jest.fn(() => mockChain);
  mockChain.insert = jest.fn(() => mockChain);
  mockChain.delete = jest.fn(() => mockChain);
  mockChain.in = jest.fn(() => mockChain);
  mockChain.single = jest.fn(() => mockChain);
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
            scoring_system: {
              exact_score: 5,
              correct_result: 3,
              correct_goal_diff: 1,
              wrong: 0,
            },
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
        scoring_system: {
          exact_score: 5,
          correct_result: 3,
          correct_goal_diff: 1,
          wrong: 0,
        },
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

  it("returns empty array when user has no groups", async () => {
    mockChain.order.mockReturnValueOnce({ data: [], error: null });

    const result = await fetchUserGroups("user-no-groups");
    expect(result).toEqual([]);
  });

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
            scoring_system: {
              exact_score: 5,
              correct_result: 3,
              correct_goal_diff: 1,
              wrong: 0,
            },
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
            scoring_system: {
              exact_score: 5,
              correct_result: 3,
              correct_goal_diff: 1,
              wrong: 0,
            },
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

  it("throws on supabase error", async () => {
    mockChain.order.mockReturnValueOnce({
      data: null,
      error: new Error("DB error"),
    });

    await expect(fetchUserGroups("user-1")).rejects.toThrow("DB error");
  });

  it("returns empty array when data is null", async () => {
    mockChain.order.mockReturnValueOnce({ data: null, error: null });

    const result = await fetchUserGroups("user-1");
    expect(result).toEqual([]);
  });
});

describe("createGroup", () => {
  const scoringSystem = {
    exact_score: 5,
    correct_result: 3,
    correct_goal_diff: 1,
    wrong: 0,
  };

  it("calls rpc and returns created group data", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ id: "g-1", name: "Test Group", invite_code: "ABC123" }],
      error: null,
    });

    const result = await createGroup("user-1", {
      name: "Test Group",
      scoring_system: scoringSystem,
    });

    expect(result).toEqual({
      id: "g-1",
      name: "Test Group",
      invite_code: "ABC123",
    });
    expect(mockRpc).toHaveBeenCalledWith("create_group_for_user", {
      p_name: "Test Group",
      p_description: null,
      p_scoring_system: scoringSystem,
      p_tournament_ids: null,
    });
  });

  it("throws when rpc returns an error", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: new Error("DB error"),
    });

    await expect(
      createGroup("user-1", {
        name: "Test Group",
        scoring_system: scoringSystem,
      }),
    ).rejects.toThrow("DB error");
  });

  it("throws when rpc returns empty data", async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    await expect(
      createGroup("user-1", {
        name: "Test Group",
        scoring_system: scoringSystem,
      }),
    ).rejects.toThrow("Failed to create group");
  });

  it("passes tournament_ids when provided", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ id: "g-1", name: "Test Group", invite_code: "ABC123" }],
      error: null,
    });

    await createGroup("user-1", {
      name: "Test Group",
      scoring_system: scoringSystem,
      tournament_ids: ["t-1", "t-2"],
    });

    expect(mockRpc).toHaveBeenCalledWith("create_group_for_user", {
      p_name: "Test Group",
      p_description: null,
      p_scoring_system: scoringSystem,
      p_tournament_ids: ["t-1", "t-2"],
    });
  });

  it("passes null tournament_ids when none provided", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ id: "g-1", name: "Test Group", invite_code: "ABC123" }],
      error: null,
    });

    await createGroup("user-1", {
      name: "Test Group",
      scoring_system: scoringSystem,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "create_group_for_user",
      expect.objectContaining({ p_tournament_ids: null }),
    );
  });
});

describe("fetchActiveTournaments", () => {
  it("returns tournament array", async () => {
    const tournaments = [
      { id: "t-1", name: "Premier League", short_name: "PL", logo_url: null },
    ];
    mockChain.order.mockReturnValueOnce({ data: tournaments, error: null });

    const result = await fetchActiveTournaments();

    expect(result).toEqual(tournaments);
  });

  it("returns empty array when data is null", async () => {
    mockChain.order.mockReturnValueOnce({ data: null, error: null });

    const result = await fetchActiveTournaments();

    expect(result).toEqual([]);
  });

  it("throws on DB error", async () => {
    mockChain.order.mockReturnValueOnce({
      data: null,
      error: new Error("DB error"),
    });

    await expect(fetchActiveTournaments()).rejects.toThrow("DB error");
  });
});

describe("fetchGroupById", () => {
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

  it("returns UserGroup on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockChain.single.mockResolvedValueOnce({
      data: { role: "admin", group: fakeGroup },
      error: null,
    });

    const result = await fetchGroupById("g1");

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
  });

  it("filters by group_id and is_active", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockChain.single.mockResolvedValueOnce({
      data: { role: "member", group: fakeGroup },
      error: null,
    });

    await fetchGroupById("g1");

    expect(mockChain.eq).toHaveBeenCalledWith("group_id", "g1");
    expect(mockChain.eq).toHaveBeenCalledWith("is_active", true);
  });

  it("throws 'Not authenticated' when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    await expect(fetchGroupById("g1")).rejects.toThrow("Not authenticated");
  });

  it("throws on Supabase error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockChain.single.mockResolvedValueOnce({
      data: null,
      error: new Error("DB error"),
    });

    await expect(fetchGroupById("g1")).rejects.toThrow("DB error");
  });
});

describe("fetchGroupMembers", () => {
  it("returns members sorted admin first then joined_at", async () => {
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
    mockRpc.mockResolvedValueOnce({ data: [preview], error: null });

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
      data: [{ id: "g-1", name: "Test Group", invite_code: "ABC12345" }],
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

describe("updateGroupTournaments", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { supabase } = require("@lib/supabase");
  /* eslint-enable @typescript-eslint/no-require-imports */

  beforeEach(() => {
    // Reset from() to return different chains for different tables
    (supabase.from as jest.Mock).mockImplementation(() => mockChain);
  });

  it("inserts new tournaments and deletes removed ones", async () => {
    // Current tournaments: t1, t2. New desired: t2, t3.
    // Should delete t1 and insert t3.
    mockChain.order.mockReturnValueOnce({
      data: [
        {
          tournament: {
            id: "t1",
            name: "T1",
            short_name: null,
            logo_url: null,
          },
        },
        {
          tournament: {
            id: "t2",
            name: "T2",
            short_name: null,
            logo_url: null,
          },
        },
      ],
      error: null,
    });

    // delete returns
    mockChain.in.mockResolvedValueOnce({ error: null });
    // insert returns
    mockChain.insert.mockResolvedValueOnce({ error: null });

    await updateGroupTournaments("g1", ["t2", "t3"]);

    // Should have called from("group_tournaments") for fetching, deleting, and inserting
    expect(supabase.from).toHaveBeenCalledWith("group_tournaments");
  });

  it("only inserts when no tournaments to remove", async () => {
    mockChain.order.mockReturnValueOnce({
      data: [],
      error: null,
    });

    mockChain.insert.mockResolvedValueOnce({ error: null });

    await updateGroupTournaments("g1", ["t1"]);

    expect(mockChain.insert).toHaveBeenCalledWith([
      { group_id: "g1", tournament_id: "t1" },
    ]);
    // delete should not be called (no removals)
    expect(mockChain.delete).not.toHaveBeenCalled();
  });

  it("only deletes when removing all tournaments", async () => {
    mockChain.order.mockReturnValueOnce({
      data: [
        {
          tournament: {
            id: "t1",
            name: "T1",
            short_name: null,
            logo_url: null,
          },
        },
      ],
      error: null,
    });

    mockChain.in.mockResolvedValueOnce({ error: null });

    await updateGroupTournaments("g1", []);

    expect(mockChain.delete).toHaveBeenCalled();
    expect(mockChain.insert).not.toHaveBeenCalled();
  });

  it("does nothing when there are no changes", async () => {
    mockChain.order.mockReturnValueOnce({
      data: [
        {
          tournament: {
            id: "t1",
            name: "T1",
            short_name: null,
            logo_url: null,
          },
        },
      ],
      error: null,
    });

    await updateGroupTournaments("g1", ["t1"]);

    expect(mockChain.delete).not.toHaveBeenCalled();
    expect(mockChain.insert).not.toHaveBeenCalled();
  });

  it("throws when delete fails", async () => {
    mockChain.order.mockReturnValueOnce({
      data: [
        {
          tournament: {
            id: "t1",
            name: "T1",
            short_name: null,
            logo_url: null,
          },
        },
      ],
      error: null,
    });

    mockChain.in.mockResolvedValueOnce({ error: new Error("RLS violation") });

    await expect(updateGroupTournaments("g1", [])).rejects.toThrow(
      "RLS violation",
    );
  });

  it("throws when insert fails", async () => {
    mockChain.order.mockReturnValueOnce({
      data: [],
      error: null,
    });

    mockChain.insert.mockResolvedValueOnce({
      error: new Error("Duplicate key"),
    });

    await expect(updateGroupTournaments("g1", ["t1"])).rejects.toThrow(
      "Duplicate key",
    );
  });
});
