import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "PencaViva",
  slug: "pencaviva",
  version: "0.0.0",
  scheme: "pencaviva",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  plugins: ["expo-router"],
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
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID ?? ""}`,
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? "",
    },
  },
});
