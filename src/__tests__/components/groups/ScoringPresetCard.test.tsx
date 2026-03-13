import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ScoringPresetCard } from "@components/groups/ScoringPresetCard";

const preset = {
  key: "balanced",
  label: "Balanced",
  description: "A fair mix of rewards.",
  values: { exact_score: 5, correct_result: 3, correct_goal_diff: 1, wrong: 0 },
};

describe("ScoringPresetCard", () => {
  it("renders label and description", () => {
    const { getByText } = render(
      <ScoringPresetCard
        preset={preset}
        selected={false}
        onPress={jest.fn()}
      />,
    );
    expect(getByText("Balanced")).toBeTruthy();
    expect(getByText("A fair mix of rewards.")).toBeTruthy();
  });

  it("shows checkmark when selected", () => {
    const { getByText } = render(
      <ScoringPresetCard preset={preset} selected={true} onPress={jest.fn()} />,
    );
    expect(getByText("✓")).toBeTruthy();
  });

  it("does not show checkmark when not selected", () => {
    const { queryByText } = render(
      <ScoringPresetCard
        preset={preset}
        selected={false}
        onPress={jest.fn()}
      />,
    );
    expect(queryByText("✓")).toBeNull();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <ScoringPresetCard preset={preset} selected={false} onPress={onPress} />,
    );
    fireEvent.press(getByRole("radio"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("has accessibilityState selected=true when selected", () => {
    const { getByRole } = render(
      <ScoringPresetCard preset={preset} selected={true} onPress={jest.fn()} />,
    );
    expect(getByRole("radio").props.accessibilityState.selected).toBe(true);
  });

  it("has accessibilityState selected=false when not selected", () => {
    const { getByRole } = render(
      <ScoringPresetCard
        preset={preset}
        selected={false}
        onPress={jest.fn()}
      />,
    );
    expect(getByRole("radio").props.accessibilityState.selected).toBe(false);
  });
});
