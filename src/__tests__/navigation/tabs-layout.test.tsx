import React from "react";
import { render, screen } from "@testing-library/react-native";

import TabsLayout from "../../../app/(tabs)/_layout";

describe("TabsLayout", () => {
  it("renders the tabs navigator", () => {
    render(<TabsLayout />);
    expect(screen.getByTestId("mock-tabs")).toBeTruthy();
  });
});
