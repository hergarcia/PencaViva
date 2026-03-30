import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { registerForPushNotifications } from "@/lib/notifications-service";
import { savePushToken } from "@/lib/profile-service";

/**
 * Registers the device for push notifications and persists the Expo push token
 * to the user's profile. Runs once after authentication is initialized.
 *
 * Safe to call on every app launch — always re-registers to handle token rotation.
 * Errors are swallowed; push setup failure must never block app launch.
 */
export function useNotificationsInit(): void {
  const { user, isInitialized } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!isInitialized || !userId) return;

    registerForPushNotifications()
      .then((token) => savePushToken(userId, token))
      .catch(() => {
        // Non-fatal: app works without push notifications
      });
  }, [isInitialized, userId]);
}
