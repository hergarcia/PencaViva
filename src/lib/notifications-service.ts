import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

// ── Notification settings ────────────────────────────────────────────

export type NotificationSettings = {
  reminders: boolean;
  results: boolean;
  ranking: boolean;
  invitations: boolean;
  quietHoursEnabled: boolean;
  quietFrom: string; // HH:MM 24h
  quietTo: string; // HH:MM 24h
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  reminders: true,
  results: true,
  ranking: true,
  invitations: true,
  quietHoursEnabled: false,
  quietFrom: "22:00",
  quietTo: "08:00",
};

export async function fetchNotificationSettings(
  userId: string,
): Promise<NotificationSettings> {
  const { data, error } = await supabase
    .from("profiles")
    .select("notification_settings")
    .eq("id", userId)
    .single();

  if (error) throw error;

  // Merge with defaults so older rows missing fields still work
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...data.notification_settings };
}

export async function saveNotificationSettings(
  userId: string,
  settings: NotificationSettings,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      notification_settings: settings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw error;
}

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
