import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";
/* eslint-enable @typescript-eslint/no-require-imports */

import ManageTournamentsScreen from "../../../app/groups/manage-tournaments";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ groupId: "g1" }),
  useRouter: () => ({ back: mockBack }),
}));

const mockRefetch = jest.fn();
jest.mock("@hooks/use-group-detail", () => ({
  useGroupDetail: jest.fn().mockReturnValue({
    group: {
      id: "g1",
      name: "Test Group",
      role: "admin",
    },
    tournaments: [
      { id: "t1", name: "Premier League", short_name: "PL", logo_url: null },
    ],
    loading: false,
    error: null,
    refetch: mockRefetch,
  }),
}));

jest.mock("@lib/groups-service", () => ({
  fetchActiveTournaments: jest.fn().mockResolvedValue([]),
  updateGroupTournaments: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, isInitialized: true }),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const {
  fetchActiveTournaments,
  updateGroupTournaments,
} = require("@lib/groups-service");
const Haptics = require("expo-haptics");
// useGroupDetail is mocked at module level above

beforeEach(() => {
  jest.clearAllMocks();
  mockRefetch.mockResolvedValue(undefined);
});

describe("ManageTournamentsScreen", () => {
  it("shows loading state while fetching tournaments", () => {
    fetchActiveTournaments.mockReturnValue(new Promise(() => {})); // Never resolves
    render(<ManageTournamentsScreen />);
    expect(screen.getByTestId("tournaments-loading")).toBeTruthy();
  });

  it("shows empty state when no active tournaments", async () => {
    fetchActiveTournaments.mockResolvedValue([]);
    render(<ManageTournamentsScreen />);
    await waitFor(() =>
      expect(screen.getByText("No active tournaments available.")).toBeTruthy(),
    );
  });

  it("renders tournament chips with current assignments pre-selected", async () => {
    fetchActiveTournaments.mockResolvedValue([
      { id: "t1", name: "Premier League", short_name: "PL", logo_url: null },
      { id: "t2", name: "La Liga", short_name: "LL", logo_url: null },
    ]);

    render(<ManageTournamentsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("tournament-chip-t1")).toBeTruthy();
      expect(screen.getByTestId("tournament-chip-t2")).toBeTruthy();
    });
  });

  it("toggles tournament selection when chip is pressed", async () => {
    fetchActiveTournaments.mockResolvedValue([
      { id: "t1", name: "Premier League", short_name: "PL", logo_url: null },
      { id: "t2", name: "La Liga", short_name: "LL", logo_url: null },
    ]);

    render(<ManageTournamentsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("tournament-chip-t2")).toBeTruthy(),
    );

    // t2 is not assigned, press to select
    fireEvent.press(screen.getByTestId("tournament-chip-t2"));
    // t1 is assigned, press to deselect
    fireEvent.press(screen.getByTestId("tournament-chip-t1"));
  });

  it("calls updateGroupTournaments and navigates back on save", async () => {
    fetchActiveTournaments.mockResolvedValue([
      { id: "t1", name: "Premier League", short_name: "PL", logo_url: null },
      { id: "t2", name: "La Liga", short_name: "LL", logo_url: null },
    ]);
    updateGroupTournaments.mockResolvedValue(undefined);

    render(<ManageTournamentsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("tournament-chip-t2")).toBeTruthy(),
    );

    // Add t2
    fireEvent.press(screen.getByTestId("tournament-chip-t2"));

    // Press save
    fireEvent.press(screen.getByTestId("save-button"));

    await waitFor(() => {
      expect(updateGroupTournaments).toHaveBeenCalledWith("g1", ["t1", "t2"]);
    });

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it("shows alert on save error", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    fetchActiveTournaments.mockResolvedValue([
      { id: "t1", name: "Premier League", short_name: "PL", logo_url: null },
    ]);
    updateGroupTournaments.mockRejectedValue(new Error("RLS violation"));

    render(<ManageTournamentsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("tournament-chip-t1")).toBeTruthy(),
    );

    // Deselect t1 to trigger a change
    fireEvent.press(screen.getByTestId("tournament-chip-t1"));

    fireEvent.press(screen.getByTestId("save-button"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Could not update tournaments",
        "RLS violation",
      );
    });

    alertSpy.mockRestore();
  });

  it("navigates back when back button is pressed", async () => {
    fetchActiveTournaments.mockResolvedValue([]);
    render(<ManageTournamentsScreen />);
    await waitFor(() => expect(screen.getByTestId("back-button")).toBeTruthy());
    fireEvent.press(screen.getByTestId("back-button"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("fires light impact haptic on tournament chip toggle", async () => {
    fetchActiveTournaments.mockResolvedValue([
      { id: "t1", name: "Premier League", short_name: "PL", logo_url: null },
    ]);

    render(<ManageTournamentsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("tournament-chip-t1")).toBeTruthy(),
    );

    fireEvent.press(screen.getByTestId("tournament-chip-t1"));

    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
  });

  it("fires success haptic on successful save", async () => {
    fetchActiveTournaments.mockResolvedValue([
      { id: "t1", name: "Premier League", short_name: "PL", logo_url: null },
    ]);
    updateGroupTournaments.mockResolvedValue(undefined);

    render(<ManageTournamentsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("tournament-chip-t1")).toBeTruthy(),
    );

    fireEvent.press(screen.getByTestId("save-button"));

    await waitFor(() => {
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success,
      );
    });
  });

  it("fires error haptic on failed save", async () => {
    fetchActiveTournaments.mockResolvedValue([
      { id: "t1", name: "Premier League", short_name: "PL", logo_url: null },
    ]);
    updateGroupTournaments.mockRejectedValue(new Error("RLS violation"));

    render(<ManageTournamentsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("tournament-chip-t1")).toBeTruthy(),
    );

    fireEvent.press(screen.getByTestId("save-button"));

    await waitFor(() => {
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Error,
      );
    });
  });
});
