import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "@stores/auth-store";

import Index from "../../../app/index";

// Mock supabase to prevent env var validation at import time
jest.mock("@lib/supabase");
jest.mock("@lib/google-auth");
jest.mock("@stores/auth-store");

const mockCheckProfileComplete = jest.fn();
jest.mock("@lib/profile-service", () => ({
  checkProfileComplete: (...args: unknown[]) =>
    mockCheckProfileComplete(...args),
}));

function setupAuthStore(
  overrides: Partial<{
    isInitialized: boolean;
    session: unknown;
    user: unknown;
  }> = {},
) {
  const state = {
    isInitialized: true,
    session: null,
    user: null,
    ...overrides,
  };

  (useAuthStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state),
  );
}

beforeEach(() => {
  (SecureStore as unknown as { __resetStore: () => void }).__resetStore();
  jest.clearAllMocks();
  setupAuthStore();
  mockCheckProfileComplete.mockResolvedValue(true);
});

describe("Root index redirect", () => {
  it("redirects to welcome when onboarding not completed", async () => {
    render(<Index />);

    await waitFor(() => {
      expect(screen.getByText("Redirect to /(auth)/welcome")).toBeTruthy();
    });
  });

  it("redirects to login when onboarding completed but not authenticated", async () => {
    SecureStore.setItem("onboarding_completed", "true");

    render(<Index />);

    await waitFor(() => {
      expect(screen.getByText("Redirect to /(auth)/login")).toBeTruthy();
    });
  });

  it("redirects to tabs when onboarding completed and authenticated", async () => {
    SecureStore.setItem("onboarding_completed", "true");
    setupAuthStore({
      isInitialized: true,
      session: { access_token: "test", user: { id: "123" } },
      user: { id: "123" },
    });
    mockCheckProfileComplete.mockResolvedValue(true);

    render(<Index />);

    await waitFor(() => {
      expect(screen.getByText("Redirect to /(tabs)")).toBeTruthy();
    });
  });
});
