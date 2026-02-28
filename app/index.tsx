import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { getStorageItem } from "@lib/storage";
import { ONBOARDING_STORAGE_KEY } from "@lib/onboarding";

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    getStorageItem(ONBOARDING_STORAGE_KEY).then((value) => {
      setHasCompletedOnboarding(value === "true");
      setIsReady(true);
    });
  }, []);

  if (!isReady) {
    return null;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}
