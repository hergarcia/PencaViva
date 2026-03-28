// src/__tests__/hooks/use-player-stats.test.ts
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { usePlayerStats } from "@hooks/use-player-stats";
import * as service from "@lib/player-stats-service";

jest.mock("@lib/supabase");
jest.mock("@lib/retry");
jest.mock("@lib/player-stats-service");

const mockFetch = service.fetchPlayerGroupStats as jest.MockedFunction<
  typeof service.fetchPlayerGroupStats
>;

const mockComputeStreaks = service.computeStreaks as jest.MockedFunction<
  typeof service.computeStreaks
>;

const mockPredictions: service.PlayerPredictionRecord[] = [
  {
    id: "p1",
    home_score_pred: 3,
    away_score_pred: 1,
    points: 5,
    match: {
      id: "m1",
      home_team_name: "Team A",
      away_team_name: "Team B",
      home_score: 3,
      away_score: 1,
      kickoff_time: "2026-03-20T20:00:00Z",
      status: "finished",
      matchday: 4,
      tournament_name: "Copa",
      tournament_short_name: "COP",
    },
  },
  {
    id: "p2",
    home_score_pred: 0,
    away_score_pred: 0,
    points: 0,
    match: {
      id: "m2",
      home_team_name: "Team C",
      away_team_name: "Team D",
      home_score: 2,
      away_score: 1,
      kickoff_time: "2026-03-19T20:00:00Z",
      status: "finished",
      matchday: 3,
      tournament_name: "Copa",
      tournament_short_name: "COP",
    },
  },
  {
    id: "p3",
    home_score_pred: 1,
    away_score_pred: 0,
    points: 3,
    match: {
      id: "m3",
      home_team_name: "Team E",
      away_team_name: "Team F",
      home_score: 2,
      away_score: 0,
      kickoff_time: "2026-03-18T20:00:00Z",
      status: "finished",
      matchday: 3,
      tournament_name: "Copa",
      tournament_short_name: null,
    },
  },
];

describe("usePlayerStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComputeStreaks.mockReturnValue({
      currentStreak: { count: 1, type: "correct" },
      bestStreak: 1,
    });
  });

  it("starts in loading state", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePlayerStats("u1", "g1"));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.predictions).toEqual([]);
  });

  it("fetches and sorts predictions by kickoff_time DESC", async () => {
    mockFetch.mockResolvedValue(mockPredictions);
    const { result } = renderHook(() => usePlayerStats("u1", "g1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.predictions).toHaveLength(3);
    expect(result.current.predictions[0].id).toBe("p1");
    expect(result.current.predictions[1].id).toBe("p2");
    expect(result.current.predictions[2].id).toBe("p3");
  });

  it("computes streaks from predictions", async () => {
    mockFetch.mockResolvedValue(mockPredictions);
    const { result } = renderHook(() => usePlayerStats("u1", "g1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.streaks.currentStreak).toEqual({
      count: 1,
      type: "correct",
    });
    expect(result.current.streaks.bestStreak).toBe(1);
  });

  it("sets error on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => usePlayerStats("u1", "g1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Network error");
  });

  it("refetch reloads data", async () => {
    mockFetch.mockResolvedValue([]);
    const { result } = renderHook(() => usePlayerStats("u1", "g1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    mockFetch.mockResolvedValue(mockPredictions);
    await act(async () => {
      await result.current.refetch();
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.current.predictions).toHaveLength(3);
  });

  it("does not fetch if userId is empty", () => {
    const { result } = renderHook(() => usePlayerStats("", "g1"));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("does not fetch if groupId is empty", () => {
    const { result } = renderHook(() => usePlayerStats("u1", ""));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
