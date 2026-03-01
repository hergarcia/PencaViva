import React from "react";
import { render, screen } from "@testing-library/react-native";

import WelcomeScreen from "../../../app/(auth)/welcome";
import CompleteProfileScreen from "../../../app/(auth)/complete-profile";

// Mocks required by CompleteProfileScreen
jest.mock("@lib/supabase");
jest.mock("@lib/google-auth");

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock("@lib/profile-service", () => ({
  validateUsername: jest.fn(() => ({ isValid: false })),
  checkUsernameAvailable: jest.fn(),
  updateProfile: jest.fn(),
  checkProfileComplete: jest.fn(),
  USERNAME_MAX_LENGTH: 20,
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "test", email: "t@t.com", user_metadata: {} },
    session: { access_token: "test" },
    isAuthenticated: true,
    isInitialized: true,
    isLoading: false,
    error: null,
  }),
}));

describe("Auth screens", () => {
  it("renders Welcome screen with onboarding content", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("Predict Match Scores")).toBeTruthy();
  });

  it("renders Complete Profile screen with English text", () => {
    render(<CompleteProfileScreen />);
    expect(screen.getByText("Complete Your Profile")).toBeTruthy();
  });
});
