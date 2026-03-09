import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { getStorageItem } from "@lib/storage";
import { ONBOARDING_STORAGE_KEY } from "@lib/onboarding";
import { useAuthStore } from "@stores/auth-store";
import { checkProfileComplete } from "@lib/profile-service";

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    getStorageItem(ONBOARDING_STORAGE_KEY).then((value) => {
      setHasCompletedOnboarding(value === "true");
      setIsReady(true);
    });
  }, []);

  // ── Profile completion check (only when authenticated) ──────────
  useEffect(() => {
    if (!user?.id) {
      setIsProfileChecked(false);
      setIsProfileComplete(false);
      return;
    }

    let cancelled = false;

    checkProfileComplete(user.id)
      .then((complete) => {
        if (!cancelled) {
          setIsProfileComplete(complete);
          setIsProfileChecked(true);
        }
      })
      .catch(() => {
        // Fail-open: allow through on error to avoid blocking the user
        if (!cancelled) {
          setIsProfileComplete(true);
          setIsProfileChecked(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Wait for onboarding check and auth initialization
  if (!isReady || !isInitialized) {
    return null;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Wait for profile completion check
  if (!isProfileChecked) {
    return null;
  }

  if (!isProfileComplete) {
    return <Redirect href="/(auth)/complete-profile" />;
  }

  return <Redirect href="/(tabs)" />;
}
