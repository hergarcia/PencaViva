import React from "react";
import { render, screen } from "@testing-library/react-native";
import OnboardingPageView from "@components/onboarding/OnboardingPageView";
import { ONBOARDING_PAGES } from "@lib/onboarding";

describe("OnboardingPageView", () => {
  const page = ONBOARDING_PAGES[0];

  it("renders the page title and subtitle", () => {
    render(<OnboardingPageView page={page} isActive={true} />);
    expect(screen.getByText(page.title)).toBeTruthy();
    expect(screen.getByText(page.subtitle)).toBeTruthy();
  });

  it("renders the icon", () => {
    render(<OnboardingPageView page={page} isActive={true} />);
    expect(screen.getByTestId(`icon-${page.icon}`)).toBeTruthy();
  });

  it("has a testID for the page container", () => {
    render(<OnboardingPageView page={page} isActive={true} />);
    expect(screen.getByTestId(`onboarding-page-${page.id}`)).toBeTruthy();
  });

  it("renders when inactive", () => {
    render(<OnboardingPageView page={page} isActive={false} />);
    expect(screen.getByText(page.title)).toBeTruthy();
  });
});
