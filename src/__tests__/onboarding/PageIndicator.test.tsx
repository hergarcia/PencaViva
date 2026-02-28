import React from "react";
import { render, screen } from "@testing-library/react-native";
import PageIndicator from "@components/onboarding/PageIndicator";

describe("PageIndicator", () => {
  it("renders the correct number of dots", () => {
    render(<PageIndicator total={3} activeIndex={0} />);
    expect(screen.getByTestId("dot-0")).toBeTruthy();
    expect(screen.getByTestId("dot-1")).toBeTruthy();
    expect(screen.getByTestId("dot-2")).toBeTruthy();
  });

  it("renders the indicator container", () => {
    render(<PageIndicator total={3} activeIndex={1} />);
    expect(screen.getByTestId("page-indicator")).toBeTruthy();
  });
});
