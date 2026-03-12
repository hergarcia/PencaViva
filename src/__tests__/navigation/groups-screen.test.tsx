import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react-native";

// ── Mocks ────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: jest.fn(),
}));

const mockFetchUserGroups = jest.fn();
jest.mock("@lib/groups-service", () => ({
  fetchUserGroups: (...args: unknown[]) => mockFetchUserGroups(...args),
}));

// Must import AFTER mocks
/* eslint-disable @typescript-eslint/no-require-imports */
const { useAuth } = require("@hooks/use-auth");
const GroupsScreen = require("../../../app/(tabs)/groups/index").default;
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({
    user: { id: "user-1" },
  });
});

describe("GroupsScreen", () => {
  it("shows loading indicator while fetching", () => {
    mockFetchUserGroups.mockReturnValue(new Promise(() => {}));

    const { getByTestId } = render(<GroupsScreen />);
    expect(getByTestId("loading-indicator")).toBeTruthy();
  });

  it("renders list of groups after loading", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([
      {
        id: "g1",
        name: "Test Group",
        description: "A test group",
        avatar_url: null,
        invite_code: "abc12345",
        created_by: "user-1",
        member_count: 3,
        role: "admin",
      },
    ]);

    const { getByText, queryByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(queryByTestId("loading-indicator")).toBeNull();
    });

    expect(getByText("Test Group")).toBeTruthy();
  });

  it("shows empty state when user has no groups", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([]);

    const { getByTestId, getByText } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("empty-state")).toBeTruthy();
    });

    expect(getByText("No groups yet")).toBeTruthy();
  });

  it("shows error state with retry button on fetch failure", async () => {
    mockFetchUserGroups.mockRejectedValueOnce(new Error("Network error"));

    const { getByTestId, getByText } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("error-message")).toBeTruthy();
    });

    expect(getByText("Failed to load groups.")).toBeTruthy();
    expect(getByTestId("retry-button")).toBeTruthy();
  });

  it("retries fetch when retry button is pressed", async () => {
    mockFetchUserGroups
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce([]);

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("retry-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("retry-button"));

    await waitFor(() => {
      expect(mockFetchUserGroups).toHaveBeenCalledTimes(2);
    });
  });

  it("navigates to group detail when card is pressed", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([
      {
        id: "g1",
        name: "Test Group",
        description: null,
        avatar_url: null,
        invite_code: "abc12345",
        created_by: "user-1",
        member_count: 2,
        role: "member",
      },
    ]);

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("group-card-g1")).toBeTruthy();
    });

    fireEvent.press(getByTestId("group-card-g1"));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/g1");
  });

  it("navigates to create group screen when create button is pressed", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([]);

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("create-group-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("create-group-button"));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/create");
  });

  it("navigates to join group screen when join button is pressed", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([]);

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("join-group-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("join-group-button"));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/join");
  });

  it("returns null when user is not authenticated", () => {
    useAuth.mockReturnValue({ user: null });

    const { toJSON } = render(<GroupsScreen />);
    expect(toJSON()).toBeNull();
  });

  it("shows header create button when groups exist", async () => {
    mockFetchUserGroups.mockResolvedValueOnce([
      {
        id: "g1",
        name: "Test Group",
        description: null,
        avatar_url: null,
        invite_code: "abc12345",
        created_by: "user-1",
        member_count: 2,
        role: "member",
      },
    ]);

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("header-create-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("header-create-button"));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/create");
  });
});
