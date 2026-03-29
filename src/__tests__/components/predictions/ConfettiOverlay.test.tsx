import React from "react";
import { render } from "@testing-library/react-native";
import { ConfettiOverlay } from "@components/predictions/ConfettiOverlay";

describe("ConfettiOverlay", () => {
  it("renders nothing when active is false", () => {
    const { toJSON } = render(<ConfettiOverlay active={false} />);
    expect(toJSON()).toBeNull();
  });

  it("renders particles when active is true", () => {
    const { getByTestId } = render(<ConfettiOverlay active={true} />);
    expect(getByTestId("confetti-container")).toBeTruthy();
  });

  it("renders 30 particle elements", () => {
    const { getAllByTestId } = render(<ConfettiOverlay active={true} />);
    expect(getAllByTestId(/^confetti-particle-/)).toHaveLength(30);
  });

  it("renders without crashing when toggled active", () => {
    const { rerender, getByTestId, toJSON } = render(
      <ConfettiOverlay active={false} />,
    );
    expect(toJSON()).toBeNull();
    rerender(<ConfettiOverlay active={true} />);
    expect(getByTestId("confetti-container")).toBeTruthy();
  });
});
