import { renderHook, waitFor } from "@testing-library/react-native";

// ── Mocks ─────────────────────────────────────────────────────────────

const mockFetchGroupLeaderboard = jest.fn();
jest.mock("@lib/leaderboard-service", () => ({
  fetchGroupLeaderboard: (...args: unknown[]) =>
    mockFetchGroupLeaderboard(...args),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ isInitialized: true }),
}));

// Realtime channel mock
let capturedChannelCallback: ((payload: unknown) => void) | null = null;
let mockSubscribeStatus = "SUBSCRIBED";

const mockChannelInstance = {
  on: jest
    .fn()
    .mockImplementation(
      (
        _event: string,
        _filter: unknown,
        callback: (payload: unknown) => void,
      ) => {
        capturedChannelCallback = callback;
        return mockChannelInstance;
      },
    ),
  subscribe: jest.fn().mockImplementation((cb?: (status: string) => void) => {
    if (cb) cb(mockSubscribeStatus);
    return mockChannelInstance;
  }),
};

const mockChannel = jest.fn((_name: string) => mockChannelInstance);
const mockRemoveChannel = jest.fn((_ch: unknown) => {});

jest.mock("@lib/supabase", () => ({
  supabase: {
    channel: (name: string) => mockChannel(name),
    removeChannel: (ch: unknown) => mockRemoveChannel(ch),
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { useGroupLeaderboard } = require("@hooks/use-group-leaderboard");
/* eslint-enable @typescript-eslint/no-require-imports */

// ── Fixtures ──────────────────────────────────────────────────────────

const makeEntries = () => [
  {
    id: "lb1",
    group_id: "g1",
    user_id: "u1",
    total_points: 42,
    position: 1,
    matches_played: 10,
    exact_scores: 3,
    correct_results: 7,
    display_name: "Alice",
    username: "alice",
    avatar_url: null,
  },
];

// ── Tests ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  capturedChannelCallback = null;
  mockSubscribeStatus = "SUBSCRIBED";
  mockChannelInstance.on.mockImplementation(
    (
      _event: string,
      _filter: unknown,
      callback: (payload: unknown) => void,
    ) => {
      capturedChannelCallback = callback;
      return mockChannelInstance;
    },
  );
  mockChannelInstance.subscribe.mockImplementation(
    (cb?: (status: string) => void) => {
      if (cb) cb(mockSubscribeStatus);
      return mockChannelInstance;
    },
  );
});

describe("useGroupLeaderboard", () => {
  it("fetches leaderboard on mount", async () => {
    mockFetchGroupLeaderboard.mockResolvedValue(makeEntries());

    const { result } = renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].display_name).toBe("Alice");
  });

  it("returns empty entries when groupId is null", async () => {
    const { result } = renderHook(() => useGroupLeaderboard(null));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.entries).toEqual([]);
    expect(mockFetchGroupLeaderboard).not.toHaveBeenCalled();
  });

  it("sets error on fetch failure", async () => {
    mockFetchGroupLeaderboard.mockRejectedValue(new Error("DB error"));

    const { result } = renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("DB error");
    expect(result.current.entries).toEqual([]);
  });

  it("sets up a realtime channel subscription for the group", async () => {
    mockFetchGroupLeaderboard.mockResolvedValue([]);

    renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() => expect(mockChannel).toHaveBeenCalled());

    expect(mockChannel).toHaveBeenCalledWith(
      expect.stringContaining("leaderboard"),
    );
    expect(mockChannelInstance.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "*",
        schema: "public",
        table: "leaderboard_cache",
        filter: "group_id=eq.g1",
      }),
      expect.any(Function),
    );
    expect(mockChannelInstance.subscribe).toHaveBeenCalled();
  });

  it("does not set up subscription when groupId is null", async () => {
    renderHook(() => useGroupLeaderboard(null));

    expect(mockChannel).not.toHaveBeenCalled();
  });

  it("refetches when a realtime event is received", async () => {
    mockFetchGroupLeaderboard.mockResolvedValue(makeEntries());

    renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() =>
      expect(mockFetchGroupLeaderboard).toHaveBeenCalledTimes(1),
    );
    expect(capturedChannelCallback).not.toBeNull();

    // Simulate a realtime UPDATE event
    capturedChannelCallback!({ eventType: "UPDATE", new: {}, old: {} });

    await waitFor(() =>
      expect(mockFetchGroupLeaderboard).toHaveBeenCalledTimes(2),
    );
  });

  it("cleans up the channel on unmount", async () => {
    mockFetchGroupLeaderboard.mockResolvedValue([]);

    const { unmount } = renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() => expect(mockChannel).toHaveBeenCalled());

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannelInstance);
  });

  it("resubscribes when groupId changes", async () => {
    mockFetchGroupLeaderboard.mockResolvedValue([]);

    const { rerender } = renderHook(
      ({ groupId }: { groupId: string }) => useGroupLeaderboard(groupId),
      { initialProps: { groupId: "g1" } },
    );

    await waitFor(() => expect(mockChannel).toHaveBeenCalledTimes(1));

    rerender({ groupId: "g2" });

    await waitFor(() => expect(mockChannel).toHaveBeenCalledTimes(2));
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannelInstance);
  });

  it("refetch function works manually", async () => {
    mockFetchGroupLeaderboard.mockResolvedValue(makeEntries());

    const { result } = renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchGroupLeaderboard).toHaveBeenCalledTimes(1);

    await result.current.refetch();

    expect(mockFetchGroupLeaderboard).toHaveBeenCalledTimes(2);
  });
});
