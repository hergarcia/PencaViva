import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// ── Mocks ────────────────────────────────────────────────────────────

jest.mock("@lib/groups-service", () => ({
  createGroup: jest.fn(),
  fetchActiveTournaments: jest.fn(),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

// Must import AFTER mocks
/* eslint-disable @typescript-eslint/no-require-imports */
const { createGroup, fetchActiveTournaments } = require("@lib/groups-service");
const { useAuth } = require("@hooks/use-auth");
const CreateGroupScreen = require("../../../app/(tabs)/groups/create").default;
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
  // Default: tournaments fetch resolves empty (so loading doesn't hang)
  fetchActiveTournaments.mockResolvedValue([]);
  useAuth.mockReturnValue({ user: { id: "user-1" } });
});

describe("CreateGroupScreen", () => {
  it("renders name input and create button", async () => {
    const { getByTestId } = render(<CreateGroupScreen />);
    await waitFor(() => expect(fetchActiveTournaments).toHaveBeenCalled());
    expect(getByTestId("name-input")).toBeTruthy();
    expect(getByTestId("create-button")).toBeTruthy();
  });

  it("shows Alert when name is less than 3 characters", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByTestId } = render(<CreateGroupScreen />);
    await waitFor(() => expect(fetchActiveTournaments).toHaveBeenCalled());

    fireEvent.changeText(getByTestId("name-input"), "ab");
    fireEvent.press(getByTestId("create-button"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Invalid name",
      "Group name must be at least 3 characters.",
    );
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("calls createGroup and navigates on success", async () => {
    createGroup.mockResolvedValueOnce({
      id: "g-1",
      name: "Test Group",
      invite_code: "ABC123",
    });
    const { getByTestId } = render(<CreateGroupScreen />);
    await waitFor(() => expect(fetchActiveTournaments).toHaveBeenCalled());

    fireEvent.changeText(getByTestId("name-input"), "Test Group");
    await act(async () => {
      fireEvent.press(getByTestId("create-button"));
    });

    await waitFor(() => {
      expect(createGroup).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          name: "Test Group",
        }),
      );
    });

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/groups/g-1");
  });

  it("shows Alert when createGroup throws", async () => {
    createGroup.mockRejectedValueOnce(new Error("Server error"));
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByTestId } = render(<CreateGroupScreen />);
    await waitFor(() => expect(fetchActiveTournaments).toHaveBeenCalled());

    fireEvent.changeText(getByTestId("name-input"), "Valid Name");
    await act(async () => {
      fireEvent.press(getByTestId("create-button"));
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Could not create group",
        "Server error",
      );
    });
  });

  it("shows tournament chips when fetchActiveTournaments returns data", async () => {
    fetchActiveTournaments.mockResolvedValueOnce([
      { id: "t-1", name: "Premier League", short_name: "PL", logo_url: null },
      { id: "t-2", name: "La Liga", short_name: null, logo_url: null },
    ]);

    const { getByTestId, getByText } = render(<CreateGroupScreen />);

    await waitFor(() => {
      expect(getByTestId("tournament-chip-t-1")).toBeTruthy();
    });

    expect(getByText("PL")).toBeTruthy(); // uses short_name
    expect(getByText("La Liga")).toBeTruthy(); // falls back to name when short_name is null
  });

  it("shows no-tournaments message when fetch returns empty array", async () => {
    fetchActiveTournaments.mockResolvedValueOnce([]);
    const { getByTestId } = render(<CreateGroupScreen />);

    await waitFor(() => {
      expect(getByTestId("no-tournaments")).toBeTruthy();
    });
  });

  it("shows no-tournaments message when fetchActiveTournaments throws", async () => {
    fetchActiveTournaments.mockRejectedValueOnce(new Error("Network error"));
    const { getByTestId } = render(<CreateGroupScreen />);

    await waitFor(() => {
      expect(getByTestId("no-tournaments")).toBeTruthy();
    });
  });

  it("shows custom scoring inputs after pressing Custom preset card", async () => {
    const { queryByTestId, getByText } = render(<CreateGroupScreen />);
    await waitFor(() => expect(fetchActiveTournaments).toHaveBeenCalled());

    // Custom inputs should not be visible initially
    expect(queryByTestId("custom-scoring-inputs")).toBeNull();

    // Press the "Custom" preset card (accessible via its label text)
    fireEvent.press(getByText("Custom"));

    expect(queryByTestId("custom-scoring-inputs")).toBeTruthy();
  });
});
