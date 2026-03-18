import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ScoreStepper } from "@components/predictions/ScoreStepper";

describe("ScoreStepper", () => {
  const defaultProps = {
    teamName: "Team A",
    teamLogo: null,
    score: 0,
    onIncrement: jest.fn(),
    onDecrement: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders team name and score", () => {
    const { getByText } = render(<ScoreStepper {...defaultProps} />);
    expect(getByText("Team A")).toBeTruthy();
    expect(getByText("0")).toBeTruthy();
  });

  it("calls onIncrement when plus is pressed", () => {
    const onIncrement = jest.fn();
    const { getByTestId } = render(
      <ScoreStepper {...defaultProps} onIncrement={onIncrement} />,
    );
    fireEvent.press(getByTestId("increment-btn"));
    expect(onIncrement).toHaveBeenCalledTimes(1);
  });

  it("calls onDecrement when minus is pressed", () => {
    const onDecrement = jest.fn();
    const { getByTestId } = render(
      <ScoreStepper {...defaultProps} score={3} onDecrement={onDecrement} />,
    );
    fireEvent.press(getByTestId("decrement-btn"));
    expect(onDecrement).toHaveBeenCalledTimes(1);
  });

  it("disables minus button at score 0", () => {
    const onDecrement = jest.fn();
    const { getByTestId } = render(
      <ScoreStepper {...defaultProps} score={0} onDecrement={onDecrement} />,
    );
    fireEvent.press(getByTestId("decrement-btn"));
    expect(onDecrement).not.toHaveBeenCalled();
  });

  it("disables plus button at maxScore", () => {
    const onIncrement = jest.fn();
    const { getByTestId } = render(
      <ScoreStepper
        {...defaultProps}
        score={20}
        maxScore={20}
        onIncrement={onIncrement}
      />,
    );
    fireEvent.press(getByTestId("increment-btn"));
    expect(onIncrement).not.toHaveBeenCalled();
  });

  it("disables both buttons when disabled prop is true", () => {
    const onIncrement = jest.fn();
    const onDecrement = jest.fn();
    const { getByTestId } = render(
      <ScoreStepper
        {...defaultProps}
        score={5}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
        disabled
      />,
    );
    fireEvent.press(getByTestId("increment-btn"));
    fireEvent.press(getByTestId("decrement-btn"));
    expect(onIncrement).not.toHaveBeenCalled();
    expect(onDecrement).not.toHaveBeenCalled();
  });
});
