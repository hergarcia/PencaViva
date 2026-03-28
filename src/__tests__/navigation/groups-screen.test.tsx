import React from "react";
import {
  render,
  renderAsync,
  waitFor,
  fireEvent,
} from "@testing-library/react-native";

// ── Mocks ────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseUserGroups = jest.fn();
jest.mock("@hooks/use-user-groups", () => ({
  useUserGroups: () => mockUseUserGroups(),
}));

// Must import AFTER mocks
/* eslint-disable @typescript-eslint/no-require-imports */
const GroupsScreen = require("../../../app/(tabs)/groups/index").default;
/* eslint-enable @typescript-eslint/no-require-imports */

const defaultHook = {
  groups: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  refetch: jest.fn(),
};

beforeEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
  mockUseUserGroups.mockReturnValue(defaultHook);
});

describe("GroupsScreen", () => {
  it("shows loading skeleton while fetching", () => {
    mockUseUserGroups.mockReturnValue({
      ...defaultHook,
      isLoading: true,
      isRefreshing: false,
    });

    const { getByTestId, getAllByTestId } = render(<GroupsScreen />);
    expect(getByTestId("groups-screen")).toBeTruthy();
    // Skeleton cards shown during initial load
    expect(getAllByTestId("skeleton-group-card").length).toBeGreaterThan(0);
  });

  it("renders list of groups after loading", async () => {
    const groups = [
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
    ];
    mockUseUserGroups.mockReturnValue({ ...defaultHook, groups });

    const { getByText, queryByTestId } = await renderAsync(<GroupsScreen />);

    expect(queryByTestId("skeleton-group-card")).toBeNull();
    expect(getByText("Test Group")).toBeTruthy();
  });

  it("shows empty state when user has no groups", async () => {
    mockUseUserGroups.mockReturnValue({ ...defaultHook, groups: [] });

    const { getByTestId, getByText } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("empty-state")).toBeTruthy();
    });

    expect(getByText("No groups yet")).toBeTruthy();
  });

  it("shows error state with retry button on fetch failure", async () => {
    mockUseUserGroups.mockReturnValue({
      ...defaultHook,
      error: "Failed to load groups.",
    });

    const { getByTestId, getByText } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("error-message")).toBeTruthy();
    });

    expect(getByText("Failed to load groups.")).toBeTruthy();
    expect(getByTestId("retry-button")).toBeTruthy();
  });

  it("calls refetch when retry button is pressed", async () => {
    const refetch = jest.fn();
    mockUseUserGroups.mockReturnValue({
      ...defaultHook,
      error: "Failed to load groups.",
      refetch,
    });

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("retry-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("retry-button"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("navigates to group detail when card is pressed", async () => {
    const groups = [
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
    ];
    mockUseUserGroups.mockReturnValue({ ...defaultHook, groups });

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("group-card-g1")).toBeTruthy();
    });

    fireEvent.press(getByTestId("group-card-g1"));
    expect(mockPush).toHaveBeenCalledWith("/groups/g1");
  });

  it("navigates to create group screen when create button is pressed", async () => {
    mockUseUserGroups.mockReturnValue({ ...defaultHook, groups: [] });

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("create-group-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("create-group-button"));
    expect(mockPush).toHaveBeenCalledWith("/groups/create");
  });

  it("navigates to join group screen when join button is pressed", async () => {
    mockUseUserGroups.mockReturnValue({ ...defaultHook, groups: [] });

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("join-group-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("join-group-button"));
    expect(mockPush).toHaveBeenCalledWith("/groups/join");
  });

  it("shows header add button and menu options when groups exist", async () => {
    const groups = [
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
    ];
    mockUseUserGroups.mockReturnValue({ ...defaultHook, groups });

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("header-add-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("header-add-button"));

    await waitFor(() => expect(getByTestId("menu-create-group")).toBeTruthy());
    fireEvent.press(getByTestId("menu-create-group"));
    expect(mockPush).toHaveBeenCalledWith("/groups/create");
  });

  it("navigates to join group from header menu", async () => {
    const groups = [
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
    ];
    mockUseUserGroups.mockReturnValue({ ...defaultHook, groups });

    const { getByTestId } = render(<GroupsScreen />);

    await waitFor(() => {
      expect(getByTestId("header-add-button")).toBeTruthy();
    });

    fireEvent.press(getByTestId("header-add-button"));

    await waitFor(() => expect(getByTestId("menu-join-group")).toBeTruthy());
    fireEvent.press(getByTestId("menu-join-group"));
    expect(mockPush).toHaveBeenCalledWith("/groups/join");
  });
});
