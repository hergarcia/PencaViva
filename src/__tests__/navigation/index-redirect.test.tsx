import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "@stores/auth-store";

import Index from "../../../app/index";

// Mock supabase to prevent env var validation at import time
jest.mock("@lib/supabase");
jest.mock("@lib/google-auth");
jest.mock("@stores/auth-store");

function setupAuthStore(
  overrides: Partial<{
    isInitialized: boolean;
    session: unknown;
  }> = {},
) {
  const state = {
    isInitialized: true,
    session: null,
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
});

describe("App Index", () => {
  it("renders null when auth is not initialized", async () => {
    setupAuthStore({ isInitialized: false });
    const { toJSON } = render(<Index />);

    // Wait for onboarding check, but auth not initialized yet
    await waitFor(() => {
      expect(toJSON()).toBeNull();
    });
  });

  it("redirects to welcome when onboarding not completed", async () => {
    render(<Index />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-redirect")).toBeTruthy();
      expect(screen.getByText("Redirect to /(auth)/welcome")).toBeTruthy();
    });
  });

  it("redirects to login when onboarding completed but not authenticated", async () => {
    SecureStore.setItem("onboarding_completed", "true");
    setupAuthStore({ isInitialized: true, session: null });

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
    });

    render(<Index />);

    await waitFor(() => {
      expect(screen.getByText("Redirect to /(tabs)")).toBeTruthy();
    });
  });
});
