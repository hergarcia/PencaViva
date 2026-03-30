import { renderHook, waitFor } from "@testing-library/react-native";
import { useNotificationsInit } from "@hooks/use-notifications";

// ── Mocks ───────────────────────────────────────────────────────────

const mockRegister = jest.fn();
const mockConfigure = jest.fn();
const mockSaveToken = jest.fn();
const mockUseAuth = jest.fn();

jest.mock("@lib/notifications-service", () => ({
  registerForPushNotifications: (...args: unknown[]) => mockRegister(...args),
  configureNotificationHandler: (...args: unknown[]) => mockConfigure(...args),
}));

jest.mock("@lib/profile-service", () => ({
  savePushToken: (...args: unknown[]) => mockSaveToken(...args),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRegister.mockResolvedValue("ExponentPushToken[test]");
  mockSaveToken.mockResolvedValue(undefined);
  mockConfigure.mockReturnValue(undefined);
});

describe("useNotificationsInit", () => {
  it("does not register when auth is not initialized", async () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: false });
    renderHook(() => useNotificationsInit());
    await waitFor(() => expect(mockRegister).not.toHaveBeenCalled());
  });

  it("does not register when user is null (logged out)", async () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderHook(() => useNotificationsInit());
    await waitFor(() => expect(mockRegister).not.toHaveBeenCalled());
  });

  it("registers and saves token when auth is ready and user is present", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      isInitialized: true,
    });

    renderHook(() => useNotificationsInit());

    await waitFor(() => expect(mockSaveToken).toHaveBeenCalled());
    expect(mockRegister).toHaveBeenCalled();
    expect(mockSaveToken).toHaveBeenCalledWith(
      "user-1",
      "ExponentPushToken[test]",
    );
  });

  it("saves null token when registration returns null (simulator / permission denied)", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      isInitialized: true,
    });
    mockRegister.mockResolvedValue(null);

    renderHook(() => useNotificationsInit());

    await waitFor(() => expect(mockSaveToken).toHaveBeenCalled());
    expect(mockSaveToken).toHaveBeenCalledWith("user-1", null);
  });

  it("does not throw when registerForPushNotifications rejects", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      isInitialized: true,
    });
    mockRegister.mockRejectedValue(new Error("Permission error"));

    // Should not throw
    expect(() => renderHook(() => useNotificationsInit())).not.toThrow();
    // Give the effect time to run and reject
    await new Promise((r) => setTimeout(r, 50));
  });

  it("does not throw when savePushToken rejects", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      isInitialized: true,
    });
    mockSaveToken.mockRejectedValue(new Error("Network error"));

    expect(() => renderHook(() => useNotificationsInit())).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));
  });
});
