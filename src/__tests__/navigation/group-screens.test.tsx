import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import GroupDetailScreen from "../../../app/(tabs)/groups/[id]";
import CreateGroupScreen from "../../../app/(tabs)/groups/create";
import JoinGroupScreen from "../../../app/(tabs)/groups/join";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "7" }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, isInitialized: true }),
}));

jest.mock("@lib/groups-service", () => ({
  createGroup: jest.fn(),
  fetchActiveTournaments: jest.fn().mockResolvedValue([]),
  fetchGroupById: jest.fn(),
  lookupGroupByInviteCode: jest.fn(),
  joinGroupByCode: jest.fn(),
}));

jest.mock("@hooks/use-group-detail", () => ({
  useGroupDetail: jest.fn().mockReturnValue({
    group: null,
    loading: true,
    error: null,
  }),
}));

jest.mock("@react-native-clipboard/clipboard");
/* eslint-disable @typescript-eslint/no-require-imports */
const Clipboard = require("@react-native-clipboard/clipboard").default;
/* eslint-enable @typescript-eslint/no-require-imports */

const loadedGroup = {
  id: "7",
  name: "My Penca",
  description: null,
  avatar_url: null,
  invite_code: "ABCD1234",
  created_by: "u1",
  member_count: 5,
  role: "admin" as const,
};

describe("Group nested screens", () => {
  it("renders loading state for group detail", () => {
    render(<GroupDetailScreen />);
    expect(screen.getByTestId("loading-indicator")).toBeTruthy();
  });

  it("renders group name and invite code when loaded", () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { useGroupDetail } = require("@hooks/use-group-detail");
    /* eslint-enable @typescript-eslint/no-require-imports */
    (useGroupDetail as jest.Mock).mockReturnValueOnce({
      group: {
        id: "7",
        name: "My Penca",
        description: null,
        avatar_url: null,
        invite_code: "ABCD1234",
        created_by: "u1",
        member_count: 5,
        role: "admin",
      },
      loading: false,
      error: null,
    });
    render(<GroupDetailScreen />);
    expect(screen.getByText("My Penca")).toBeTruthy();
    expect(screen.getByTestId("invite-code")).toBeTruthy();
  });

  it("renders create group screen", async () => {
    render(<CreateGroupScreen />);
    expect(screen.getAllByText("Create Group").length).toBeGreaterThan(0);
  });

  it("renders join group screen", () => {
    render(<JoinGroupScreen />);
    expect(screen.getByText("Join Group")).toBeTruthy();
  });
});

describe("Invite code section", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { useGroupDetail } = require("@hooks/use-group-detail");
  /* eslint-enable @typescript-eslint/no-require-imports */

  beforeEach(() => {
    jest.clearAllMocks();
    (useGroupDetail as jest.Mock).mockReturnValue({
      group: loadedGroup,
      loading: false,
      error: null,
    });
  });

  it("renders testID='invite-code' pill", () => {
    render(<GroupDetailScreen />);
    expect(screen.getByTestId("invite-code")).toBeTruthy();
  });

  it("tapping invite-code pill copies the code", () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId("invite-code"));
    expect(Clipboard.setString).toHaveBeenCalledWith("ABCD1234");
  });

  it("tapping copy-code-button copies the code", () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId("copy-code-button"));
    expect(Clipboard.setString).toHaveBeenCalledWith("ABCD1234");
  });

  it("tapping copy-link-button copies the full URL", () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId("copy-link-button"));
    expect(Clipboard.setString).toHaveBeenCalledWith(
      "https://pencaviva.app/join/ABCD1234",
    );
  });

  it("shows 'Code copied!' after tapping invite-code pill", () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId("invite-code"));
    expect(screen.getByText("Code copied!")).toBeTruthy();
  });

  it("shows 'Link copied!' after tapping copy-link-button", () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId("copy-link-button"));
    expect(screen.getByText("Link copied!")).toBeTruthy();
  });

  it("does not show 'Code copied!' on initial render", () => {
    render(<GroupDetailScreen />);
    expect(screen.queryByText("Code copied!")).toBeNull();
  });
});
