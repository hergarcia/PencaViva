import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "PencaViva",
  slug: "pencaviva",
  version: "0.0.0",
  scheme: "pencaviva",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  plugins: ["expo-router", "expo-secure-store"],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.pencaviva.app",
  },
  android: {
    package: "com.pencaviva.app",
    adaptiveIcon: {
      backgroundColor: "#0D0D0D",
    },
  },
  updates: {
    url: "https://u.expo.dev/c9ea82df-8528-4bca-a44b-0e220c4a0434",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  extra: {
    eas: {
      projectId: "c9ea82df-8528-4bca-a44b-0e220c4a0434",
    },
  },
});
