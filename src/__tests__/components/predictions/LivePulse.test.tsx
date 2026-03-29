import React from "react";
import { render } from "@testing-library/react-native";
import { LivePulse } from "@components/predictions/LivePulse";

describe("LivePulse", () => {
  it("renders with testID", () => {
    const { getByTestId } = render(<LivePulse />);
    expect(getByTestId("live-pulse-dot")).toBeTruthy();
  });

  it("applies custom size prop", () => {
    const { getByTestId } = render(<LivePulse size={10} />);
    const dot = getByTestId("live-pulse-dot");
    expect(dot.props.style).toBeDefined();
  });

  it("renders without crashing with default props", () => {
    const { toJSON } = render(<LivePulse />);
    expect(toJSON()).toBeTruthy();
  });
});
