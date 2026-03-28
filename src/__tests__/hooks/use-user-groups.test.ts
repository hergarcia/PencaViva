import { renderHook, waitFor, act } from "@testing-library/react-native";
import { useUserGroups } from "@hooks/use-user-groups";

const mockFetchUserGroups = jest.fn();
jest.mock("@lib/groups-service", () => ({
  fetchUserGroups: (...args: unknown[]) => mockFetchUserGroups(...args),
}));

jest.mock("@lib/retry");

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, isInitialized: true }),
}));

beforeEach(() => jest.clearAllMocks());

describe("useUserGroups", () => {
  it("returns isLoading=true initially", () => {
    mockFetchUserGroups.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useUserGroups());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isRefreshing).toBe(false);
  });

  it("returns groups after load", async () => {
    const groups = [{ id: "g1", name: "Test" }];
    mockFetchUserGroups.mockResolvedValueOnce(groups);
    const { result } = renderHook(() => useUserGroups());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.groups).toEqual(groups);
    expect(result.current.error).toBeNull();
  });

  it("returns error on fetch failure", async () => {
    mockFetchUserGroups.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useUserGroups());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Network error");
  });

  it("sets isRefreshing during refetch", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useUserGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolve!: (v: never[]) => void;
    mockFetchUserGroups.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );

    await act(async () => {
      result.current.refetch();
    });
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      resolve([]);
    });
    expect(result.current.isRefreshing).toBe(false);
  });
});
