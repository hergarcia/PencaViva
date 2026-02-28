import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";

import WelcomeScreen from "../../../app/(auth)/welcome";
import { ONBOARDING_PAGES, ONBOARDING_STORAGE_KEY } from "@lib/onboarding";

let mockRouter: { replace: jest.Mock; push: jest.Mock; back: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore as unknown as { __resetStore: () => void }).__resetStore();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mockRouter = require("expo-router").useRouter();
});

describe("WelcomeScreen", () => {
  it("renders the first onboarding page", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText(ONBOARDING_PAGES[0].title)).toBeTruthy();
  });

  it("renders Skip button on first page", () => {
    render(<WelcomeScreen />);
    expect(screen.getByTestId("skip-button")).toBeTruthy();
  });

  it("renders Next button on first page", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("does not show Get Started on first page", () => {
    render(<WelcomeScreen />);
    expect(screen.queryByText("Get Started")).toBeNull();
  });

  it("renders all three onboarding pages in scroll view", () => {
    render(<WelcomeScreen />);
    for (const page of ONBOARDING_PAGES) {
      expect(screen.getByTestId(`onboarding-page-${page.id}`)).toBeTruthy();
    }
  });

  it("renders page indicator with correct number of dots", () => {
    render(<WelcomeScreen />);
    expect(screen.getByTestId("page-indicator")).toBeTruthy();
    expect(screen.getByTestId("dot-0")).toBeTruthy();
    expect(screen.getByTestId("dot-1")).toBeTruthy();
    expect(screen.getByTestId("dot-2")).toBeTruthy();
  });

  it("stores completion and navigates to login on Skip press", () => {
    const setItemSpy = jest.spyOn(SecureStore, "setItem");

    render(<WelcomeScreen />);
    fireEvent.press(screen.getByTestId("skip-button"));

    expect(setItemSpy).toHaveBeenCalledWith(ONBOARDING_STORAGE_KEY, "true");
    expect(mockRouter.replace).toHaveBeenCalledWith("/(auth)/login");

    setItemSpy.mockRestore();
  });
});
