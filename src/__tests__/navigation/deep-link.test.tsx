import React from "react";
import { render } from "@testing-library/react-native";
import { useAuthStore } from "@stores/auth-store";
import DeepLinkScreen from "../../../app/join/[code]";

// Prevent Supabase env var validation at import time
jest.mock("@lib/supabase");
jest.mock("@lib/google-auth");

// Mock the auth store
jest.mock("@stores/auth-store");

const mockCheckProfileComplete = jest.fn();
jest.mock("@lib/profile-service", () => ({
  checkProfileComplete: (...args: unknown[]) =>
    mockCheckProfileComplete(...args),
}));

const mockSavePendingInviteCode = jest.fn();
jest.mock("@lib/pending-invite", () => ({
  savePendingInviteCode: (...args: unknown[]) =>
    mockSavePendingInviteCode(...args),
}));

const mockGetStorageItem = jest.fn();
jest.mock("@lib/storage", () => ({
  getStorageItem: (...args: unknown[]) => mockGetStorageItem(...args),
}));

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: jest.fn(() => ({})),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useLocalSearchParams } = require("expo-router");

beforeEach(() => {
  jest.clearAllMocks();
});

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
  (useAuthStore as unknown as jest.Mock).mockReturnValue(state);
}

describe("app/join/[code]", () => {
  it("redirects to empty join screen for invalid code (wrong length)", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ code: "SHORT" });
    setupAuthStore({ isInitialized: true, session: null, user: null });
    mockGetStorageItem.mockResolvedValue("true"); // onboarding done

    render(<DeepLinkScreen />);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/groups/join");
    expect(mockSavePendingInviteCode).not.toHaveBeenCalled();
  });

  it("redirects authenticated + profile complete user directly to join screen with code", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ code: "ABC12345" });
    setupAuthStore({
      isInitialized: true,
      session: { access_token: "tok" },
      user: { id: "user-1" },
    });
    mockGetStorageItem.mockResolvedValue("true");
    mockCheckProfileComplete.mockResolvedValue(true);

    render(<DeepLinkScreen />);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).toHaveBeenCalledWith(
      "/(tabs)/groups/join?code=ABC12345",
    );
    expect(mockSavePendingInviteCode).not.toHaveBeenCalled();
  });

  it("saves code and routes to / for unauthenticated users", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ code: "ABC12345" });
    setupAuthStore({ isInitialized: true, session: null, user: null });
    mockGetStorageItem.mockResolvedValue("true"); // onboarding done
    mockSavePendingInviteCode.mockResolvedValue(undefined);

    render(<DeepLinkScreen />);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSavePendingInviteCode).toHaveBeenCalledWith("ABC12345");
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("saves code and routes to / for authenticated users with incomplete profile", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ code: "ABC12345" });
    setupAuthStore({
      isInitialized: true,
      session: { access_token: "tok" },
      user: { id: "user-1" },
    });
    mockGetStorageItem.mockResolvedValue("true");
    mockCheckProfileComplete.mockResolvedValue(false);
    mockSavePendingInviteCode.mockResolvedValue(undefined);

    render(<DeepLinkScreen />);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSavePendingInviteCode).toHaveBeenCalledWith("ABC12345");
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("renders a loading indicator while not ready", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ code: "ABC12345" });
    // Not initialized yet
    setupAuthStore({ isInitialized: false, session: null, user: null });
    mockGetStorageItem.mockReturnValue(new Promise(() => {})); // never resolves

    const { getByTestId } = render(<DeepLinkScreen />);
    expect(getByTestId("deep-link-loading")).toBeTruthy();
  });
});
