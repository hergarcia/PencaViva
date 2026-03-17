import { renderHook, waitFor } from "@testing-library/react-native";
import type { UserGroup } from "@lib/groups-service";

jest.mock("@lib/groups-service", () => ({
  fetchGroupById: jest.fn(),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { useGroupDetail } = require("@hooks/use-group-detail");
const { fetchGroupById } = require("@lib/groups-service");
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
  scoring_system: {
    exact_score: 5,
    correct_result: 3,
    correct_goal_diff: 1,
    wrong: 0,
  },
  role: "admin",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useGroupDetail", () => {
  it("returns group on success", async () => {
    useAuth.mockReturnValue({ user: { id: "u1" }, isInitialized: true });
    fetchGroupById.mockResolvedValueOnce(fakeGroup);

    const { result } = renderHook(() => useGroupDetail("g1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.group).toEqual(fakeGroup);
    expect(result.current.error).toBeNull();
    expect(fetchGroupById).toHaveBeenCalledWith("g1");
  });

  it("does not fetch while isInitialized is false", () => {
    useAuth.mockReturnValue({ user: null, isInitialized: false });

    renderHook(() => useGroupDetail("g1"));

    expect(fetchGroupById).not.toHaveBeenCalled();
  });

  it("sets loading false and group null when initialized but no user", async () => {
    useAuth.mockReturnValue({ user: null, isInitialized: true });

    const { result } = renderHook(() => useGroupDetail("g1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.group).toBeNull();
    expect(result.current.error).toBeNull();
    expect(fetchGroupById).not.toHaveBeenCalled();
  });

  it("sets error on fetch failure", async () => {
    useAuth.mockReturnValue({ user: { id: "u1" }, isInitialized: true });
    fetchGroupById.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useGroupDetail("g1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network error");
    expect(result.current.group).toBeNull();
  });
});
