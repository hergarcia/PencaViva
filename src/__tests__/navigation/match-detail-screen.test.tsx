import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

// Mock expo-router
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "m1" }),
  useRouter: () => ({ back: mockBack }),
}));

// Mock group-store
jest.mock("@stores/group-store", () => ({
  useGroupStore: (selector: (s: { activeGroupId: string }) => unknown) =>
    selector({ activeGroupId: "g1" }),
}));

// Mock useMatchDetail hook
const mockSave = jest.fn();
const mockRefetch = jest.fn();
let mockHookReturn: Record<string, unknown>;

jest.mock("@hooks/use-match-detail", () => ({
  useMatchDetail: () => mockHookReturn,
}));

// Mock useCountdown hook
const mockUseCountdown = jest.fn();
jest.mock("@hooks/use-countdown", () => ({
  useCountdown: (...args: unknown[]) => mockUseCountdown(...args),
}));

// Mock hooks and component added in F1-20
jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isInitialized: true }),
}));
let mockGroup: Record<string, unknown> | null = null;
jest.mock("@hooks/use-group-detail", () => ({
  useGroupDetail: () => ({ group: mockGroup }),
}));
jest.mock("@components/predictions/GroupPredictions", () => ({
  GroupPredictions: () => null,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const MatchDetailScreen = require("../../../app/match/[id]").default;
/* eslint-enable @typescript-eslint/no-require-imports */

const mockMatch = {
  id: "m1",
  tournament_id: "t1",
  tournament_name: "Premier League",
  tournament_short_name: "PL",
  home_team_name: "Arsenal",
  away_team_name: "Chelsea",
  home_team_logo: null,
  away_team_logo: null,
  home_score: null,
  away_score: null,
  status: "scheduled",
  kickoff_time: "2027-03-20T18:00:00Z",
  matchday: 12,
  venue: "Emirates Stadium",
};

const defaultCountdown = {
  secondsRemaining: 7200,
  isExpired: false,
  formatted: "2h 0m",
};

const mockScoringSystem = {
  exact_score: 5,
  correct_result: 3,
  correct_goal_diff: 1,
  wrong: 0,
};

describe("MatchDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseCountdown.mockReturnValue(defaultCountdown);
    mockHookReturn = {
      match: mockMatch,
      prediction: null,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      save: mockSave,
      isSaving: false,
      saveError: null,
      isLockedByServer: false,
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    mockGroup = null;
  });

  it("shows loading state", () => {
    mockHookReturn = { ...mockHookReturn, isLoading: true, match: null };
    const { getByTestId } = render(<MatchDetailScreen />);
    expect(getByTestId("loading-indicator")).toBeTruthy();
  });

  it("shows error state with retry", () => {
    mockHookReturn = { ...mockHookReturn, error: "Network error", match: null };
    const { getByText, getByTestId } = render(<MatchDetailScreen />);
    expect(getByText("Network error")).toBeTruthy();
    fireEvent.press(getByTestId("retry-button"));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("renders match info and steppers for scheduled match", () => {
    const { getAllByText, getByText } = render(<MatchDetailScreen />);
    expect(getAllByText("Arsenal").length).toBe(2);
    expect(getAllByText("Chelsea").length).toBe(2);
    expect(getByText("Premier League")).toBeTruthy();
    expect(getByText("Your Prediction")).toBeTruthy();
  });

  it("pre-fills steppers with existing prediction", () => {
    mockHookReturn = {
      ...mockHookReturn,
      prediction: { id: "p1", home_score_pred: 2, away_score_pred: 1 },
    };
    const { getAllByText } = render(<MatchDetailScreen />);
    expect(getAllByText("2").length).toBeGreaterThan(0);
    expect(getAllByText("1").length).toBeGreaterThan(0);
  });

  it("shows read-only for finished match with prediction", () => {
    mockHookReturn = {
      ...mockHookReturn,
      match: { ...mockMatch, status: "finished", home_score: 3, away_score: 1 },
      prediction: {
        id: "p1",
        home_score_pred: 2,
        away_score_pred: 1,
        points: 3,
      },
    };
    const { getByText, queryByText } = render(<MatchDetailScreen />);
    expect(getByText("Your Prediction")).toBeTruthy();
    expect(getByText("Final Score")).toBeTruthy();
    expect(queryByText("Save Prediction")).toBeNull();
  });

  it("calls save when Save Prediction is pressed", async () => {
    mockSave.mockResolvedValue(true);
    const { getByText } = render(<MatchDetailScreen />);
    await act(async () => {
      fireEvent.press(getByText("Save Prediction"));
    });
    expect(mockSave).toHaveBeenCalledWith(0, 0);
  });

  it("navigates back when back button is pressed", () => {
    const { getByTestId } = render(<MatchDetailScreen />);
    fireEvent.press(getByTestId("back-button"));
    expect(mockBack).toHaveBeenCalled();
  });

  describe("countdown display", () => {
    it("shows countdown label when editable and time remaining", () => {
      mockUseCountdown.mockReturnValue({
        secondsRemaining: 7200,
        isExpired: false,
        formatted: "2h 0m",
      });
      const { getByText } = render(<MatchDetailScreen />);
      expect(getByText("Locks in 2h 0m")).toBeTruthy();
    });

    it("does not show countdown label when formatted is empty", () => {
      mockUseCountdown.mockReturnValue({
        secondsRemaining: 0,
        isExpired: true,
        formatted: "",
      });
      const { queryByText } = render(<MatchDetailScreen />);
      expect(queryByText(/Locks in/)).toBeNull();
    });
  });

  describe("isEditable — time-based lock", () => {
    it("locks form when isExpired is true even if status is scheduled", () => {
      mockUseCountdown.mockReturnValue({
        secondsRemaining: 0,
        isExpired: true,
        formatted: "",
      });
      const { queryByText } = render(<MatchDetailScreen />);
      expect(queryByText("Save Prediction")).toBeNull();
      expect(queryByText("Update Prediction")).toBeNull();
    });

    it("locks form when isLockedByServer is true", () => {
      mockHookReturn = { ...mockHookReturn, isLockedByServer: true };
      const { queryByText } = render(<MatchDetailScreen />);
      expect(queryByText("Save Prediction")).toBeNull();
    });
  });

  describe("RLS error auto-transition", () => {
    it("shows error in read-only section when isLockedByServer is true", () => {
      mockHookReturn = {
        ...mockHookReturn,
        isLockedByServer: true,
        saveError: "Predictions are locked — the match has already started.",
      };
      const { getByText, queryByText } = render(<MatchDetailScreen />);
      expect(queryByText("Save Prediction")).toBeNull();
      expect(
        getByText("Predictions are locked — the match has already started."),
      ).toBeTruthy();
    });

    it("clears the error banner after 3 seconds", () => {
      mockHookReturn = {
        ...mockHookReturn,
        isLockedByServer: true,
        saveError: "Predictions are locked — the match has already started.",
      };
      const { queryByText } = render(<MatchDetailScreen />);
      expect(
        queryByText("Predictions are locked — the match has already started."),
      ).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(
        queryByText("Predictions are locked — the match has already started."),
      ).toBeNull();
    });
  });

  it("shows result badge and points for finished match with exact prediction", () => {
    mockHookReturn = {
      match: { ...mockMatch, status: "finished", home_score: 2, away_score: 1 },
      prediction: { home_score_pred: 2, away_score_pred: 1, points: 5 },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      save: mockSave,
      isSaving: false,
      saveError: null,
      isLockedByServer: false,
    };
    mockUseCountdown.mockReturnValue(defaultCountdown);

    const { getByText, getByTestId } = render(<MatchDetailScreen />);
    expect(getByTestId("result-badge")).toBeTruthy();
    expect(getByText("Exact Score!")).toBeTruthy();
    expect(getByText("+5 pts")).toBeTruthy();
  });

  it("shows correct result badge for finished match", () => {
    mockHookReturn = {
      match: { ...mockMatch, status: "finished", home_score: 2, away_score: 1 },
      prediction: { home_score_pred: 1, away_score_pred: 0, points: 3 },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      save: mockSave,
      isSaving: false,
      saveError: null,
      isLockedByServer: false,
    };
    mockUseCountdown.mockReturnValue(defaultCountdown);

    const { getByText } = render(<MatchDetailScreen />);
    expect(getByText("Correct Result")).toBeTruthy();
    expect(getByText("+3 pts")).toBeTruthy();
  });

  it("shows correct result with diff bonus for finished match", () => {
    mockHookReturn = {
      match: { ...mockMatch, status: "finished", home_score: 2, away_score: 1 },
      prediction: { home_score_pred: 3, away_score_pred: 2, points: 4 },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      save: mockSave,
      isSaving: false,
      saveError: null,
      isLockedByServer: false,
    };
    mockUseCountdown.mockReturnValue(defaultCountdown);

    const { getByText } = render(<MatchDetailScreen />);
    expect(getByText("Correct Result")).toBeTruthy();
    expect(getByText("+4 pts")).toBeTruthy();
  });

  it("shows wrong badge for finished match with wrong prediction", () => {
    mockHookReturn = {
      match: { ...mockMatch, status: "finished", home_score: 2, away_score: 1 },
      prediction: { home_score_pred: 0, away_score_pred: 3, points: 0 },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      save: mockSave,
      isSaving: false,
      saveError: null,
      isLockedByServer: false,
    };
    mockUseCountdown.mockReturnValue(defaultCountdown);

    const { getByText } = render(<MatchDetailScreen />);
    expect(getByText("Wrong")).toBeTruthy();
    expect(getByText("+0 pts")).toBeTruthy();
  });

  it("shows prediction comparison columns for finished match", () => {
    mockHookReturn = {
      match: { ...mockMatch, status: "finished", home_score: 2, away_score: 1 },
      prediction: { home_score_pred: 2, away_score_pred: 1, points: 5 },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      save: mockSave,
      isSaving: false,
      saveError: null,
      isLockedByServer: false,
    };
    mockUseCountdown.mockReturnValue(defaultCountdown);

    const { getByText } = render(<MatchDetailScreen />);
    expect(getByText("Your Prediction")).toBeTruthy();
    expect(getByText("Final Score")).toBeTruthy();
  });

  it("shows live point tracking for live match with prediction", () => {
    mockGroup = { scoring_system: mockScoringSystem };
    mockHookReturn = {
      match: { ...mockMatch, status: "live", home_score: 2, away_score: 1 },
      prediction: { home_score_pred: 2, away_score_pred: 1 },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      save: mockSave,
      isSaving: false,
      saveError: null,
      isLockedByServer: false,
    };
    mockUseCountdown.mockReturnValue(defaultCountdown);

    const { getByText, getByTestId } = render(<MatchDetailScreen />);
    expect(getByTestId("live-indicator")).toBeTruthy();
    expect(getByText(/Exact Score!/)).toBeTruthy();
    expect(getByText(/\+5 pts/)).toBeTruthy();
  });

  it("shows no-prediction message for finished match without prediction", () => {
    mockHookReturn = {
      match: { ...mockMatch, status: "finished", home_score: 2, away_score: 1 },
      prediction: null,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      save: mockSave,
      isSaving: false,
      saveError: null,
      isLockedByServer: false,
    };
    mockUseCountdown.mockReturnValue(defaultCountdown);

    const { getByText } = render(<MatchDetailScreen />);
    expect(getByText("No prediction submitted")).toBeTruthy();
    expect(getByText("0 pts")).toBeTruthy();
  });

  it("shows primary left border on editable stepper card", () => {
    mockHookReturn = {
      match: mockMatch,
      prediction: null,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      save: mockSave,
      isSaving: false,
      saveError: null,
      isLockedByServer: false,
    };
    mockUseCountdown.mockReturnValue(defaultCountdown);

    const { getByTestId } = render(<MatchDetailScreen />);
    expect(getByTestId("prediction-card-indicator")).toBeTruthy();
  });
});
