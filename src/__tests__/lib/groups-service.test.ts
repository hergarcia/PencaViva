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
