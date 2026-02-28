import React from "react";
import { render, screen } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";

import Index from "../../../app/index";

beforeEach(() => {
  (SecureStore as unknown as { __resetStore: () => void }).__resetStore();
});

describe("Root index redirect", () => {
  it("redirects to welcome when onboarding not completed", () => {
    render(<Index />);
    const redirect = screen.getByTestId("mock-redirect");
    expect(redirect).toBeTruthy();
    expect(screen.getByText("Redirect to /(auth)/welcome")).toBeTruthy();
  });

  it("redirects to tabs when onboarding is completed", () => {
    SecureStore.setItem("onboarding_completed", "true");

    render(<Index />);
    expect(screen.getByText("Redirect to /(tabs)")).toBeTruthy();
  });
});
