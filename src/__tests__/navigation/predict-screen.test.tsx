import React from "react";
import { render } from "@testing-library/react-native";

import PredictScreen from "../../../app/(tabs)/predict";

jest.mock("@components/Toast");

// Mock use-auth
jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, isInitialized: true }),
}));

// Mock use-active-group
const mockUseActiveGroup = jest.fn();
jest.mock("@hooks/use-active-group", () => ({
  useActiveGroup: () => mockUseActiveGroup(),
}));

// Mock use-group-matches
const mockUseGroupMatches = jest.fn();
jest.mock("@hooks/use-group-matches", () => ({
  useGroupMatches: () => mockUseGroupMatches(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PredictScreen", () => {
  it("shows empty state when user has no groups", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: null,
      activeGroup: null,
      groups: [],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupMatches.mockReturnValue({
      sections: [],
      matches: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<PredictScreen />);
    expect(getByText("No groups yet")).toBeTruthy();
    expect(
      getByText("Join or create a group to start predicting"),
    ).toBeTruthy();
  });

  it("shows loading state while fetching", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: { id: "g1", name: "Test Group" },
      groups: [{ id: "g1", name: "Test Group" }],
      setActiveGroupId: jest.fn(),
      isLoading: true,
    });
    mockUseGroupMatches.mockReturnValue({
      sections: [],
      matches: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { queryByText } = render(<PredictScreen />);
    // While loading, neither empty state nor match list should show
    expect(queryByText("No upcoming matches")).toBeNull();
    expect(queryByText("No groups yet")).toBeNull();
  });

  it("shows error state with retry button", () => {
    const refetch = jest.fn();
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: { id: "g1", name: "Test Group" },
      groups: [{ id: "g1", name: "Test Group" }],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupMatches.mockReturnValue({
      sections: [],
      matches: [],
      isLoading: false,
      error: "Network error",
      refetch,
    });

    const { getByText } = render(<PredictScreen />);
    expect(getByText("Something went wrong")).toBeTruthy();
    expect(getByText("Network error")).toBeTruthy();
  });

  it("shows empty matches state when no fixtures", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: { id: "g1", name: "Test Group" },
      groups: [{ id: "g1", name: "Test Group" }],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupMatches.mockReturnValue({
      sections: [],
      matches: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<PredictScreen />);
    expect(getByText("No upcoming matches")).toBeTruthy();
  });

  it("renders match sections when data is available", () => {
    mockUseActiveGroup.mockReturnValue({
      activeGroupId: "g1",
      activeGroup: { id: "g1", name: "Test Group" },
      groups: [{ id: "g1", name: "Test Group" }],
      setActiveGroupId: jest.fn(),
      isLoading: false,
    });
    mockUseGroupMatches.mockReturnValue({
      sections: [
        {
          title: "Today",
          dateKey: "2026-03-18",
          data: [
            {
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
              matchday: 5,
              venue: "Gran Parque Central",
              prediction_status: "open",
              predicted_home: null,
              predicted_away: null,
            },
          ],
        },
      ],
      matches: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<PredictScreen />);
    expect(getByText("Today")).toBeTruthy();
    expect(getByText("Nacional")).toBeTruthy();
    expect(getByText("Peñarol")).toBeTruthy();
  });
});
