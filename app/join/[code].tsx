import { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "@stores/auth-store";
import { checkProfileComplete } from "@lib/profile-service";
import { savePendingInviteCode } from "@lib/pending-invite";
import { getStorageItem } from "@lib/storage";
import { colors } from "@lib/constants";

const CODE_REGEX = /^[0-9a-fA-F]{8}$/;

export default function DeepLinkJoinScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isInitialized, session, user } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  // Wait for both auth init and onboarding SecureStore read
  useEffect(() => {
    if (!isInitialized) return;
    let cancelled = false;
    getStorageItem("onboarding_completed").then(() => {
      if (!cancelled) setIsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isInitialized]);

  // Once ready, decide where to go
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    async function decide() {
      // Invalid code
      if (!code || !CODE_REGEX.test(code)) {
        router.replace("/(tabs)/groups/join");
        return;
      }

      if (session && user) {
        // Authenticated — check profile
        const complete = await checkProfileComplete(user.id);
        if (cancelled) return;
        if (complete) {
          router.replace(`/(tabs)/groups/join?code=${code}`);
        } else {
          await savePendingInviteCode(code);
          if (cancelled) return;
          router.replace("/");
        }
      } else {
        // Not authenticated
        await savePendingInviteCode(code);
        if (cancelled) return;
        router.replace("/");
      }
    }

    decide();
    return () => {
      cancelled = true;
    };
  }, [isReady, code, session, user, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
      }}
      testID="deep-link-loading"
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
