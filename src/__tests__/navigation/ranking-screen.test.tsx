import React from "react";
import { render } from "@testing-library/react-native";

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
    mockUseGroupLeaderboard.mockReturnValue({
      entries: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

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
    mockUseGroupLeaderboard.mockReturnValue({
      entries: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

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
      entries: [],
      isLoading: false,
      error: "Network error",
      refetch: jest.fn(),
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
    mockUseGroupLeaderboard.mockReturnValue({
      entries: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

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
      entries: mockEntries,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
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
    mockUseGroupLeaderboard.mockReturnValue({
      entries: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<RankingScreen />);
    expect(getByText("Ranking")).toBeTruthy();
  });
});
