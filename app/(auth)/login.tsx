import { useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors } from "@/lib/constants";
import { useAuth } from "@hooks/use-auth";

export default function LoginScreen() {
  const { signInWithGoogle, isLoading, error, clearError, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.replace("/");
    }
  }, [session, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }} className="items-center justify-center px-6">
        {/* App Title */}
        <Text
          style={{ color: colors.primary }}
          className="mb-2 text-4xl font-bold"
        >
          PencaViva
        </Text>

        <Text
          style={{ color: colors.textSecondary }}
          className="mb-12 text-center text-base"
        >
          Predict scores. Challenge friends.
        </Text>

        {/* Error Message */}
        {error && (
          <View className="mb-6 w-full rounded-xl border border-red-500/50 bg-red-900/30 px-4 py-3">
            <Text className="text-center text-sm text-red-400">{error}</Text>
            <Pressable onPress={clearError} className="mt-2">
              <Text
                style={{ color: colors.primary }}
                className="text-center text-sm"
              >
                Dismiss
              </Text>
            </Pressable>
          </View>
        )}

        {/* Google Sign-In Button */}
        <Pressable
          onPress={signInWithGoogle}
          disabled={isLoading}
          className="w-full flex-row items-center justify-center rounded-xl bg-white px-6 py-4"
          style={{ opacity: isLoading ? 0.6 : 1 }}
          testID="google-sign-in-button"
        >
          {isLoading ? (
            <ActivityIndicator
              size="small"
              color="#000"
              testID="sign-in-loading"
            />
          ) : (
            <Text className="text-base font-semibold text-black">
              Sign in with Google
            </Text>
          )}
        </Pressable>

        {/* Terms Notice */}
        <Text
          style={{ color: colors.textSecondary }}
          className="mt-8 px-4 text-center text-xs"
        >
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}
