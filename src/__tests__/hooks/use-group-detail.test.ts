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

  it("refetch re-fetches all data", async () => {
    useAuth.mockReturnValue({ user: { id: "u1" }, isInitialized: true });
    fetchGroupById.mockResolvedValue(fakeGroup);
    fetchGroupMembers.mockResolvedValue(fakeMembers);
    fetchGroupTournaments.mockResolvedValue(fakeTournaments);

    const { result } = renderHook(() => useGroupDetail("g1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchGroupById).toHaveBeenCalledTimes(1);

    // Trigger refetch
    const updatedTournaments = [
      ...fakeTournaments,
      { id: "t2", name: "La Liga", short_name: "LL", logo_url: null },
    ];
    fetchGroupTournaments.mockResolvedValue(updatedTournaments);

    await result.current.refetch();

    await waitFor(() =>
      expect(result.current.tournaments).toEqual(updatedTournaments),
    );
    expect(fetchGroupById).toHaveBeenCalledTimes(2);
  });
});
