import React from "react";
import { render, screen } from "@testing-library/react-native";

import Index from "../../../app/index";

describe("App Index", () => {
  it("redirects to /(tabs)", () => {
    render(<Index />);
    const redirect = screen.getByTestId("mock-redirect");
    expect(redirect).toBeTruthy();
  });
});
