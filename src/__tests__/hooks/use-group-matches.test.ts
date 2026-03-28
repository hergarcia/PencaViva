import { renderHook, waitFor } from "@testing-library/react-native";

import { useGroupMatches } from "@hooks/use-group-matches";
import type { MatchWithPrediction } from "@lib/matches-service";

// Mock matches-service
const mockFetchGroupMatches = jest.fn();
jest.mock("@lib/matches-service", () => ({
  fetchGroupMatches: (...args: unknown[]) => mockFetchGroupMatches(...args),
}));

jest.mock("@lib/retry");

// Mock use-auth
jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, isInitialized: true }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const makeMatch = (
  overrides: Partial<MatchWithPrediction>,
): MatchWithPrediction => ({
  id: "m1",
  tournament_id: "t1",
  tournament_name: "PDU",
  tournament_short_name: "PDU",
  home_team_name: "Nacional",
  away_team_name: "Peñarol",
  home_team_logo: null,
  away_team_logo: null,
  home_score: null,
  away_score: null,
  status: "scheduled",
  kickoff_time: "2026-03-18T20:00:00Z",
  matchday: null,
  venue: null,
  prediction_status: "open",
  predicted_home: null,
  predicted_away: null,
  ...overrides,
});

describe("useGroupMatches", () => {
  it("returns loading true initially", () => {
    mockFetchGroupMatches.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useGroupMatches("group-1"));
    expect(result.current.isLoading).toBe(true);
  });

  it("returns empty sections when no matches", async () => {
    mockFetchGroupMatches.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useGroupMatches("group-1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sections).toEqual([]);
    expect(result.current.matches).toEqual([]);
  });

  it("groups matches by date into sections", async () => {
    mockFetchGroupMatches.mockResolvedValueOnce([
      makeMatch({ id: "m1", kickoff_time: "2026-03-18T20:00:00Z" }),
      makeMatch({ id: "m2", kickoff_time: "2026-03-18T22:00:00Z" }),
      makeMatch({ id: "m3", kickoff_time: "2026-03-19T18:00:00Z" }),
    ]);

    const { result } = renderHook(() => useGroupMatches("group-1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sections).toHaveLength(2);
    expect(result.current.sections[0].data).toHaveLength(2);
    expect(result.current.sections[1].data).toHaveLength(1);
  });

  it("does not fetch when groupId is null", async () => {
    const { result } = renderHook(() => useGroupMatches(null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchGroupMatches).not.toHaveBeenCalled();
    expect(result.current.sections).toEqual([]);
  });

  it("returns error on fetch failure", async () => {
    mockFetchGroupMatches.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useGroupMatches("group-1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
  });
});
