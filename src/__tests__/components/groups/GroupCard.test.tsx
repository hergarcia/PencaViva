import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { GroupCard } from "@components/groups/GroupCard";
import type { UserGroup } from "@lib/groups-service";

const baseGroup: UserGroup = {
  id: "g1",
  name: "Weekend Warriors",
  description: "Sunday league predictions",
  avatar_url: null,
  invite_code: "abc12345",
  created_by: "user-1",
  member_count: 5,
  role: "admin",
};

describe("GroupCard", () => {
  it("renders group name", () => {
    const { getByText } = render(
      <GroupCard group={baseGroup} onPress={jest.fn()} />,
    );
    expect(getByText("Weekend Warriors")).toBeTruthy();
  });

  it("renders description when provided", () => {
    const { getByText } = render(
      <GroupCard group={baseGroup} onPress={jest.fn()} />,
    );
    expect(getByText("Sunday league predictions")).toBeTruthy();
  });

  it("renders member count", () => {
    const { getByText } = render(
      <GroupCard group={baseGroup} onPress={jest.fn()} />,
    );
    expect(getByText("5 members")).toBeTruthy();
  });

  it("renders singular 'member' for count of 1", () => {
    const group = { ...baseGroup, member_count: 1 };
    const { getByText } = render(
      <GroupCard group={group} onPress={jest.fn()} />,
    );
    expect(getByText("1 member")).toBeTruthy();
  });

  it("renders role badge for admin", () => {
    const { getByTestId } = render(
      <GroupCard group={baseGroup} onPress={jest.fn()} />,
    );
    expect(getByTestId("role-badge")).toBeTruthy();
  });

  it("does not render role badge for member", () => {
    const group = { ...baseGroup, role: "member" as const };
    const { queryByTestId } = render(
      <GroupCard group={group} onPress={jest.fn()} />,
    );
    expect(queryByTestId("role-badge")).toBeNull();
  });

  it("calls onPress with group id when pressed", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <GroupCard group={baseGroup} onPress={onPress} />,
    );
    fireEvent.press(getByTestId("group-card-g1"));
    expect(onPress).toHaveBeenCalledWith("g1");
  });

  it("renders letter avatar when no avatar_url", () => {
    const { getByText } = render(
      <GroupCard group={baseGroup} onPress={jest.fn()} />,
    );
    expect(getByText("W")).toBeTruthy();
  });

  it("renders image avatar when avatar_url is provided", () => {
    const group = { ...baseGroup, avatar_url: "https://example.com/a.png" };
    const { getByTestId } = render(
      <GroupCard group={group} onPress={jest.fn()} />,
    );
    expect(getByTestId("group-avatar-image")).toBeTruthy();
  });

  it("does not render description when null", () => {
    const group = { ...baseGroup, description: null };
    const { queryByTestId } = render(
      <GroupCard group={group} onPress={jest.fn()} />,
    );
    expect(queryByTestId("group-description")).toBeNull();
  });
});
