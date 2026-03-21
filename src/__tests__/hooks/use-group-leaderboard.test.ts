import { act, renderHook, waitFor } from "@testing-library/react-native";

// ── Mocks ─────────────────────────────────────────────────────────────

const mockFetchGroupLeaderboardFiltered = jest.fn();
jest.mock("@lib/leaderboard-service", () => ({
  fetchGroupLeaderboardFiltered: (...args: unknown[]) =>
    mockFetchGroupLeaderboardFiltered(...args),
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

const makeEntries = (positions?: number[]) =>
  (positions ?? [1]).map((pos) => ({
    id: `lb${pos}`,
    group_id: "g1",
    user_id: `u${pos}`,
    total_points: 100 - pos * 10,
    position: pos,
    matches_played: 10,
    exact_scores: 3,
    correct_results: 7,
    display_name: `User ${pos}`,
    username: `user${pos}`,
    avatar_url: null,
  }));

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
    mockFetchGroupLeaderboardFiltered.mockResolvedValue(makeEntries());

    const { result } = renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].display_name).toBe("User 1");
  });

  it("returns empty entries when groupId is null", async () => {
    const { result } = renderHook(() => useGroupLeaderboard(null));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.entries).toEqual([]);
    expect(mockFetchGroupLeaderboardFiltered).not.toHaveBeenCalled();
  });

  it("sets error on fetch failure", async () => {
    mockFetchGroupLeaderboardFiltered.mockRejectedValue(new Error("DB error"));

    const { result } = renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("DB error");
    expect(result.current.entries).toEqual([]);
  });

  it("passes filter to fetchGroupLeaderboardFiltered", async () => {
    mockFetchGroupLeaderboardFiltered.mockResolvedValue([]);

    renderHook(() => useGroupLeaderboard("g1", "week"));

    await waitFor(() =>
      expect(mockFetchGroupLeaderboardFiltered).toHaveBeenCalledWith(
        "g1",
        "week",
      ),
    );
  });

  it("defaults to overall filter", async () => {
    mockFetchGroupLeaderboardFiltered.mockResolvedValue([]);

    renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() =>
      expect(mockFetchGroupLeaderboardFiltered).toHaveBeenCalledWith(
        "g1",
        "overall",
      ),
    );
  });

  it("sets up a realtime channel subscription for the group (overall filter)", async () => {
    mockFetchGroupLeaderboardFiltered.mockResolvedValue([]);

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

  it("does not set up realtime subscription for non-overall filters", async () => {
    mockFetchGroupLeaderboardFiltered.mockResolvedValue([]);

    renderHook(() => useGroupLeaderboard("g1", "week"));

    await waitFor(() =>
      expect(mockFetchGroupLeaderboardFiltered).toHaveBeenCalled(),
    );

    expect(mockChannel).not.toHaveBeenCalled();
  });

  it("refetches when a realtime event is received", async () => {
    mockFetchGroupLeaderboardFiltered.mockResolvedValue(makeEntries());

    renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() =>
      expect(mockFetchGroupLeaderboardFiltered).toHaveBeenCalledTimes(1),
    );
    expect(capturedChannelCallback).not.toBeNull();

    // Simulate a realtime UPDATE event
    capturedChannelCallback!({ eventType: "UPDATE", new: {}, old: {} });

    await waitFor(() =>
      expect(mockFetchGroupLeaderboardFiltered).toHaveBeenCalledTimes(2),
    );
  });

  it("cleans up the channel on unmount", async () => {
    mockFetchGroupLeaderboardFiltered.mockResolvedValue([]);

    const { unmount } = renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() => expect(mockChannel).toHaveBeenCalled());

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannelInstance);
  });

  it("resubscribes when groupId changes", async () => {
    mockFetchGroupLeaderboardFiltered.mockResolvedValue([]);

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
    mockFetchGroupLeaderboardFiltered.mockResolvedValue(makeEntries());

    const { result } = renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchGroupLeaderboardFiltered).toHaveBeenCalledTimes(1);

    await result.current.refetch();

    expect(mockFetchGroupLeaderboardFiltered).toHaveBeenCalledTimes(2);
  });

  it("positionChanges is empty on first load", async () => {
    mockFetchGroupLeaderboardFiltered.mockResolvedValue(makeEntries([1, 2, 3]));

    const { result } = renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.positionChanges).toEqual({});
  });

  it("computes positionChanges after a second fetch", async () => {
    // First load: u1 at position 1, u2 at position 2
    mockFetchGroupLeaderboardFiltered.mockResolvedValueOnce([
      { ...makeEntries([1])[0], user_id: "u1" },
      { ...makeEntries([2])[0], user_id: "u2" },
    ]);

    const { result } = renderHook(() => useGroupLeaderboard("g1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.positionChanges).toEqual({});

    // Second load: u1 drops to position 2, u2 rises to position 1
    mockFetchGroupLeaderboardFiltered.mockResolvedValueOnce([
      { ...makeEntries([1])[0], user_id: "u2", position: 1 },
      { ...makeEntries([2])[0], user_id: "u1", position: 2 },
    ]);

    await act(async () => {
      await result.current.refetch();
    });

    // u1 was at 1, now at 2: change = 1 - 2 = -1 (moved down)
    expect(result.current.positionChanges["u1"]).toBe(-1);
    // u2 was at 2, now at 1: change = 2 - 1 = +1 (moved up)
    expect(result.current.positionChanges["u2"]).toBe(1);
  });

  it("resets positionChanges when groupId changes", async () => {
    // First load: establish positions
    mockFetchGroupLeaderboardFiltered.mockResolvedValueOnce([
      { ...makeEntries([1])[0], user_id: "u1" },
    ]);

    const { result, rerender } = renderHook(
      ({ groupId }: { groupId: string }) => useGroupLeaderboard(groupId),
      { initialProps: { groupId: "g1" } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Second load: simulate refetch with position change
    mockFetchGroupLeaderboardFiltered.mockResolvedValueOnce([
      { ...makeEntries([2])[0], user_id: "u1", position: 2 },
    ]);
    await act(async () => {
      await result.current.refetch();
    });

    // Positions changes computed
    expect(result.current.positionChanges["u1"]).toBe(-1);

    // Now switch group — should reset position changes
    mockFetchGroupLeaderboardFiltered.mockResolvedValue([]);
    rerender({ groupId: "g2" });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.positionChanges).toEqual({});
  });
});
