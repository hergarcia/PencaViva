import React from "react";
import { render } from "@testing-library/react-native";
import { PredictionBadge } from "@components/predictions/PredictionBadge";

describe("PredictionBadge", () => {
  it("renders 'Predicted' for predicted status", () => {
    const { getByText } = render(<PredictionBadge status="predicted" />);
    expect(getByText("Predicted")).toBeTruthy();
  });

  it("renders 'Open' for open status", () => {
    const { getByText } = render(<PredictionBadge status="open" />);
    expect(getByText("Open")).toBeTruthy();
  });

  it("renders 'Closed' for closed status", () => {
    const { getByText } = render(<PredictionBadge status="closed" />);
    expect(getByText("Closed")).toBeTruthy();
  });

  it("shows predicted score when provided", () => {
    const { getByText } = render(
      <PredictionBadge
        status="predicted"
        predictedHome={2}
        predictedAway={1}
      />,
    );
    expect(getByText("Your pick: 2-1")).toBeTruthy();
  });

  it("does not show score for open status", () => {
    const { queryByText } = render(<PredictionBadge status="open" />);
    expect(queryByText(/Your pick/)).toBeNull();
  });
});
