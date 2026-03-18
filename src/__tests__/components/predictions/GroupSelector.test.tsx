import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { GroupSelector } from "@components/predictions/GroupSelector";
import type { UserGroup } from "@lib/groups-service";

const groups: UserGroup[] = [
  {
    id: "g1",
    name: "Weekend Warriors",
    description: null,
    avatar_url: null,
    invite_code: "abc12345",
    created_by: "u1",
    member_count: 5,
    scoring_system: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
    role: "admin",
  },
  {
    id: "g2",
    name: "Office League",
    description: null,
    avatar_url: null,
    invite_code: "def67890",
    created_by: "u2",
    member_count: 8,
    scoring_system: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
    role: "member",
  },
];

describe("GroupSelector", () => {
  it("renders active group name", () => {
    const { getByText } = render(
      <GroupSelector
        groups={groups}
        activeGroup={groups[0]}
        onSelect={jest.fn()}
      />,
    );
    expect(getByText("Weekend Warriors")).toBeTruthy();
  });

  it("opens modal and shows all groups when pressed", () => {
    const { getByTestId, getByText } = render(
      <GroupSelector
        groups={groups}
        activeGroup={groups[0]}
        onSelect={jest.fn()}
      />,
    );

    fireEvent.press(getByTestId("group-selector-button"));
    expect(getByText("Office League")).toBeTruthy();
  });

  it("calls onSelect when a group is tapped", () => {
    const onSelect = jest.fn();
    const { getByTestId, getByText } = render(
      <GroupSelector
        groups={groups}
        activeGroup={groups[0]}
        onSelect={onSelect}
      />,
    );

    fireEvent.press(getByTestId("group-selector-button"));
    fireEvent.press(getByText("Office League"));
    expect(onSelect).toHaveBeenCalledWith("g2");
  });
});
