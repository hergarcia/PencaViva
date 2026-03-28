import { renderHook, waitFor } from "@testing-library/react-native";

const mockFetchGroupPredictions = jest.fn();
jest.mock("@lib/prediction-service", () => ({
  fetchGroupPredictions: (...args: unknown[]) =>
    mockFetchGroupPredictions(...args),
}));

jest.mock("@lib/retry");

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isInitialized: true }),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { useGroupPredictions } = require("@hooks/use-group-predictions");
/* eslint-enable @typescript-eslint/no-require-imports */

const mockPredictions = [
  {
    userId: "u1",
    displayName: "Alice",
    avatarUrl: null,
    homeScorePred: 2,
    awayScorePred: 1,
    points: null,
  },
];

describe("useGroupPredictions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not fetch when match is scheduled", async () => {
    const { result } = renderHook(() =>
      useGroupPredictions("m1", "g1", "scheduled"),
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.predictions).toEqual([]);
    expect(mockFetchGroupPredictions).not.toHaveBeenCalled();
  });

  it("fetches predictions for live matches", async () => {
    mockFetchGroupPredictions.mockResolvedValue(mockPredictions);

    const { result } = renderHook(() =>
      useGroupPredictions("m1", "g1", "live"),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.predictions).toEqual(mockPredictions);
    expect(mockFetchGroupPredictions).toHaveBeenCalledWith("m1", "g1");
  });

  it("fetches predictions for finished matches", async () => {
    mockFetchGroupPredictions.mockResolvedValue(mockPredictions);

    const { result } = renderHook(() =>
      useGroupPredictions("m1", "g1", "finished"),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.predictions).toEqual(mockPredictions);
  });

  it("sets error on fetch failure", async () => {
    mockFetchGroupPredictions.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useGroupPredictions("m1", "g1", "live"),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Network error");
    expect(result.current.predictions).toEqual([]);
  });

  it("does not fetch without matchId or groupId", async () => {
    const { result } = renderHook(() =>
      useGroupPredictions(undefined, "g1", "live"),
    );

    expect(result.current.isLoading).toBe(false);
    expect(mockFetchGroupPredictions).not.toHaveBeenCalled();
  });

  it("sets up refetch interval for live matches", async () => {
    jest.useFakeTimers();
    mockFetchGroupPredictions.mockResolvedValue(mockPredictions);

    renderHook(() => useGroupPredictions("m1", "g1", "live"));

    await waitFor(() =>
      expect(mockFetchGroupPredictions).toHaveBeenCalledTimes(1),
    );

    // Advance 30s — should refetch
    jest.advanceTimersByTime(30_000);
    await waitFor(() =>
      expect(mockFetchGroupPredictions).toHaveBeenCalledTimes(2),
    );

    jest.useRealTimers();
  });

  it("does not set up interval for finished matches", async () => {
    jest.useFakeTimers();
    mockFetchGroupPredictions.mockResolvedValue(mockPredictions);

    renderHook(() => useGroupPredictions("m1", "g1", "finished"));

    await waitFor(() =>
      expect(mockFetchGroupPredictions).toHaveBeenCalledTimes(1),
    );

    jest.advanceTimersByTime(60_000);
    // Should still be 1 — no interval for finished
    expect(mockFetchGroupPredictions).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
