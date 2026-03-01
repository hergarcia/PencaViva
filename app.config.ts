import { ExpoConfig, ConfigContext } from "expo/config";

const googleSignInPlugin: string | [string, Record<string, string>] = process
  .env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  ? [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.split(".")
          .reverse()
          .join("."),
      },
    ]
  : "@react-native-google-signin/google-signin";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "PencaViva",
  slug: "pencaviva",
  version: "0.0.0",
  scheme: "pencaviva",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  plugins: ["expo-router", "expo-secure-store", googleSignInPlugin],
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
