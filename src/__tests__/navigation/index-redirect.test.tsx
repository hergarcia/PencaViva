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

describe("App Index", () => {
  it("renders loading indicator when auth is not initialized", async () => {
    setupAuthStore({ isInitialized: false });
    render(<Index />);

    // Wait for onboarding check, but auth not initialized yet
    await waitFor(() => {
      expect(screen.getByTestId("loading-indicator")).toBeTruthy();
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

  it("redirects to tabs when onboarding completed and authenticated with complete profile", async () => {
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

  // ── Profile completion gating ─────────────────────────────────

  it("redirects to complete-profile when profile is incomplete", async () => {
    SecureStore.setItem("onboarding_completed", "true");
    setupAuthStore({
      isInitialized: true,
      session: { access_token: "test", user: { id: "123" } },
      user: { id: "123" },
    });
    mockCheckProfileComplete.mockResolvedValue(false);

    render(<Index />);

    await waitFor(() => {
      expect(
        screen.getByText("Redirect to /(auth)/complete-profile"),
      ).toBeTruthy();
    });
  });

  it("fails open to tabs when profile check throws", async () => {
    SecureStore.setItem("onboarding_completed", "true");
    setupAuthStore({
      isInitialized: true,
      session: { access_token: "test", user: { id: "123" } },
      user: { id: "123" },
    });
    mockCheckProfileComplete.mockRejectedValue(new Error("Network error"));

    render(<Index />);

    await waitFor(() => {
      expect(screen.getByText("Redirect to /(tabs)")).toBeTruthy();
    });
  });

  it("renders loading indicator while profile check is pending", async () => {
    SecureStore.setItem("onboarding_completed", "true");
    setupAuthStore({
      isInitialized: true,
      session: { access_token: "test", user: { id: "123" } },
      user: { id: "123" },
    });
    // Never resolves
    mockCheckProfileComplete.mockReturnValue(new Promise(() => {}));

    render(<Index />);

    // Give time for onboarding check to resolve
    await waitFor(() => {
      expect(screen.getByTestId("loading-indicator")).toBeTruthy();
    });
  });
});
