import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ErrorState } from "@components/ErrorState";

describe("ErrorState", () => {
  it("renders error message and default title", () => {
    const { getByText } = render(<ErrorState message="Network error" />);
    expect(getByText("Something went wrong")).toBeTruthy();
    expect(getByText("Network error")).toBeTruthy();
  });

  it("renders default icon", () => {
    const { getByTestId } = render(<ErrorState message="Error" />);
    expect(getByTestId("error-state-icon")).toBeTruthy();
  });

  it("renders retry button when onRetry provided", () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <ErrorState message="Error" onRetry={onRetry} />,
    );
    const button = getByText("Try again");
    expect(button).toBeTruthy();
    fireEvent.press(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render retry button when onRetry is undefined", () => {
    const { queryByText } = render(<ErrorState message="Error" />);
    expect(queryByText("Try again")).toBeNull();
  });

  it("renders custom title when provided", () => {
    const { getByText } = render(
      <ErrorState message="Details here" title="Custom Title" />,
    );
    expect(getByText("Custom Title")).toBeTruthy();
    expect(getByText("Details here")).toBeTruthy();
  });
});
