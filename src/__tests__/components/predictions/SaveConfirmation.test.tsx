import React from "react";
import { render } from "@testing-library/react-native";
import { SaveConfirmation } from "@components/predictions/SaveConfirmation";

describe("SaveConfirmation", () => {
  it("renders nothing when visible is false", () => {
    const { toJSON } = render(
      <SaveConfirmation visible={false} onDismiss={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders confetti when visible is true", () => {
    jest.useFakeTimers();
    const { getByTestId } = render(
      <SaveConfirmation visible={true} onDismiss={jest.fn()} />,
    );
    expect(getByTestId("confetti-container")).toBeTruthy();
    jest.useRealTimers();
  });

  it("renders checkmark icon when visible", () => {
    jest.useFakeTimers();
    const { toJSON } = render(
      <SaveConfirmation visible={true} onDismiss={jest.fn()} />,
    );
    expect(toJSON()).toBeTruthy();
    jest.useRealTimers();
  });
});
