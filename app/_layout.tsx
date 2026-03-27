import "../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "@/lib/constants";
import { configureGoogleSignIn } from "@/lib/google-auth";
import { useAuthInit } from "@/hooks/use-auth";
import { GlobalErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";

SplashScreen.preventAutoHideAsync();
configureGoogleSignIn();

const stackContentStyle = { backgroundColor: colors.background };

export default function RootLayout() {
  useAuthInit();

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
