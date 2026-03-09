import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";

// Mocks must be declared before imports that use them
jest.mock("@hooks/use-auth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@lib/profile-service", () => ({
  updateProfile: jest.fn().mockResolvedValue(undefined),
  uploadAvatar: jest
    .fn()
    .mockResolvedValue("https://example.com/new-avatar.jpg"),
  checkUsernameAvailable: jest.fn().mockResolvedValue(true),
  checkProfileComplete: jest.fn().mockResolvedValue(true),
  validateUsername: jest.fn().mockReturnValue({ isValid: true }),
  USERNAME_MAX_LENGTH: 20,
  USERNAME_MIN_LENGTH: 3,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

const mockProfileData = {
  id: "user-123",
  username: "john_doe",
  display_name: "John Doe",
  bio: "Sports fan",
  favorite_team: "Nacional",
  avatar_url: "https://example.com/avatar.jpg",
  points_total: 42,
};

const mockSingle = jest.fn().mockResolvedValue({
  data: mockProfileData,
  error: null,
});

jest.mock("@lib/supabase", () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: mockSingle,
    }),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: "https://example.com/avatar.jpg" },
        }),
      }),
    },
  },
}));

// Must import after mocks — app/ is at repo root, not under src/
/* eslint-disable @typescript-eslint/no-require-imports */
const { useAuth } = require("@hooks/use-auth");
const { updateProfile } = require("@lib/profile-service");

const mockSignOut = jest.fn();

// app/(tabs)/profile is at repo root, so use relative path (not @/ alias)
const ProfileScreen = require("../../../app/(tabs)/profile").default;
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
  mockSingle.mockResolvedValue({ data: mockProfileData, error: null });
  useAuth.mockReturnValue({
    user: { id: "user-123", email: "test@example.com" },
    session: { user: { id: "user-123" } },
    signOut: mockSignOut,
    isLoading: false,
    isAuthenticated: true,
    isInitialized: true,
    error: null,
  });
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
    canceled: true,
    assets: null,
  });
  (
    ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock
  ).mockResolvedValue({
    status: "granted",
  });
  updateProfile.mockResolvedValue(undefined);
});

// ── View mode ────────────────────────────────────────────────────────

describe("ProfileScreen — view mode", () => {
  it("renders display name and @username after loading", async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeTruthy();
      expect(screen.getByText("@john_doe")).toBeTruthy();
    });
  });

  it("renders bio and favorite team", async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText("Sports fan")).toBeTruthy();
      expect(screen.getByText("Nacional")).toBeTruthy();
    });
  });

  it("renders points_total", async () => {
    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("42")).toBeTruthy());
  });

  it("renders Edit Profile and Sign Out buttons", async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText("Edit Profile")).toBeTruthy();
      expect(screen.getByText("Sign Out")).toBeTruthy();
    });
  });

  it("shows error message when profile fetch fails", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: new Error("DB error"),
    });
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByTestId("error-message")).toBeTruthy();
    });
  });
});

// ── Edit mode ────────────────────────────────────────────────────────

describe("ProfileScreen — edit mode", () => {
  it("shows text inputs after pressing Edit Profile", async () => {
    render(<ProfileScreen />);
    await waitFor(() => fireEvent.press(screen.getByText("Edit Profile")));
    expect(screen.getByTestId("display-name-input")).toBeTruthy();
    expect(screen.getByTestId("bio-input")).toBeTruthy();
    expect(screen.getByTestId("favorite-team-input")).toBeTruthy();
    expect(screen.getByText("Save")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("returns to view mode on Cancel", async () => {
    render(<ProfileScreen />);
    await waitFor(() => fireEvent.press(screen.getByText("Edit Profile")));
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.getByText("Edit Profile")).toBeTruthy());
  });

  it("calls updateProfile with changed display name on Save", async () => {
    render(<ProfileScreen />);
    await waitFor(() => fireEvent.press(screen.getByText("Edit Profile")));
    fireEvent.changeText(screen.getByTestId("display-name-input"), "Jane Doe");
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({ display_name: "Jane Doe" }),
      );
    });
  });

  it("clears bio to null when bio is emptied", async () => {
    render(<ProfileScreen />);
    await waitFor(() => fireEvent.press(screen.getByText("Edit Profile")));
    fireEvent.changeText(screen.getByTestId("bio-input"), "");
    fireEvent.press(screen.getByText("Save"));
    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({ bio: null }),
      );
    });
  });

  it("does not call updateProfile on Cancel", async () => {
    render(<ProfileScreen />);
    await waitFor(() => fireEvent.press(screen.getByText("Edit Profile")));
    fireEvent.press(screen.getByText("Cancel"));
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

// ── Avatar pick ──────────────────────────────────────────────────────

describe("ProfileScreen — avatar pick", () => {
  it("requests permission and launches picker on avatar tap in edit mode", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///photo.jpg" }],
    });
    render(<ProfileScreen />);
    await waitFor(() => fireEvent.press(screen.getByText("Edit Profile")));
    fireEvent.press(screen.getByTestId("avatar-picker"));
    await waitFor(() => {
      expect(
        ImagePicker.requestMediaLibraryPermissionsAsync,
      ).toHaveBeenCalled();
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
        expect.objectContaining({ mediaTypes: ["images"] }),
      );
    });
  });

  it("shows Alert and does not launch picker when permission denied", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    (
      ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock
    ).mockResolvedValueOnce({ status: "denied" });
    render(<ProfileScreen />);
    await waitFor(() => fireEvent.press(screen.getByText("Edit Profile")));
    fireEvent.press(screen.getByTestId("avatar-picker"));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Permission required",
        "Please allow access to your photo library.",
      );
      expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    });
  });
});

// ── Sign out ─────────────────────────────────────────────────────────

describe("ProfileScreen — sign out", () => {
  it("calls signOut when Sign Out is pressed", async () => {
    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("Sign Out")).toBeTruthy());
    fireEvent.press(screen.getByText("Sign Out"));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });
});
