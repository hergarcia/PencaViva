import "../global.css";

import { useEffect } from "react";
import { LogBox } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "@/lib/constants";
import { configureGoogleSignIn } from "@/lib/google-auth";
import { useAuthInit } from "@/hooks/use-auth";
import { useNotificationsInit } from "@/hooks/use-notifications";
import { GlobalErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";

// Native notification/device modules are unavailable without a dev client build.
// These errors are caught and handled — suppress the dev-mode red boxes.
LogBox.ignoreLogs([
  "Cannot find native module 'ExpoPushTokenManager'",
  "Cannot find native module 'ExpoDevice'",
]);

SplashScreen.preventAutoHideAsync();
configureGoogleSignIn();

const stackContentStyle = { backgroundColor: colors.background };

export default function RootLayout() {
  useAuthInit();
  useNotificationsInit();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GlobalErrorBoundary>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: stackContentStyle,
            }}
          />
        </ToastProvider>
      </SafeAreaProvider>
    </GlobalErrorBoundary>
  );
}
