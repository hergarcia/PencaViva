import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import GroupDetailScreen from "../../../app/groups/[id]";
import CreateGroupScreen from "../../../app/groups/create";
import JoinGroupScreen from "../../../app/groups/join";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "7" }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, isInitialized: true }),
}));

jest.mock("@lib/groups-service", () => ({
  createGroup: jest.fn(),
  fetchActiveTournaments: jest.fn().mockResolvedValue([]),
  fetchGroupById: jest.fn(),
  fetchGroupMembers: jest.fn(),
  fetchGroupTournaments: jest.fn(),
  lookupGroupByInviteCode: jest.fn(),
  joinGroupByCode: jest.fn(),
}));

jest.mock("@hooks/use-group-detail", () => ({
  useGroupDetail: jest.fn().mockReturnValue({
    group: null,
    members: [],
    tournaments: [],
    loading: true,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock("@react-native-clipboard/clipboard");
/* eslint-disable @typescript-eslint/no-require-imports */
const Clipboard = require("@react-native-clipboard/clipboard").default;
const Haptics = require("expo-haptics");
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
  scoring_system: {
    exact_score: 5,
    correct_result: 3,
    correct_goal_diff: 1,
    wrong: 0,
  },
};

describe("Group nested screens", () => {
  it("renders loading state for group detail", () => {
    render(<GroupDetailScreen />);
    expect(screen.getByTestId("loading-indicator")).toBeTruthy();
  });

  it("renders group name and back button when loaded", () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { useGroupDetail } = require("@hooks/use-group-detail");
    /* eslint-enable @typescript-eslint/no-require-imports */
    (useGroupDetail as jest.Mock).mockReturnValueOnce({
      group: loadedGroup,
      members: [],
      tournaments: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<GroupDetailScreen />);
    expect(screen.getByText("My Penca")).toBeTruthy();
    expect(screen.getByTestId("back-button")).toBeTruthy();
    expect(screen.getByTestId("members-list")).toBeTruthy();
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
      members: [],
      tournaments: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  function renderAndOpenInfoTab() {
    const utils = render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    return utils;
  }

  it("renders testID='invite-code' pill on Info tab", () => {
    renderAndOpenInfoTab();
    expect(screen.getByTestId("invite-code")).toBeTruthy();
  });

  it("tapping invite-code pill copies the code", () => {
    renderAndOpenInfoTab();
    fireEvent.press(screen.getByTestId("invite-code"));
    expect(Clipboard.setString).toHaveBeenCalledWith("ABCD1234");
  });

  it("tapping copy-link-button copies the full URL", () => {
    renderAndOpenInfoTab();
    fireEvent.press(screen.getByTestId("copy-link-button"));
    expect(Clipboard.setString).toHaveBeenCalledWith(
      "https://pencaviva.app/join/ABCD1234",
    );
  });

  it("shows 'Code copied!' after tapping invite-code pill", () => {
    renderAndOpenInfoTab();
    fireEvent.press(screen.getByTestId("invite-code"));
    expect(screen.getByText("Code copied!")).toBeTruthy();
  });

  it("shows 'Link copied!' after tapping copy-link-button", () => {
    renderAndOpenInfoTab();
    fireEvent.press(screen.getByTestId("copy-link-button"));
    expect(screen.getByText("Link copied!")).toBeTruthy();
  });

  it("does not show 'Code copied!' on initial render", () => {
    renderAndOpenInfoTab();
    expect(screen.queryByText("Code copied!")).toBeNull();
  });

  it("fires success haptic when copying invite code", () => {
    renderAndOpenInfoTab();
    fireEvent.press(screen.getByTestId("invite-code"));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  it("fires success haptic when copying link", () => {
    renderAndOpenInfoTab();
    fireEvent.press(screen.getByTestId("copy-link-button"));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });
});

describe("Group detail tabs", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { useGroupDetail } = require("@hooks/use-group-detail");
  /* eslint-enable @typescript-eslint/no-require-imports */

  const members = [
    {
      user_id: "user-1",
      display_name: "Bob",
      username: "bob",
      avatar_url: null,
      points_total: 20,
      role: "admin" as const,
      joined_at: "2024-01-01T00:00:00Z",
    },
    {
      user_id: "user-2",
      display_name: "Alice",
      username: "alice",
      avatar_url: null,
      points_total: 10,
      role: "member" as const,
      joined_at: "2024-01-02T00:00:00Z",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useGroupDetail as jest.Mock).mockReturnValue({
      group: loadedGroup,
      members,
      tournaments: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it("renders Members tab by default", () => {
    render(<GroupDetailScreen />);
    expect(screen.getByTestId("tab-members")).toBeTruthy();
    expect(screen.getByTestId("tab-info")).toBeTruthy();
    expect(screen.getByTestId("members-list")).toBeTruthy();
  });

  it("renders member rows", () => {
    render(<GroupDetailScreen />);
    expect(screen.getByTestId("member-row-user-1")).toBeTruthy();
    expect(screen.getByTestId("member-row-user-2")).toBeTruthy();
  });

  it("marks the current user's row with You badge", () => {
    render(<GroupDetailScreen />);
    expect(screen.getByTestId("you-badge-user-1")).toBeTruthy();
    expect(screen.queryByTestId("you-badge-user-2")).toBeNull();
  });

  it("switches to Info tab when tapped", () => {
    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    expect(screen.getByTestId("group-info-tab")).toBeTruthy();
  });

  it("fires selection haptic on tab switch", () => {
    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it("renders scoring grid on Info tab", () => {
    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    expect(screen.getByTestId("scoring-exact-score")).toBeTruthy();
    expect(screen.getByTestId("scoring-correct-result")).toBeTruthy();
  });

  it("renders invite code on Info tab", () => {
    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    expect(screen.getByTestId("invite-code")).toBeTruthy();
  });

  it("renders no-tournaments message when tournaments list is empty", () => {
    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    expect(screen.getByText("No tournaments assigned yet.")).toBeTruthy();
  });

  it("renders tournament items when tournaments exist", () => {
    (useGroupDetail as jest.Mock).mockReturnValue({
      group: loadedGroup,
      members,
      tournaments: [
        { id: "t1", name: "Premier League", short_name: "PL", logo_url: null },
      ],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    expect(screen.getByTestId("tournament-t1")).toBeTruthy();
    expect(screen.getByText("Premier League (PL)")).toBeTruthy();
  });

  it("shows Manage button for admin on Info tab", () => {
    (useGroupDetail as jest.Mock).mockReturnValue({
      group: { ...loadedGroup, role: "admin" },
      members,
      tournaments: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    expect(screen.getByTestId("manage-tournaments-button")).toBeTruthy();
  });

  it("hides Manage button for non-admin on Info tab", () => {
    (useGroupDetail as jest.Mock).mockReturnValue({
      group: { ...loadedGroup, role: "member" },
      members,
      tournaments: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId("tab-info"));
    expect(screen.queryByTestId("manage-tournaments-button")).toBeNull();
  });
});
