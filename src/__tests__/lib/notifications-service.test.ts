// Tests for notifications-service.ts
// Uses jest.resetModules() + require() to test module-level side effects
// and to control expo-device's isDevice value per test.
/* eslint-disable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.resetModules();
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

// ── setNotificationHandler (module-level side effect) ───────────────

describe("setNotificationHandler", () => {
  it("is configured when the module is loaded", () => {
    const { Notifications } = loadModule();
    expect(Notifications.setNotificationHandler).toHaveBeenCalledWith(
      expect.objectContaining({ handleNotification: expect.any(Function) }),
    );
  });

  it("foreground handler enables banner and sound, disables badge", async () => {
    const { Notifications } = loadModule();
    const [handler] = Notifications.setNotificationHandler.mock.calls[0];
    const result = await handler.handleNotification();
    expect(result.shouldShowBanner).toBe(true);
    expect(result.shouldPlaySound).toBe(true);
    expect(result.shouldSetBadge).toBe(false);
    expect(result.shouldShowList).toBe(true);
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
