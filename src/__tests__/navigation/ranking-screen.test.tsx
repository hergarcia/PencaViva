import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

import RankingScreen from "../../../app/(tabs)/ranking";
import type { LeaderboardEntry } from "@lib/leaderboard-service";

// Mock hooks
jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, isInitialized: true }),
}));

const mockUseActiveGroup = jest.fn();
jest.mock("@hooks/use-active-group", () => ({
  useActiveGroup: () => mockUseActiveGroup(),
}));

const mockUseGroupLeaderboard = jest.fn();
jest.mock("@hooks/use-group-leaderboard", () => ({
  useGroupLeaderboard: () => mockUseGroupLeaderboard(),
}));

const mockGroup = {
  id: "g1",
  name: "Los Bolsos",
  description: null,
  avatar_url: null,
  invite_code: "ABCD1234",
  created_by: "user-1",
  member_count: 4,
  scoring_system: {
    exact_score: 5,
    correct_result: 3,
    correct_goal_diff: 1,
    wrong: 0,
  },
  role: "admin" as const,
};

const mockEntries: LeaderboardEntry[] = [
  {
    id: "lb1",
    group_id: "g1",
    user_id: "user-1",
    total_points: 42,
    position: 1,
    matches_played: 15,
    exact_scores: 3,
    correct_results: 8,
    display_name: "Hernan Garcia",
    username: "hernan_uy",
    avatar_url: null,
  },
  {
    id: "lb2",
    group_id: "g1",
    user_id: "user-2",
    total_points: 38,
    position: 2,
    matches_played: 14,
    exact_scores: 2,
    correct_results: 9,
    display_name: "Alice Rodriguez",
    username: "alice_mvd",
    avatar_url: null,
  },
];

const defaultLeaderboard = {
  entries: [],
  isLoading: false,
  error: null,
  refetch: jest.fn(),
  positionChanges: {},
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RankingScreen", () => {
  it("shows empty state when user has no groups", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: null,
      activeGroup: null,
      groups: [],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupLeaderboard.mockReturnValue(defaultLeaderboard);

    const { getByText } = render(<RankingScreen />);
    expect(getByText("No groups yet")).toBeTruthy();
    expect(
      getByText("Join or create a group to see the leaderboard"),
    ).toBeTruthy();
  });

  it("shows loading state while fetching", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: mockGroup,
      groups: [mockGroup],
      setActiveGroupId: jest.fn(),
      isLoading: true,
    });
    mockUseGroupLeaderboard.mockReturnValue(defaultLeaderboard);

    const { queryByText } = render(<RankingScreen />);
    expect(queryByText("No rankings yet")).toBeNull();
    expect(queryByText("No groups yet")).toBeNull();
  });

  it("shows error state with retry button", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: mockGroup,
      groups: [mockGroup],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupLeaderboard.mockReturnValue({
      ...defaultLeaderboard,
      error: "Network error",
    });

    const { getByText } = render(<RankingScreen />);
    expect(getByText("Something went wrong")).toBeTruthy();
    expect(getByText("Network error")).toBeTruthy();
  });

  it("shows empty leaderboard state when no entries", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: mockGroup,
      groups: [mockGroup],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupLeaderboard.mockReturnValue(defaultLeaderboard);

    const { getByText } = render(<RankingScreen />);
    expect(getByText("No rankings yet")).toBeTruthy();
    expect(
      getByText("Rankings appear after the first match is scored"),
    ).toBeTruthy();
  });

  it("renders leaderboard entries when data is available", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: mockGroup,
      groups: [mockGroup],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupLeaderboard.mockReturnValue({
      ...defaultLeaderboard,
      entries: mockEntries,
    });

    const { getByText } = render(<RankingScreen />);
    expect(getByText("Hernan Garcia")).toBeTruthy();
    expect(getByText("Alice Rodriguez")).toBeTruthy();
    expect(getByText("🥇")).toBeTruthy();
    expect(getByText("🥈")).toBeTruthy();
  });

  it("shows Ranking title", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: mockGroup,
      groups: [mockGroup],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupLeaderboard.mockReturnValue(defaultLeaderboard);

    const { getByText } = render(<RankingScreen />);
    expect(getByText("Ranking")).toBeTruthy();
  });

  it("shows filter tabs", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: mockGroup,
      groups: [mockGroup],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupLeaderboard.mockReturnValue(defaultLeaderboard);

    const { getByTestId, getByText } = render(<RankingScreen />);
    expect(getByTestId("filter-tabs")).toBeTruthy();
    expect(getByText("All Time")).toBeTruthy();
    expect(getByText("This Week")).toBeTruthy();
    expect(getByText("Last 30 Days")).toBeTruthy();
  });

  it("filter tabs are selectable", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: mockGroup,
      groups: [mockGroup],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupLeaderboard.mockReturnValue(defaultLeaderboard);

    const { getByTestId } = render(<RankingScreen />);
    // "This Week" tab is touchable
    const weekTab = getByTestId("filter-tab-week");
    expect(weekTab).toBeTruthy();
    fireEvent.press(weekTab);
    // After pressing, the hook would be called with 'week' filter
    // (in tests we mock the hook so we just verify the tab exists and is pressable)
  });

  it("shows position change indicator for entries with position changes", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: mockGroup,
      groups: [mockGroup],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupLeaderboard.mockReturnValue({
      ...defaultLeaderboard,
      entries: mockEntries,
      positionChanges: { "user-1": 1, "user-2": -1 },
    });

    const { getByTestId } = render(<RankingScreen />);
    expect(getByTestId("position-change-up")).toBeTruthy();
    expect(getByTestId("position-change-down")).toBeTruthy();
  });
});
