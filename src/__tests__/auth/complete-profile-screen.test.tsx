import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react-native";
import CompleteProfileScreen from "../../../app/(auth)/complete-profile";

// ── Mocks ───────────────────────────────────────────────────────

jest.mock("@lib/supabase");
jest.mock("@lib/google-auth");

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

const mockCheckUsernameAvailable = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock("@lib/profile-service", () => ({
  ...jest.requireActual("@lib/profile-service"),
  checkUsernameAvailable: (...args: unknown[]) =>
    mockCheckUsernameAvailable(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

const defaultMockUser = {
  id: "user-123",
  email: "test@example.com",
  user_metadata: {
    full_name: "Test User",
    picture: "https://example.com/avatar.jpg",
  },
};

let mockUser = { ...defaultMockUser };

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({
    user: mockUser,
    session: { access_token: "test" },
    isAuthenticated: true,
    isInitialized: true,
    isLoading: false,
    error: null,
  }),
}));

// ── Setup ───────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockUser = { ...defaultMockUser };
  mockCheckUsernameAvailable.mockResolvedValue(true);
  mockUpdateProfile.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Tests ───────────────────────────────────────────────────────

describe("CompleteProfileScreen", () => {
  it("renders the screen with title and subtitle", () => {
    render(<CompleteProfileScreen />);
    expect(screen.getByTestId("profile-title")).toBeTruthy();
    expect(screen.getByText("Complete Your Profile")).toBeTruthy();
    expect(
      screen.getByText("Choose a unique username to get started"),
    ).toBeTruthy();
  });

  it("pre-fills display name from Google metadata", () => {
    render(<CompleteProfileScreen />);
    const input = screen.getByTestId("display-name-input");
    expect(input.props.value).toBe("Test User");
  });

  it("shows Google avatar when picture URL exists", () => {
    render(<CompleteProfileScreen />);
    expect(screen.getByTestId("profile-avatar-image")).toBeTruthy();
    expect(screen.queryByTestId("profile-avatar-fallback")).toBeNull();
  });

  it("shows letter fallback when no picture URL", () => {
    mockUser = {
      id: "user-123",
      email: "test@example.com",
      user_metadata: { full_name: "Test User" },
    } as typeof mockUser;
    render(<CompleteProfileScreen />);
    expect(screen.getByTestId("profile-avatar-fallback")).toBeTruthy();
    expect(screen.queryByTestId("profile-avatar-image")).toBeNull();
  });

  it("shows character counter starting at 0", () => {
    render(<CompleteProfileScreen />);
    expect(screen.getByTestId("username-counter")).toHaveTextContent("0/20");
  });

  it("shows validation error for short username", async () => {
    render(<CompleteProfileScreen />);
    await act(async () => {
      fireEvent.changeText(screen.getByTestId("username-input"), "ab");
    });
    expect(screen.getByTestId("username-status")).toHaveTextContent(
      "Username must be at least 3 characters",
    );
    expect(screen.getByTestId("username-counter")).toHaveTextContent("2/20");
  });

  it("shows validation error for invalid characters", async () => {
    render(<CompleteProfileScreen />);
    await act(async () => {
      fireEvent.changeText(screen.getByTestId("username-input"), "user@name");
    });
    expect(screen.getByTestId("username-status")).toHaveTextContent(
      "Only letters, numbers, and underscores allowed",
    );
  });

  it("checks availability after debounce delay", async () => {
    render(<CompleteProfileScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("username-input"), "validuser");
    });

    // Before debounce — should not have called yet
    expect(mockCheckUsernameAvailable).not.toHaveBeenCalled();

    // After debounce
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(mockCheckUsernameAvailable).toHaveBeenCalledWith(
        "validuser",
        "user-123",
      );
    });
  });

  it("shows available message when username is free", async () => {
    mockCheckUsernameAvailable.mockResolvedValue(true);
    render(<CompleteProfileScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("username-input"), "freeuser");
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("username-status")).toHaveTextContent(
        "Username is available",
      );
    });
  });

  it("shows taken message when username is unavailable", async () => {
    mockCheckUsernameAvailable.mockResolvedValue(false);
    render(<CompleteProfileScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("username-input"), "taken");
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("username-status")).toHaveTextContent(
        "Username is already taken",
      );
    });
  });

  it("disables save button when form is incomplete", () => {
    render(<CompleteProfileScreen />);
    const button = screen.getByTestId("save-profile-button");
    // No username entered — button should be disabled
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it("calls updateProfile and navigates on successful save", async () => {
    jest.useRealTimers();
    mockCheckUsernameAvailable.mockResolvedValue(true);

    render(<CompleteProfileScreen />);

    fireEvent.changeText(screen.getByTestId("username-input"), "myuser");

    await waitFor(() => {
      expect(screen.getByText("Username is available")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("save-profile-button"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith("user-123", {
        username: "myuser",
        display_name: "Test User",
        favorite_team: null,
      });
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
  });

  it("shows error banner on save failure", async () => {
    jest.useRealTimers();
    mockCheckUsernameAvailable.mockResolvedValue(true);
    mockUpdateProfile.mockRejectedValue(new Error("Network error"));

    render(<CompleteProfileScreen />);
    fireEvent.changeText(screen.getByTestId("username-input"), "myuser");

    await waitFor(() => {
      expect(screen.getByText("Username is available")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("save-profile-button"));

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeTruthy();
      expect(screen.getByText("Network error")).toBeTruthy();
    });
  });

  it("handles unique constraint error specifically", async () => {
    jest.useRealTimers();
    mockCheckUsernameAvailable.mockResolvedValue(true);
    mockUpdateProfile.mockRejectedValue(
      new Error("duplicate key value violates unique constraint"),
    );

    render(<CompleteProfileScreen />);
    fireEvent.changeText(screen.getByTestId("username-input"), "raced");

    await waitFor(() => {
      expect(screen.getByText("Username is available")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("save-profile-button"));

    await waitFor(() => {
      expect(screen.getByText(/Username was just taken/)).toBeTruthy();
    });
  });

  it("does not contain any Spanish text", () => {
    const { toJSON } = render(<CompleteProfileScreen />);
    const json = JSON.stringify(toJSON());
    expect(json).not.toContain("Guardar");
    expect(json).not.toContain("Perfil");
    expect(json).not.toContain("equipo favorito");
  });
});
