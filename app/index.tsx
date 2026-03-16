import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { getStorageItem } from "@lib/storage";
import { ONBOARDING_STORAGE_KEY } from "@lib/onboarding";
import { useAuthStore } from "@stores/auth-store";
import { checkProfileComplete } from "@lib/profile-service";
import {
  getPendingInviteCode,
  clearPendingInviteCode,
} from "@lib/pending-invite";

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(
    null,
  );
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

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
      .then(async (complete) => {
        if (cancelled) return;
        const localCode = complete ? await getPendingInviteCode() : null;
        if (cancelled) return;
        setPendingInviteCode(localCode);
        setIsProfileComplete(complete);
        setIsProfileChecked(true);
      })
      .catch(() => {
        // Fail-open: allow through on error to avoid blocking the user
        if (!cancelled) {
          setPendingInviteCode(null);
          setIsProfileComplete(true);
          setIsProfileChecked(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ── Final redirect (tabs or join screen for pending invite) ─────
  useEffect(() => {
    if (!isProfileChecked || !isProfileComplete) return;
    if (pendingInviteCode) {
      clearPendingInviteCode().then(() => {
        router.replace(`/groups/join?code=${pendingInviteCode}`);
      });
    } else {
      router.replace("/(tabs)");
    }
  }, [isProfileChecked, isProfileComplete, pendingInviteCode, router]);

  // Wait for onboarding check and auth initialization
  if (!isReady || !isInitialized) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0D0D0D",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator testID="loading-indicator" color="#00D4AA" />
      </View>
    );
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Wait for profile completion check
  if (!isProfileChecked) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0D0D0D",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator testID="loading-indicator" color="#00D4AA" />
      </View>
    );
  }

  if (!isProfileComplete) {
    return <Redirect href="/(auth)/complete-profile" />;
  }

  return null;
}
