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
  kickoff_time: "2026-03-20T18:00:00Z",
  matchday: 12,
  venue: "Emirates Stadium",
};

describe("MatchDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHookReturn = {
      match: mockMatch,
      prediction: null,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      save: mockSave,
      isSaving: false,
      saveError: null,
    };
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
    // Arsenal appears twice: match info TeamRow + stepper
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
      prediction: { id: "p1", home_score_pred: 2, away_score_pred: 1 },
    };
    const { getByText, queryByText } = render(<MatchDetailScreen />);
    expect(getByText(/Your prediction: 2 – 1/i)).toBeTruthy();
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
});
