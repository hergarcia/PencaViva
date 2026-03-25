import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { EmptyState } from "@components/common/EmptyState";

describe("EmptyState", () => {
  it("renders icon, title, and description", () => {
    const { getByText, getByTestId } = render(
      <EmptyState
        icon="football-outline"
        title="No matches"
        description="Check back later"
      />,
    );
    expect(getByTestId("empty-state-icon")).toBeTruthy();
    expect(getByText("No matches")).toBeTruthy();
    expect(getByText("Check back later")).toBeTruthy();
  });

  it("renders without description", () => {
    const { getByText, queryByTestId } = render(
      <EmptyState icon="trophy-outline" title="No rankings" />,
    );
    expect(getByText("No rankings")).toBeTruthy();
    expect(queryByTestId("empty-state-description")).toBeNull();
  });

  it("renders primary action button", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EmptyState
        icon="people-outline"
        title="No groups"
        actions={[{ label: "Create", onPress, variant: "primary" }]}
      />,
    );
    fireEvent.press(getByText("Create"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders outline action button", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EmptyState
        icon="people-outline"
        title="No groups"
        actions={[{ label: "Join", onPress, variant: "outline" }]}
      />,
    );
    fireEvent.press(getByText("Join"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders multiple action buttons", () => {
    const { getByText } = render(
      <EmptyState
        icon="people-outline"
        title="No groups"
        description="Join or create a group"
        actions={[
          { label: "Join", onPress: jest.fn(), variant: "outline" },
          { label: "Create", onPress: jest.fn(), variant: "primary" },
        ]}
      />,
    );
    expect(getByText("Join")).toBeTruthy();
    expect(getByText("Create")).toBeTruthy();
  });

  it("uses custom icon size", () => {
    const { getByTestId } = render(
      <EmptyState icon="people-outline" iconSize={64} title="No groups" />,
    );
    expect(getByTestId("empty-state-icon")).toBeTruthy();
  });
});
