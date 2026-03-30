import React from "react";
import { render } from "@testing-library/react-native";
import { ExactStar } from "@components/common/ExactStar";

describe("ExactStar", () => {
  it("renders with testID", () => {
    const { getByTestId } = render(<ExactStar />);
    expect(getByTestId("exact-star")).toBeTruthy();
  });

  it("renders with animated=false by default", () => {
    const { getByTestId } = render(<ExactStar />);
    expect(getByTestId("exact-star")).toBeTruthy();
  });

  it("renders with animated=true", () => {
    const { getByTestId } = render(<ExactStar animated />);
    expect(getByTestId("exact-star")).toBeTruthy();
  });

  it("accepts custom size", () => {
    const { getByTestId } = render(<ExactStar size={20} />);
    expect(getByTestId("exact-star")).toBeTruthy();
  });

  it("renders without crashing", () => {
    const { toJSON } = render(<ExactStar />);
    expect(toJSON()).toBeTruthy();
  });
});
