import { Redirect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ONBOARDING_STORAGE_KEY } from "@lib/onboarding";

export default function Index() {
  const hasCompletedOnboarding =
    SecureStore.getItem(ONBOARDING_STORAGE_KEY) === "true";

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}
