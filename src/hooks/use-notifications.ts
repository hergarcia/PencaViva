import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  configureNotificationHandler,
  registerForPushNotifications,
} from "@/lib/notifications-service";
import { savePushToken } from "@/lib/profile-service";

/**
 * Configures the foreground notification handler and registers the device for
 * push notifications, persisting the Expo push token to the user's profile.
 * Runs once after authentication is initialized.
 *
 * Safe to call on every app launch — always re-registers to handle token rotation.
 * Errors are swallowed; push setup failure must never block app launch.
 */
export function useNotificationsInit(): void {
  const { user, isInitialized } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!isInitialized || !userId) return;

    // Entire push setup is wrapped in an async IIFE with blanket error handling.
    // Native modules (expo-device, expo-notifications) are unavailable when
    // running without a dev client build (e.g. Expo Go on a bare project).
    // Any failure here is non-fatal — the app works fine without push.
    (async () => {
      try {
        configureNotificationHandler();
        const token = await registerForPushNotifications();
        await savePushToken(userId, token);
      } catch {
        // Non-fatal: native modules unavailable or permission denied
      }
    })();
  }, [isInitialized, userId]);
}
