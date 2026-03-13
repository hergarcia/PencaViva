import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@hooks/use-auth";
import { useDebounce } from "@hooks/use-debounce";
import {
  validateUsername,
  checkUsernameAvailable,
  updateProfile,
  USERNAME_MAX_LENGTH,
} from "@lib/profile-service";
import type { UsernameValidationResult } from "@lib/profile-service";
import { colors } from "@lib/constants";

// ── Constants ─────────────────────────────────────────────────────

const DEBOUNCE_DELAY = 500;

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // ── Form state ──────────────────────────────────────────────────

  const displayNameFromMeta =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "";

  const avatarUrl: string | null =
    user?.user_metadata?.picture ?? user?.user_metadata?.avatar_url ?? null;

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(displayNameFromMeta);
  const [favoriteTeam, setFavoriteTeam] = useState("");

  // ── Validation state ────────────────────────────────────────────

  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedUsername = useDebounce(username, DEBOUNCE_DELAY);

  // ── Local format validation (synchronous, every keystroke) ──────

  const localValidation: UsernameValidationResult | null = useMemo(() => {
    if (username.length === 0) return null;
    return validateUsername(username);
  }, [username]);

  // ── Reset availability when username changes ────────────────────

  useEffect(() => {
    setIsAvailable(null);
  }, [username]);

  // ── Server availability check (debounced) ───────────────────────

  useEffect(() => {
    if (!debouncedUsername || !user?.id) return;

    const result = validateUsername(debouncedUsername);
    if (!result.isValid) return;

    let cancelled = false;
    setIsCheckingAvailability(true);

    checkUsernameAvailable(debouncedUsername, user.id)
      .then((available) => {
        if (!cancelled) setIsAvailable(available);
      })
      .catch(() => {
        if (!cancelled) setIsAvailable(null);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingAvailability(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedUsername, user?.id]);

  // ── Derived state ───────────────────────────────────────────────

  const isDebounceSettled = debouncedUsername === username;
  const canSave =
    localValidation?.isValid === true &&
    isAvailable === true &&
    isDebounceSettled &&
    !isCheckingAvailability &&
    !isSaving &&
    displayName.trim().length > 0;

  const avatarInitial = (displayName || username || "?")
    .charAt(0)
    .toUpperCase();

  // ── Username status text and color ──────────────────────────────

  const usernameStatusText = useMemo(() => {
    if (!username) return null;
    if (localValidation && !localValidation.isValid)
      return localValidation.error ?? null;
    if (isCheckingAvailability) return "Checking availability...";
    if (isAvailable === true && isDebounceSettled)
      return "Username is available";
    if (isAvailable === false) return "Username is already taken";
    return null;
  }, [
    username,
    localValidation,
    isCheckingAvailability,
    isAvailable,
    isDebounceSettled,
  ]);

  const usernameStatusColor = useMemo(() => {
    if (!username || isCheckingAvailability) return colors.textSecondary;
    if (localValidation && !localValidation.isValid) return "#EF4444";
    if (isAvailable === true && isDebounceSettled) return colors.primary;
    if (isAvailable === false) return "#EF4444";
    return colors.textSecondary;
  }, [
    username,
    localValidation,
    isCheckingAvailability,
    isAvailable,
    isDebounceSettled,
  ]);

  // ── Submit ──────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!canSave || !user?.id) return;

    setIsSaving(true);
    setError(null);

    try {
      await updateProfile(user.id, {
        username: username.trim(),
        display_name: displayName.trim(),
        favorite_team: favoriteTeam.trim() || null,
      });
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save profile";
      if (
        message.toLowerCase().includes("unique") ||
        message.toLowerCase().includes("duplicate")
      ) {
        setIsAvailable(false);
        setError("Username was just taken. Please choose another.");
      } else {
        setError(message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [canSave, user?.id, username, displayName, favoriteTeam, router]);

  // ── Render ──────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      testID="complete-profile-screen"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Text
            style={{ color: colors.textPrimary }}
            className="mt-8 text-center text-2xl font-bold"
            testID="profile-title"
          >
            Complete Your Profile
          </Text>
          <Text
            style={{ color: colors.textSecondary }}
            className="mb-8 mt-2 text-center text-base"
          >
            Choose a unique username to get started
          </Text>

          {/* Avatar */}
          <View className="mb-8 items-center">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                className="h-24 w-24 rounded-full"
                testID="profile-avatar-image"
              />
            ) : (
              <View
                className="h-24 w-24 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.secondary }}
                testID="profile-avatar-fallback"
              >
                <Text className="text-3xl font-bold text-white">
                  {avatarInitial}
                </Text>
              </View>
            )}
          </View>

          {/* Error Banner */}
          {error && (
            <Pressable
              onPress={() => setError(null)}
              className="mb-6 rounded-xl border border-red-500/50 bg-red-900/30 px-4 py-3"
              testID="error-banner"
            >
              <Text className="text-center text-sm text-red-400">{error}</Text>
              <Text
                style={{ color: colors.primary }}
                className="mt-2 text-center text-sm"
              >
                Dismiss
              </Text>
            </Pressable>
          )}

          {/* Username Input */}
          <Text
            style={{ color: colors.textSecondary }}
            className="mb-2 text-sm"
          >
            Username *
          </Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Choose a unique username"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={USERNAME_MAX_LENGTH}
            className="rounded-xl px-4 py-3.5 text-base text-white"
            style={{ backgroundColor: colors.surface }}
            testID="username-input"
          />
          <View className="mb-5 mt-1.5 flex-row justify-between">
            {usernameStatusText ? (
              <Text
                style={{ color: usernameStatusColor }}
                className="flex-1 text-xs"
                testID="username-status"
              >
                {usernameStatusText}
              </Text>
            ) : (
              <View className="flex-1" />
            )}
            <Text
              style={{ color: colors.textSecondary }}
              className="text-xs"
              testID="username-counter"
            >
              {username.length}/{USERNAME_MAX_LENGTH}
            </Text>
          </View>

          {/* Display Name Input */}
          <Text
            style={{ color: colors.textSecondary }}
            className="mb-2 text-sm"
          >
            Display Name *
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
            placeholderTextColor={colors.textSecondary}
            maxLength={50}
            className="mb-5 rounded-xl px-4 py-3.5 text-base text-white"
            style={{ backgroundColor: colors.surface }}
            testID="display-name-input"
          />

          {/* Favorite Team Input (optional) */}
          <Text
            style={{ color: colors.textSecondary }}
            className="mb-2 text-sm"
          >
            Favorite Team{" "}
            <Text style={{ color: colors.textSecondary }}>(optional)</Text>
          </Text>
          <TextInput
            value={favoriteTeam}
            onChangeText={setFavoriteTeam}
            placeholder="e.g. Nacional, Barcelona"
            placeholderTextColor={colors.textSecondary}
            maxLength={50}
            className="mb-8 rounded-xl px-4 py-3.5 text-base text-white"
            style={{ backgroundColor: colors.surface }}
            testID="favorite-team-input"
          />

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            className="items-center rounded-xl py-4"
            style={{
              backgroundColor: canSave ? colors.primary : colors.surface,
              opacity: canSave ? 1 : 0.5,
            }}
            testID="save-profile-button"
          >
            {isSaving ? (
              <ActivityIndicator
                size="small"
                color={colors.background}
                testID="save-loading"
              />
            ) : (
              <Text
                className="text-base font-bold"
                style={{
                  color: canSave ? colors.background : colors.textSecondary,
                }}
              >
                Save Profile
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
