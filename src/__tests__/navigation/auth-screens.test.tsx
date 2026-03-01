import React from "react";
import { render, screen } from "@testing-library/react-native";

import WelcomeScreen from "../../../app/(auth)/welcome";
import CompleteProfileScreen from "../../../app/(auth)/complete-profile";

describe("Auth placeholder screens", () => {
  it("renders Welcome screen with onboarding content", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("Predict Match Scores")).toBeTruthy();
  });

  it("renders Complete Profile screen with English text", () => {
    render(<CompleteProfileScreen />);
    expect(screen.getByText("Complete Profile")).toBeTruthy();
  });
});
