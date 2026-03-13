// ── Mock Supabase with chainable builder ────────────────────────────
const mockChain: Record<string, jest.Mock> = {};
mockChain.select = jest.fn(() => mockChain);
mockChain.eq = jest.fn(() => mockChain);
mockChain.order = jest.fn(() => mockChain);
mockChain.insert = jest.fn(() => mockChain);
mockChain.single = jest.fn(() => mockChain);

jest.mock("@lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => mockChain),
  },
}));

// Must import AFTER mock is set up
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  fetchUserGroups,
  createGroup,
  fetchActiveTournaments,
} = require("@lib/groups-service");
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
  mockChain.select = jest.fn(() => mockChain);
  mockChain.eq = jest.fn(() => mockChain);
  mockChain.order = jest.fn(() => mockChain);
  mockChain.insert = jest.fn(() => mockChain);
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

  it("inserts group and member, returns created group data", async () => {
    mockChain.single.mockReturnValueOnce({
      data: { id: "g-1", name: "Test Group", invite_code: "ABC123" },
      error: null,
    });
    mockChain.insert
      .mockReturnValueOnce(mockChain) // groups insert → chain continues to .select().single()
      .mockReturnValueOnce({ error: null }); // group_members insert → terminates

    const result = await createGroup("user-1", {
      name: "Test Group",
      scoring_system: scoringSystem,
    });

    expect(result).toEqual({
      id: "g-1",
      name: "Test Group",
      invite_code: "ABC123",
    });
  });

  it("throws when group INSERT fails and does not insert member", async () => {
    mockChain.single.mockReturnValueOnce({
      data: null,
      error: new Error("DB error"),
    });
    mockChain.insert.mockReturnValueOnce(mockChain); // groups insert → chain for .select().single()

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require("@lib/supabase");

    await expect(
      createGroup("user-1", {
        name: "Test Group",
        scoring_system: scoringSystem,
      }),
    ).rejects.toThrow("DB error");

    // Only called once: for 'groups'. Not for 'group_members'.
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith("groups");
  });

  it("throws when member INSERT fails", async () => {
    mockChain.single.mockReturnValueOnce({
      data: { id: "g-1", name: "Test Group", invite_code: "ABC123" },
      error: null,
    });
    mockChain.insert
      .mockReturnValueOnce(mockChain) // groups insert → chain continues
      .mockReturnValueOnce({ error: new Error("Member error") }); // group_members insert → error

    await expect(
      createGroup("user-1", {
        name: "Test Group",
        scoring_system: scoringSystem,
      }),
    ).rejects.toThrow("Member error");
  });

  it("calls from('group_tournaments').insert when tournament_ids provided", async () => {
    mockChain.single.mockReturnValueOnce({
      data: { id: "g-1", name: "Test Group", invite_code: "ABC123" },
      error: null,
    });
    mockChain.insert
      .mockReturnValueOnce(mockChain) // groups insert
      .mockReturnValueOnce({ error: null }) // group_members insert
      .mockReturnValueOnce({ error: null }); // group_tournaments insert

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require("@lib/supabase");

    await createGroup("user-1", {
      name: "Test Group",
      scoring_system: scoringSystem,
      tournament_ids: ["t-1", "t-2"],
    });

    expect(supabase.from).toHaveBeenCalledWith("group_tournaments");
  });

  it("calls from() exactly twice when no tournament_ids provided", async () => {
    mockChain.single.mockReturnValueOnce({
      data: { id: "g-1", name: "Test Group", invite_code: "ABC123" },
      error: null,
    });
    mockChain.insert
      .mockReturnValueOnce(mockChain) // groups insert
      .mockReturnValueOnce({ error: null }); // group_members insert

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require("@lib/supabase");

    await createGroup("user-1", {
      name: "Test Group",
      scoring_system: scoringSystem,
    });

    expect(supabase.from).toHaveBeenCalledTimes(2);
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
