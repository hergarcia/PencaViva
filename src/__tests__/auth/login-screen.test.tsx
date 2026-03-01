import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import LoginScreen from "../../../app/(auth)/login";
import { useAuthStore } from "@stores/auth-store";

// Mock supabase to prevent env var validation at import time
jest.mock("@lib/supabase");
jest.mock("@lib/google-auth");
jest.mock("@stores/auth-store");

const mockSignInWithGoogle = jest.fn();
const mockClearError = jest.fn();

function setupMockStore(
  overrides: Partial<{
    isLoading: boolean;
    error: string | null;
    signInWithGoogle: jest.Mock;
    clearError: jest.Mock;
  }> = {},
) {
  const state = {
    session: null,
    user: null,
    isInitialized: true,
    isLoading: false,
    error: null,
    signInWithGoogle: mockSignInWithGoogle,
    signOut: jest.fn(),
    clearError: mockClearError,
    initialize: jest.fn(),
    setSession: jest.fn(),
    ...overrides,
  };

  (useAuthStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  setupMockStore();
});

describe("LoginScreen", () => {
  it("renders the app title", () => {
    render(<LoginScreen />);
    expect(screen.getByText("PencaViva")).toBeTruthy();
  });

  it("renders the sign-in button with English text", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Sign in with Google")).toBeTruthy();
  });

  it("calls signInWithGoogle when button is pressed", () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText("Sign in with Google"));
    expect(mockSignInWithGoogle).toHaveBeenCalled();
  });

  it("shows loading indicator when isLoading is true", () => {
    setupMockStore({ isLoading: true });
    render(<LoginScreen />);
    expect(screen.queryByText("Sign in with Google")).toBeNull();
    expect(screen.getByTestId("sign-in-loading")).toBeTruthy();
  });

  it("shows error message when error is set", () => {
    setupMockStore({ error: "Something went wrong" });
    render(<LoginScreen />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("calls clearError when dismiss is pressed", () => {
    setupMockStore({ error: "Something went wrong" });
    render(<LoginScreen />);
    fireEvent.press(screen.getByText("Dismiss"));
    expect(mockClearError).toHaveBeenCalled();
  });

  it("does not contain any Spanish text", () => {
    const { toJSON } = render(<LoginScreen />);
    const json = JSON.stringify(toJSON());
    expect(json).not.toContain("Iniciar");
    expect(json).not.toContain("Sesión");
    expect(json).not.toContain("Ingresá");
  });
});
