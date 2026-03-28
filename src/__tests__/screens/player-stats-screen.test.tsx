/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { usePlayerStats } from "@hooks/use-player-stats";
import type {
  PlayerPredictionRecord,
  StreakResult,
} from "@lib/player-stats-service";

jest.mock("@hooks/use-player-stats");
jest.mock("@lib/supabase");
jest.mock("@components/Toast");
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({
    userId: "u1",
    groupId: "g1",
    displayName: "Alice Rodriguez",
    username: "alice_mvd",
    avatarUrl: "",
    position: "2",
    totalPoints: "38",
    exactScores: "2",
    correctResults: "9",
    matchesPlayed: "14",
  }),
  useRouter: () => ({ back: jest.fn() }),
}));
jest.mock("react-native-safe-area-context", () => {
  const ReactModule = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) => ReactModule.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockUsePlayerStats = usePlayerStats as jest.MockedFunction<
  typeof usePlayerStats
>;

const loadScreen = () => require("../../../app/player-stats/[userId]").default;

const mockPredictions: PlayerPredictionRecord[] = [
  {
    id: "p1",
    home_score_pred: 3,
    away_score_pred: 1,
    points: 5,
    match: {
      id: "m1",
      home_team_name: "Cerro Porteno",
      away_team_name: "Olimpia",
      home_score: 3,
      away_score: 1,
      kickoff_time: "2026-03-20T20:00:00Z",
      status: "finished",
      matchday: 4,
      tournament_name: "Copa Libertadores",
      tournament_short_name: "Libertadores",
    },
  },
];

const mockStreaks: StreakResult = {
  currentStreak: { count: 3, type: "correct" },
  bestStreak: 5,
};

describe("PlayerStatsScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders loading state", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: [],
      streaks: { currentStreak: { count: 0, type: "correct" }, bestStreak: 0 },
      isLoading: true,
      isRefreshing: false,
      error: null,
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByTestId("loading-indicator")).toBeTruthy();
  });

  it("renders error state", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: [],
      streaks: { currentStreak: { count: 0, type: "correct" }, bestStreak: 0 },
      isLoading: false,
      isRefreshing: false,
      error: "Network error",
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByText("Network error")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("renders header with player info from route params", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: mockPredictions,
      streaks: mockStreaks,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByText("Alice Rodriguez")).toBeTruthy();
    expect(screen.getByText("@alice_mvd")).toBeTruthy();
  });

  it("renders stats grid from route params", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: mockPredictions,
      streaks: mockStreaks,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByTestId("stats-grid")).toBeTruthy();
  });

  it("renders streak display", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: mockPredictions,
      streaks: mockStreaks,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByTestId("streak-display")).toBeTruthy();
    expect(screen.getByText(/3 correct in a row/)).toBeTruthy();
  });

  it("renders prediction history rows", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: mockPredictions,
      streaks: mockStreaks,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByTestId("prediction-history-row-p1")).toBeTruthy();
  });

  it("renders empty state when no predictions", () => {
    mockUsePlayerStats.mockReturnValue({
      predictions: [],
      streaks: { currentStreak: { count: 0, type: "correct" }, bestStreak: 0 },
      isLoading: false,
      isRefreshing: false,
      error: null,
      refetch: jest.fn(),
    });
    const Screen = loadScreen();
    render(<Screen />);
    expect(screen.getByText(/No predictions scored yet/)).toBeTruthy();
  });
});
