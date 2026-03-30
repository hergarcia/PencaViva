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

    try {
      // No-op on simulators — guards inside prevent native module crash
      configureNotificationHandler();
    } catch {
      // Non-fatal: notification handler setup failed (e.g. Expo Go / simulator)
    }

    registerForPushNotifications()
      .then((token) => savePushToken(userId, token))
      .catch(() => {
        // Non-fatal: app works without push notifications
      });
  }, [isInitialized, userId]);
}
