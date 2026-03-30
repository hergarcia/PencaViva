import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure foreground notification behavior at module load.
// This ensures notifications show as banners even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

/**
 * Requests push notification permission and retrieves the Expo push token.
 *
 * Returns null if:
 * - Running in a simulator/emulator (push tokens are not available)
 * - The user denies notification permission
 * - The token fetch fails
 *
 * Safe to call on every app launch — always returns the latest token.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isDevice } = require("expo-device") as { isDevice: boolean };
  if (!isDevice) return null;

  // Android 8+ requires a notification channel before token fetch
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  // projectId is read automatically from app.config.ts > extra.eas.projectId
  const { data: token } = await Notifications.getExpoPushTokenAsync({});

  return token ?? null;
}
