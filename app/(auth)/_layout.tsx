import { Stack } from "expo-router";
import { colors } from "@/lib/constants";

const contentStyle = { backgroundColor: colors.background };

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle,
      }}
    />
  );
}
