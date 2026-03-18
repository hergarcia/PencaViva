import { renderHook, act, waitFor } from "@testing-library/react-native";

const mockFetchMatchDetail = jest.fn();
const mockSavePrediction = jest.fn();
jest.mock("@lib/prediction-service", () => ({
  fetchMatchDetail: (...args: unknown[]) => mockFetchMatchDetail(...args),
  savePrediction: (...args: unknown[]) => mockSavePrediction(...args),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isInitialized: true }),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { useMatchDetail } = require("@hooks/use-match-detail");
/* eslint-enable @typescript-eslint/no-require-imports */

const mockMatch = {
  id: "m1",
  tournament_id: "t1",
  tournament_name: "League",
  tournament_short_name: "LG",
  home_team_name: "Team A",
  away_team_name: "Team B",
  home_team_logo: null,
  away_team_logo: null,
  home_score: null,
  away_score: null,
  status: "scheduled",
  kickoff_time: "2026-03-20T18:00:00Z",
  matchday: 12,
  venue: "Stadium",
};

describe("useMatchDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads match and prediction on mount", async () => {
    const pred = { id: "p1", home_score_pred: 2, away_score_pred: 1 };
    mockFetchMatchDetail.mockResolvedValue({
      match: mockMatch,
      prediction: pred,
    });

    const { result } = renderHook(() => useMatchDetail("m1", "g1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.match).toEqual(mockMatch);
    expect(result.current.prediction).toEqual(pred);
    expect(result.current.error).toBeNull();
  });

  it("sets error on fetch failure", async () => {
    mockFetchMatchDetail.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useMatchDetail("m1", "g1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Network error");
    expect(result.current.match).toBeNull();
  });

  it("save returns true and updates prediction on success", async () => {
    mockFetchMatchDetail.mockResolvedValue({
      match: mockMatch,
      prediction: null,
    });
    mockSavePrediction.mockResolvedValue(undefined);

    const { result } = renderHook(() => useMatchDetail("m1", "g1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success: boolean;
    await act(async () => {
      success = await result.current.save(3, 0);
    });

    expect(success!).toBe(true);
    expect(result.current.prediction).toEqual({
      id: "optimistic",
      home_score_pred: 3,
      away_score_pred: 0,
    });
    expect(result.current.isSaving).toBe(false);
  });

  it("save returns false on error", async () => {
    mockFetchMatchDetail.mockResolvedValue({
      match: mockMatch,
      prediction: null,
    });
    mockSavePrediction.mockRejectedValue(new Error("RLS violation"));

    const { result } = renderHook(() => useMatchDetail("m1", "g1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success: boolean;
    await act(async () => {
      success = await result.current.save(3, 0);
    });

    expect(success!).toBe(false);
    expect(result.current.saveError).toBe("RLS violation");
  });

  it("does not fetch when groupId is null", async () => {
    const { result } = renderHook(() => useMatchDetail("m1", null));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchMatchDetail).not.toHaveBeenCalled();
  });
});
