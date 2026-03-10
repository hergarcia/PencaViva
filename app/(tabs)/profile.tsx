import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@hooks/use-auth";
import { updateProfile, uploadAvatar } from "@lib/profile-service";
import { supabase } from "@lib/supabase";
import { colors } from "@lib/constants";

// ── Types ────────────────────────────────────────────────────────────

type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  favorite_team: string | null;
  points_total: number;
};

// ── Component ────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  // ── Data state ──────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Edit state ──────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editFavoriteTeam, setEditFavoriteTeam] = useState("");
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // ── Fetch profile ───────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, bio, avatar_url, favorite_team, points_total",
      )
      .eq("id", user.id)
      .single();
    if (error) {
      setFetchError("Failed to load profile.");
    } else {
      setProfile(data);
    }
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ── Edit handlers ───────────────────────────────────────────────

  const handleEdit = useCallback(() => {
    if (!profile) return;
    setEditDisplayName(profile.display_name ?? "");
    setEditBio(profile.bio ?? "");
    setEditFavoriteTeam(profile.favorite_team ?? "");
    setEditAvatarUri(profile.avatar_url);
    setPendingAvatarUri(null);
    setIsEditing(true);
  }, [profile]);

  const handleCancel = useCallback(() => {
    setPendingAvatarUri(null);
    setIsEditing(false);
  }, []);

  const handlePickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Please allow access to your photo library.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const localUri = result.assets[0].uri;
      setPendingAvatarUri(localUri);
      setEditAvatarUri(localUri);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!profile || !user?.id) return;
    if (!editDisplayName.trim()) return;
    setIsSaving(true);
    try {
      let avatarUrl: string | undefined;
      if (pendingAvatarUri) {
        setIsUploading(true);
        avatarUrl = await uploadAvatar(user.id, pendingAvatarUri);
        setIsUploading(false);
      }

      const payload: Parameters<typeof updateProfile>[1] = {};

      if (editDisplayName.trim() !== profile.display_name) {
        payload.display_name = editDisplayName.trim();
      }
      const newBio = editBio.trim() || null;
      if (newBio !== profile.bio) {
        payload.bio = newBio;
      }
      const newFav = editFavoriteTeam.trim() || null;
      if (newFav !== profile.favorite_team) {
        payload.favorite_team = newFav;
      }
      if (avatarUrl !== undefined) {
        payload.avatar_url = avatarUrl;
      }

      const hasChanges = Object.keys(payload).length > 0;
      if (!hasChanges) {
        setIsEditing(false);
        return;
      }

      await updateProfile(user.id, payload);

      // Optimistic update — "key" in payload guard handles intentional null clears
      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          display_name:
            "display_name" in payload
              ? (payload.display_name ?? prev.display_name)
              : prev.display_name,
          bio: "bio" in payload ? payload.bio! : prev.bio,
          favorite_team:
            "favorite_team" in payload
              ? payload.favorite_team!
              : prev.favorite_team,
          avatar_url:
            "avatar_url" in payload ? payload.avatar_url! : prev.avatar_url,
        };
      });

      setPendingAvatarUri(null);
      setIsEditing(false);
    } catch {
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  }, [
    profile,
    user?.id,
    editDisplayName,
    editBio,
    editFavoriteTeam,
    pendingAvatarUri,
  ]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch {
      Alert.alert("Sign Out Failed", "Could not sign out. Please try again.");
    }
  }, [signOut]);

  // ── Guards ──────────────────────────────────────────────────────

  if (!user) return null;

  if (isLoading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        testID="profile-screen"
      >
        <ActivityIndicator
          size="large"
          color={colors.primary}
          testID="loading-indicator"
        />
      </SafeAreaView>
    );
  }

  if (fetchError) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}
        testID="profile-screen"
      >
        <Text
          style={{
            color: colors.textPrimary,
            textAlign: "center",
            marginTop: 40,
          }}
          testID="error-message"
        >
          {fetchError}
        </Text>
        <TouchableOpacity
          onPress={fetchProfile}
          style={{ marginTop: 16, alignItems: "center" }}
          testID="retry-button"
        >
          <Text style={{ color: colors.primary }}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!profile) return null;

  const avatarDisplayUri = isEditing ? editAvatarUri : profile.avatar_url;
  const initials = (profile.display_name ||
    profile.username ||
    "?")[0].toUpperCase();

  // ── Render ──────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      testID="profile-screen"
    >
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {/* Avatar */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <TouchableOpacity
            testID="avatar-picker"
            onPress={isEditing ? handlePickAvatar : undefined}
            disabled={!isEditing || isUploading}
            activeOpacity={isEditing ? 0.7 : 1}
          >
            {avatarDisplayUri ? (
              <Image
                source={{ uri: avatarDisplayUri }}
                style={{ width: 96, height: 96, borderRadius: 48 }}
                testID="avatar-image"
              />
            ) : (
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 32,
                    fontWeight: "bold",
                  }}
                >
                  {initials}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* View mode */}
        {!isEditing && (
          <>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 22,
                fontWeight: "bold",
                textAlign: "center",
              }}
              testID="profile-display-name"
            >
              {profile.display_name}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              @{profile.username}
            </Text>
            {profile.bio ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                {profile.bio}
              </Text>
            ) : null}
            {profile.favorite_team ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                {profile.favorite_team}
              </Text>
            ) : null}

            <View
              style={{
                marginTop: 16,
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 24,
                alignItems: "center",
                alignSelf: "center",
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Points
              </Text>
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 20,
                  fontWeight: "bold",
                }}
              >
                {profile.points_total}
              </Text>
            </View>

            <TouchableOpacity
              style={{
                marginTop: 24,
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
              }}
              onPress={handleEdit}
              testID="edit-button"
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "bold" }}>
                Edit Profile
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Edit mode */}
        {isEditing && (
          <>
            <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
              Display Name *
            </Text>
            <TextInput
              value={editDisplayName}
              onChangeText={setEditDisplayName}
              style={{
                backgroundColor: colors.surface,
                color: colors.textPrimary,
                padding: 12,
                borderRadius: 12,
                marginBottom: 16,
              }}
              testID="display-name-input"
            />
            <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
              Bio
            </Text>
            <TextInput
              value={editBio}
              onChangeText={setEditBio}
              multiline
              style={{
                backgroundColor: colors.surface,
                color: colors.textPrimary,
                padding: 12,
                borderRadius: 12,
                marginBottom: 16,
              }}
              testID="bio-input"
            />
            <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
              Favorite Team
            </Text>
            <TextInput
              value={editFavoriteTeam}
              onChangeText={setEditFavoriteTeam}
              style={{
                backgroundColor: colors.surface,
                color: colors.textPrimary,
                padding: 12,
                borderRadius: 12,
                marginBottom: 24,
              }}
              testID="favorite-team-input"
            />

            <TouchableOpacity
              style={{
                backgroundColor: editDisplayName.trim()
                  ? colors.primary
                  : colors.surface,
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
                marginBottom: 12,
                opacity: editDisplayName.trim() && !isUploading ? 1 : 0.5,
              }}
              onPress={handleSave}
              disabled={isSaving || isUploading || !editDisplayName.trim()}
              testID="save-button"
            >
              {isSaving || isUploading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text
                  style={{
                    color: editDisplayName.trim()
                      ? colors.background
                      : colors.textSecondary,
                    fontWeight: "bold",
                  }}
                >
                  Save
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ borderRadius: 12, padding: 16, alignItems: "center" }}
              onPress={handleCancel}
              testID="cancel-button"
            >
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Sign out */}
        <TouchableOpacity
          style={{ marginTop: 24, padding: 16, alignItems: "center" }}
          onPress={handleSignOut}
          testID="sign-out-button"
        >
          <Text style={{ color: "#EF4444", fontWeight: "bold" }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
