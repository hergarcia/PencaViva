import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useGroupStore } from "@stores/group-store";

// Import after mocks
import { useActiveGroup } from "@hooks/use-active-group";

// Mock groups-service
const mockFetchUserGroups = jest.fn();
jest.mock("@lib/groups-service", () => ({
  fetchUserGroups: (...args: unknown[]) => mockFetchUserGroups(...args),
}));

// Mock use-auth
const mockUseAuth = jest.fn();
jest.mock("@hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useGroupStore.setState({ activeGroupId: null });
  mockUseAuth.mockReturnValue({ user: { id: "user-1" }, isInitialized: true });
});

describe("useActiveGroup", () => {
  it("fetches groups and sets first as active when activeGroupId is null", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([
      { id: "g1", name: "Group A" },
      { id: "g2", name: "Group B" },
    ]);

    const { result } = renderHook(() => useActiveGroup());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activeGroupId).toBe("g1");
    expect(result.current.groups).toHaveLength(2);
  });

  it("does not refetch when activeGroupId is already set", async () => {
    useGroupStore.setState({ activeGroupId: "g2" });
    mockFetchUserGroups.mockResolvedValueOnce([
      { id: "g1", name: "Group A" },
      { id: "g2", name: "Group B" },
    ]);

    const { result } = renderHook(() => useActiveGroup());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Still fetches groups for the selector, but doesn't override active
    expect(result.current.activeGroupId).toBe("g2");
  });

  it("returns empty groups when user has none", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useActiveGroup());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.groups).toEqual([]);
    expect(result.current.activeGroupId).toBeNull();
  });

  it("allows changing active group", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([
      { id: "g1", name: "Group A" },
      { id: "g2", name: "Group B" },
    ]);

    const { result } = renderHook(() => useActiveGroup());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setActiveGroupId("g2");
    });

    expect(result.current.activeGroupId).toBe("g2");
  });
});
