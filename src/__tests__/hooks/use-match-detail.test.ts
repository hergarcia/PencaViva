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

  it("does not fetch when groupId is null", async () => {
    const { result } = renderHook(() => useMatchDetail("m1", null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchMatchDetail).not.toHaveBeenCalled();
  });

  describe("save — optimistic update", () => {
    it("sets prediction optimistically before save resolves", async () => {
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: null,
      });
      // Delayed save so we can inspect state mid-flight
      let resolveSave!: () => void;
      mockSavePrediction.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
      );

      const { result } = renderHook(() => useMatchDetail("m1", "g1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Start save — do not await
      act(() => {
        result.current.save(3, 0);
      });

      // Prediction should be set optimistically before save resolves
      expect(result.current.prediction).toEqual({
        id: "optimistic",
        home_score_pred: 3,
        away_score_pred: 0,
      });

      // Clean up: resolve save and handle background refetch
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: { id: "p1", home_score_pred: 3, away_score_pred: 0 },
      });
      await act(async () => {
        resolveSave();
      });
    });

    it("returns true on successful save", async () => {
      mockFetchMatchDetail.mockResolvedValueOnce({
        match: mockMatch,
        prediction: null,
      });
      mockSavePrediction.mockResolvedValue(undefined);
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: { id: "p1", home_score_pred: 3, away_score_pred: 0 },
      });

      const { result } = renderHook(() => useMatchDetail("m1", "g1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean;
      await act(async () => {
        success = await result.current.save(3, 0);
      });

      expect(success!).toBe(true);
      expect(result.current.isSaving).toBe(false);
    });
  });

  describe("save — rollback on failure", () => {
    it("rolls back prediction to previous value on generic error", async () => {
      const existingPred = { id: "p1", home_score_pred: 1, away_score_pred: 0 };
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: existingPred,
      });
      mockSavePrediction.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useMatchDetail("m1", "g1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.save(3, 0);
      });

      expect(result.current.prediction).toEqual(existingPred);
      expect(result.current.saveError).toBe("Network error");
      expect(result.current.isLockedByServer).toBe(false);
    });

    it("rolls back and sets isLockedByServer on RLS error", async () => {
      const existingPred = { id: "p1", home_score_pred: 1, away_score_pred: 0 };
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: existingPred,
      });
      mockSavePrediction.mockRejectedValue(
        new Error(
          'new row violates row-level security policy for table "predictions"',
        ),
      );

      const { result } = renderHook(() => useMatchDetail("m1", "g1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean;
      await act(async () => {
        success = await result.current.save(3, 0);
      });

      expect(success!).toBe(false);
      expect(result.current.prediction).toEqual(existingPred);
      expect(result.current.saveError).toBe(
        "Predictions are locked — the match has already started.",
      );
      expect(result.current.isLockedByServer).toBe(true);
    });

    it("shows raw error message for non-RLS failures", async () => {
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: null,
      });
      mockSavePrediction.mockRejectedValue(new Error("timeout"));

      const { result } = renderHook(() => useMatchDetail("m1", "g1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.save(3, 0);
      });

      expect(result.current.saveError).toBe("timeout");
      expect(result.current.isLockedByServer).toBe(false);
    });
  });

  describe("isLockedByServer reset", () => {
    it("resets isLockedByServer to false at start of refetch", async () => {
      mockFetchMatchDetail.mockResolvedValueOnce({
        match: mockMatch,
        prediction: null,
      });
      mockSavePrediction.mockRejectedValue(
        new Error("row-level security policy"),
      );
      mockFetchMatchDetail.mockResolvedValue({
        match: mockMatch,
        prediction: null,
      });

      const { result } = renderHook(() => useMatchDetail("m1", "g1"));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.save(3, 0);
      });

      expect(result.current.isLockedByServer).toBe(true);

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.isLockedByServer).toBe(false);
    });
  });
});
