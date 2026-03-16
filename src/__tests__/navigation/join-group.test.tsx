import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// ── Mocks ────────────────────────────────────────────────────────────

jest.mock("@lib/groups-service", () => ({
  lookupGroupByInviteCode: jest.fn(),
  joinGroupByCode: jest.fn(),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: jest.fn(),
}));

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}) as Record<string, string>);

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: mockBack,
  }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

// Must import AFTER mocks
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  lookupGroupByInviteCode,
  joinGroupByCode,
} = require("@lib/groups-service");
const { useAuth } = require("@hooks/use-auth");
const JoinGroupScreen = require("../../../app/(tabs)/groups/join").default;
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: { id: "user-1" } });
  mockUseLocalSearchParams.mockReturnValue({});
});

describe("JoinGroupScreen", () => {
  it("renders 8 empty input boxes in idle state", () => {
    const { getAllByTestId, queryByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);
    expect(inputs).toHaveLength(8);
    expect(queryByTestId("group-preview")).toBeNull();
    expect(queryByTestId("error-message")).toBeNull();
  });

  it("renders the Join Group title", () => {
    const { getByText } = render(<JoinGroupScreen />);
    expect(getByText("Join Group")).toBeTruthy();
  });

  it("auto-triggers lookup when all 8 characters are entered", async () => {
    lookupGroupByInviteCode.mockResolvedValueOnce({
      id: "g-1",
      name: "Test Group",
      description: null,
      avatar_url: null,
      member_count: 5,
      max_members: 50,
      scoring_system: {
        exact_score: 5,
        correct_result: 3,
        correct_goal_diff: 1,
        wrong: 0,
      },
    });

    const { getAllByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);

    // Type 8 hex characters
    const code = "AB12CD34";
    await act(async () => {
      for (let i = 0; i < 8; i++) {
        fireEvent.changeText(inputs[i], code[i]);
      }
    });

    await waitFor(() => {
      expect(lookupGroupByInviteCode).toHaveBeenCalledWith("AB12CD34");
    });
  });

  it("does not trigger lookup with fewer than 8 characters", () => {
    const { getAllByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);

    for (let i = 0; i < 7; i++) {
      fireEvent.changeText(inputs[i], "A");
    }

    expect(lookupGroupByInviteCode).not.toHaveBeenCalled();
  });

  it("uppercases input characters", () => {
    const { getAllByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);

    fireEvent.changeText(inputs[0], "a");

    // The displayed value should be uppercased
    expect(inputs[0].props.value).toBe("A");
  });

  it("rejects non-hex characters", () => {
    const { getAllByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);

    fireEvent.changeText(inputs[0], "G");
    expect(inputs[0].props.value).toBe("");

    fireEvent.changeText(inputs[0], "Z");
    expect(inputs[0].props.value).toBe("");

    // Valid hex should work
    fireEvent.changeText(inputs[0], "F");
    expect(inputs[0].props.value).toBe("F");
  });

  it("shows group preview card on successful lookup", async () => {
    lookupGroupByInviteCode.mockResolvedValueOnce({
      id: "g-1",
      name: "Uruguay Squad",
      description: "Predictions for Copa America",
      avatar_url: null,
      member_count: 12,
      max_members: 50,
      scoring_system: {
        exact_score: 5,
        correct_result: 3,
        correct_goal_diff: 1,
        wrong: 0,
      },
    });

    const { getAllByTestId, getByTestId, getByText } = render(
      <JoinGroupScreen />,
    );
    const inputs = getAllByTestId(/^code-input-/);

    await act(async () => {
      const code = "AB12CD34";
      for (let i = 0; i < 8; i++) {
        fireEvent.changeText(inputs[i], code[i]);
      }
    });

    await waitFor(() => {
      expect(getByTestId("group-preview")).toBeTruthy();
    });

    expect(getByText("Uruguay Squad")).toBeTruthy();
    expect(getByText("12 / 50 members")).toBeTruthy();
    expect(getByText("Predictions for Copa America")).toBeTruthy();
    expect(getByText("Exact: 5pts")).toBeTruthy();
    expect(getByTestId("join-button")).toBeTruthy();
  });

  it("shows loading spinner during lookup", async () => {
    // Never resolves — stays in loading state
    lookupGroupByInviteCode.mockReturnValueOnce(new Promise(() => {}));

    const { getAllByTestId, getByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);

    await act(async () => {
      const code = "AB12CD34";
      for (let i = 0; i < 8; i++) {
        fireEvent.changeText(inputs[i], code[i]);
      }
    });

    expect(getByTestId("loading-indicator")).toBeTruthy();
  });

  it("shows error for group_not_found", async () => {
    lookupGroupByInviteCode.mockRejectedValueOnce(new Error("group_not_found"));

    const { getAllByTestId, getByTestId, getByText } = render(
      <JoinGroupScreen />,
    );
    const inputs = getAllByTestId(/^code-input-/);

    await act(async () => {
      const code = "AB12CD34";
      for (let i = 0; i < 8; i++) {
        fireEvent.changeText(inputs[i], code[i]);
      }
    });

    await waitFor(() => {
      expect(getByTestId("error-message")).toBeTruthy();
    });
    expect(getByText("No group found with this code")).toBeTruthy();
  });

  it("shows error for group_full on join", async () => {
    lookupGroupByInviteCode.mockResolvedValueOnce({
      id: "g-1",
      name: "Full Group",
      description: null,
      avatar_url: null,
      member_count: 50,
      max_members: 50,
      scoring_system: {
        exact_score: 5,
        correct_result: 3,
        correct_goal_diff: 1,
        wrong: 0,
      },
    });
    joinGroupByCode.mockRejectedValueOnce(new Error("group_full"));

    const { getAllByTestId, getByTestId, getByText } = render(
      <JoinGroupScreen />,
    );
    const inputs = getAllByTestId(/^code-input-/);

    await act(async () => {
      const code = "AB12CD34";
      for (let i = 0; i < 8; i++) {
        fireEvent.changeText(inputs[i], code[i]);
      }
    });

    await waitFor(() => {
      expect(getByTestId("join-button")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("join-button"));
    });

    await waitFor(() => {
      expect(getByText("This group is full")).toBeTruthy();
    });
  });

  it("shows error for already_member on join", async () => {
    lookupGroupByInviteCode.mockResolvedValueOnce({
      id: "g-1",
      name: "Test Group",
      description: null,
      avatar_url: null,
      member_count: 5,
      max_members: 50,
      scoring_system: {
        exact_score: 5,
        correct_result: 3,
        correct_goal_diff: 1,
        wrong: 0,
      },
    });
    joinGroupByCode.mockRejectedValueOnce(new Error("already_member"));

    const { getAllByTestId, getByTestId, getByText } = render(
      <JoinGroupScreen />,
    );
    const inputs = getAllByTestId(/^code-input-/);

    await act(async () => {
      const code = "AB12CD34";
      for (let i = 0; i < 8; i++) {
        fireEvent.changeText(inputs[i], code[i]);
      }
    });

    await waitFor(() => {
      expect(getByTestId("join-button")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("join-button"));
    });

    await waitFor(() => {
      expect(getByText("You're already a member of this group")).toBeTruthy();
    });
  });

  it("navigates to group detail on successful join", async () => {
    lookupGroupByInviteCode.mockResolvedValueOnce({
      id: "g-1",
      name: "Test Group",
      description: null,
      avatar_url: null,
      member_count: 5,
      max_members: 50,
      scoring_system: {
        exact_score: 5,
        correct_result: 3,
        correct_goal_diff: 1,
        wrong: 0,
      },
    });
    joinGroupByCode.mockResolvedValueOnce({
      id: "g-1",
      name: "Test Group",
      invite_code: "AB12CD34",
    });

    const { getAllByTestId, getByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);

    // Enter code
    await act(async () => {
      const code = "AB12CD34";
      for (let i = 0; i < 8; i++) {
        fireEvent.changeText(inputs[i], code[i]);
      }
    });

    // Wait for preview
    await waitFor(() => {
      expect(getByTestId("join-button")).toBeTruthy();
    });

    // Press join
    await act(async () => {
      fireEvent.press(getByTestId("join-button"));
    });

    await waitFor(() => {
      expect(joinGroupByCode).toHaveBeenCalledWith("AB12CD34");
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/groups/g-1");
    });
  });

  it("shows generic error on network failure during join", async () => {
    lookupGroupByInviteCode.mockResolvedValueOnce({
      id: "g-1",
      name: "Test Group",
      description: null,
      avatar_url: null,
      member_count: 5,
      max_members: 50,
      scoring_system: {
        exact_score: 5,
        correct_result: 3,
        correct_goal_diff: 1,
        wrong: 0,
      },
    });
    joinGroupByCode.mockRejectedValueOnce(new Error("Network request failed"));

    const { getAllByTestId, getByTestId, getByText } = render(
      <JoinGroupScreen />,
    );
    const inputs = getAllByTestId(/^code-input-/);

    await act(async () => {
      const code = "AB12CD34";
      for (let i = 0; i < 8; i++) {
        fireEvent.changeText(inputs[i], code[i]);
      }
    });

    await waitFor(() => {
      expect(getByTestId("join-button")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("join-button"));
    });

    await waitFor(() => {
      expect(getByText("Something went wrong. Please try again.")).toBeTruthy();
    });
  });

  it("pre-fills digits from code param on mount", async () => {
    mockUseLocalSearchParams.mockReturnValue({ code: "ABC12345" });

    const { getAllByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);

    await waitFor(() => {
      expect(inputs[0].props.value).toBe("A");
      expect(inputs[1].props.value).toBe("B");
      expect(inputs[2].props.value).toBe("C");
      expect(inputs[3].props.value).toBe("1");
      expect(inputs[4].props.value).toBe("2");
      expect(inputs[5].props.value).toBe("3");
      expect(inputs[6].props.value).toBe("4");
      expect(inputs[7].props.value).toBe("5");
    });
  });

  it("does not auto-trigger lookup when pre-filling from code param", async () => {
    mockUseLocalSearchParams.mockReturnValue({ code: "ABC12345" });

    render(<JoinGroupScreen />);

    await new Promise((r) => setTimeout(r, 50));
    expect(lookupGroupByInviteCode).not.toHaveBeenCalled();
  });

  it("ignores invalid code param (wrong length) on mount", async () => {
    mockUseLocalSearchParams.mockReturnValue({ code: "SHORT" });

    const { getAllByTestId } = render(<JoinGroupScreen />);
    const inputs = getAllByTestId(/^code-input-/);

    await new Promise((r) => setTimeout(r, 50));
    // All inputs remain empty
    inputs.forEach((input) => {
      expect(input.props.value).toBe("");
    });
    expect(lookupGroupByInviteCode).not.toHaveBeenCalled();
  });

  it("clears preview when a character is deleted", async () => {
    lookupGroupByInviteCode.mockResolvedValueOnce({
      id: "g-1",
      name: "Test Group",
      description: null,
      avatar_url: null,
      member_count: 5,
      max_members: 50,
      scoring_system: {
        exact_score: 5,
        correct_result: 3,
        correct_goal_diff: 1,
        wrong: 0,
      },
    });

    const { getAllByTestId, getByTestId, queryByTestId } = render(
      <JoinGroupScreen />,
    );
    const inputs = getAllByTestId(/^code-input-/);

    // Enter full code
    await act(async () => {
      const code = "AB12CD34";
      for (let i = 0; i < 8; i++) {
        fireEvent.changeText(inputs[i], code[i]);
      }
    });

    await waitFor(() => {
      expect(getByTestId("group-preview")).toBeTruthy();
    });

    // Clear a character
    await act(async () => {
      fireEvent.changeText(inputs[7], "");
    });

    expect(queryByTestId("group-preview")).toBeNull();
  });
});
