// Tests for notifications-service.ts
// Uses jest.resetModules() + require() to test module-level side effects
// and to control expo-device's isDevice value per test.
/* eslint-disable @typescript-eslint/no-require-imports */

// ── Supabase mock for settings tests ────────────────────────────────

const mockChain: Record<string, jest.Mock> = {};
mockChain.select = jest.fn(() => mockChain);
mockChain.update = jest.fn(() => mockChain);
mockChain.eq = jest.fn(() => mockChain);
mockChain.single = jest.fn(() => Promise.resolve({ data: null, error: null }));

jest.mock("@lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => mockChain),
  },
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  // Re-wire chain after clearAllMocks
  mockChain.select = jest.fn(() => mockChain);
  mockChain.update = jest.fn(() => mockChain);
  mockChain.eq = jest.fn(() => mockChain);
  mockChain.single = jest.fn(() =>
    Promise.resolve({ data: null, error: null }),
  );
});

// ── Helpers ─────────────────────────────────────────────────────────

function loadModule(isDevice = true) {
  jest.doMock("expo-device", () => ({ isDevice }));

  // Re-require expo-notifications AFTER resetModules so we get fresh mocks
  const Notifications = require("expo-notifications");
  Notifications.getPermissionsAsync.mockResolvedValue({ status: "granted" });
  Notifications.getExpoPushTokenAsync.mockResolvedValue({
    data: "ExponentPushToken[test-token]",
  });
  Notifications.setNotificationChannelAsync.mockResolvedValue(null);
  Notifications.requestPermissionsAsync.mockResolvedValue({
    status: "granted",
  });

  const service = require("@lib/notifications-service");
  return { service, Notifications };
}

// ── configureNotificationHandler ────────────────────────────────────

describe("configureNotificationHandler", () => {
  it("calls setNotificationHandler when invoked", () => {
    const { service, Notifications } = loadModule();
    service.configureNotificationHandler();
    expect(Notifications.setNotificationHandler).toHaveBeenCalledWith(
      expect.objectContaining({ handleNotification: expect.any(Function) }),
    );
  });

  it("foreground handler enables banner and sound, disables badge", async () => {
    const { service, Notifications } = loadModule();
    service.configureNotificationHandler();
    const [handler] = Notifications.setNotificationHandler.mock.calls[0];
    const result = await handler.handleNotification();
    expect(result.shouldShowBanner).toBe(true);
    expect(result.shouldPlaySound).toBe(true);
    expect(result.shouldSetBadge).toBe(false);
    expect(result.shouldShowList).toBe(true);
  });

  it("does NOT call setNotificationHandler at import time", () => {
    const { Notifications } = loadModule();
    // Handler should not be set just from importing the module
    expect(Notifications.setNotificationHandler).not.toHaveBeenCalled();
  });
});

// ── registerForPushNotifications — simulator guard ───────────────────

describe("registerForPushNotifications — simulator", () => {
  it("returns null and skips permission check on simulator", async () => {
    const { service, Notifications } = loadModule(false); // isDevice = false
    const token = await service.registerForPushNotifications();
    expect(token).toBeNull();
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });
});

// ── registerForPushNotifications — physical device ───────────────────

describe("registerForPushNotifications — physical device", () => {
  it("returns the Expo push token string on success", async () => {
    const { service } = loadModule();
    const token = await service.registerForPushNotifications();
    expect(token).toBe("ExponentPushToken[test-token]");
  });

  it("skips requestPermissions when already granted", async () => {
    const { service, Notifications } = loadModule();
    Notifications.getPermissionsAsync.mockResolvedValue({ status: "granted" });
    await service.registerForPushNotifications();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("requests permission when status is undetermined", async () => {
    const { service, Notifications } = loadModule();
    Notifications.getPermissionsAsync.mockResolvedValue({
      status: "undetermined",
    });
    Notifications.requestPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    await service.registerForPushNotifications();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it("returns null when permission is denied after request", async () => {
    const { service, Notifications } = loadModule();
    Notifications.getPermissionsAsync.mockResolvedValue({
      status: "undetermined",
    });
    Notifications.requestPermissionsAsync.mockResolvedValue({
      status: "denied",
    });
    const token = await service.registerForPushNotifications();
    expect(token).toBeNull();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it("returns null when getExpoPushTokenAsync returns no data", async () => {
    const { service, Notifications } = loadModule();
    Notifications.getExpoPushTokenAsync.mockResolvedValue({ data: undefined });
    const token = await service.registerForPushNotifications();
    expect(token).toBeNull();
  });
});

// ── fetchNotificationSettings ────────────────────────────────────────

describe("fetchNotificationSettings", () => {
  const {
    fetchNotificationSettings,
    DEFAULT_NOTIFICATION_SETTINGS,
  } = require("@lib/notifications-service");

  it("returns settings merged with defaults on success", async () => {
    const stored = {
      reminders: false,
      results: true,
      ranking: true,
      invitations: true,
      quietHoursEnabled: false,
      quietFrom: "22:00",
      quietTo: "08:00",
    };
    mockChain.single.mockResolvedValueOnce({
      data: { notification_settings: stored },
      error: null,
    });

    const result = await fetchNotificationSettings("user-1");

    expect(result).toEqual({ ...DEFAULT_NOTIFICATION_SETTINGS, ...stored });
  });

  it("fills in missing fields with defaults (partial stored settings)", async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { notification_settings: { reminders: false } },
      error: null,
    });

    const result = await fetchNotificationSettings("user-1");

    expect(result.reminders).toBe(false);
    expect(result.results).toBe(DEFAULT_NOTIFICATION_SETTINGS.results);
    expect(result.quietFrom).toBe(DEFAULT_NOTIFICATION_SETTINGS.quietFrom);
  });

  it("throws when supabase returns an error", async () => {
    mockChain.single.mockResolvedValueOnce({
      data: null,
      error: new Error("DB error"),
    });

    await expect(fetchNotificationSettings("user-1")).rejects.toThrow(
      "DB error",
    );
  });
});

// ── saveNotificationSettings ─────────────────────────────────────────

describe("saveNotificationSettings", () => {
  const {
    saveNotificationSettings,
    DEFAULT_NOTIFICATION_SETTINGS,
  } = require("@lib/notifications-service");

  it("resolves without error on success", async () => {
    mockChain.eq.mockResolvedValueOnce({ error: null });

    await expect(
      saveNotificationSettings("user-1", DEFAULT_NOTIFICATION_SETTINGS),
    ).resolves.toBeUndefined();
  });

  it("throws when supabase returns an error", async () => {
    mockChain.eq.mockResolvedValueOnce({ error: new Error("Update failed") });

    await expect(
      saveNotificationSettings("user-1", DEFAULT_NOTIFICATION_SETTINGS),
    ).rejects.toThrow("Update failed");
  });

  it("calls update with the correct settings payload", async () => {
    mockChain.eq.mockResolvedValueOnce({ error: null });

    const settings = { ...DEFAULT_NOTIFICATION_SETTINGS, reminders: false };
    await saveNotificationSettings("user-1", settings);

    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ notification_settings: settings }),
    );
    expect(mockChain.eq).toHaveBeenCalledWith("id", "user-1");
  });
});
