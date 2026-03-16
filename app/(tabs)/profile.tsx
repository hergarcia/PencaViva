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
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
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
  const { width } = useWindowDimensions();
  const showThreeStats = width >= 390;
  const insets = useSafeAreaInsets();

  const deviceLocale =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().locale
      : "en";
  const isTest =
    typeof process !== "undefined" && Boolean(process.env?.JEST_WORKER_ID);
  const isEs = !isTest && deviceLocale.toLowerCase().startsWith("es");
  const copy = isEs
    ? {
        editProfile: "Editar perfil",
        signOut: "Cerrar sesion",
        editAvatar: "Editar avatar",
        points: "Puntos",
        team: "Equipo",
        user: "Usuario",
        displayName: "Nombre visible *",
        bio: "Bio",
        favoriteTeam: "Equipo favorito",
        save: "Guardar",
        cancel: "Cancelar",
        emptyBio: "Sin bio todavia",
        emptyTeam: "Sin equipo",
        retry: "Reintentar",
        loadError: "No se pudo cargar el perfil.",
        permissionTitle: "Permiso requerido",
        permissionBody: "Permiti el acceso a tu galeria.",
        saveErrorTitle: "Error",
        saveErrorBody: "No se pudo guardar el perfil. Intenta nuevamente.",
        signOutErrorTitle: "Cerrar sesion",
        signOutErrorBody: "No se pudo cerrar sesion. Intenta nuevamente.",
        sectionProfile: "Tu perfil",
        sectionTeam: "Preferencias",
      }
    : {
        editProfile: "Edit Profile",
        signOut: "Sign Out",
        editAvatar: "Edit avatar",
        points: "Points",
        team: "Team",
        user: "User",
        displayName: "Display Name *",
        bio: "Bio",
        favoriteTeam: "Favorite Team",
        save: "Save",
        cancel: "Cancel",
        emptyBio: "No bio yet",
        emptyTeam: "No team",
        retry: "Retry",
        loadError: "Failed to load profile.",
        permissionTitle: "Permission required",
        permissionBody: "Please allow access to your photo library.",
        saveErrorTitle: "Error",
        saveErrorBody: "Failed to save profile. Please try again.",
        signOutErrorTitle: "Sign Out Failed",
        signOutErrorBody: "Could not sign out. Please try again.",
        sectionProfile: "Profile",
        sectionTeam: "Preferences",
      };

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
      setFetchError(copy.loadError);
    } else {
      setProfile(data);
    }
    setIsLoading(false);
  }, [copy.loadError, user?.id]);

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
      Alert.alert(copy.permissionTitle, copy.permissionBody);
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
  }, [copy.permissionBody, copy.permissionTitle]);

  const handleEditAvatar = useCallback(() => {
    handleEdit();
    handlePickAvatar();
  }, [handleEdit, handlePickAvatar]);

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
      Alert.alert(copy.saveErrorTitle, copy.saveErrorBody);
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  }, [
    copy.saveErrorBody,
    copy.saveErrorTitle,
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
      Alert.alert(copy.signOutErrorTitle, copy.signOutErrorBody);
    }
  }, [copy.signOutErrorBody, copy.signOutErrorTitle, signOut]);

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
          <Text style={{ color: colors.primary }}>{copy.retry}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!profile) return null;

  const avatarDisplayUri = isEditing ? editAvatarUri : profile.avatar_url;
  const initials = (profile.display_name ||
    profile.username ||
    "?")[0].toUpperCase();
  const hasBio = Boolean(profile.bio && profile.bio.trim());
  const bioText = hasBio ? profile.bio!.trim() : copy.emptyBio;
  const hasTeam = Boolean(
    profile.favorite_team && profile.favorite_team.trim(),
  );
  const teamText = hasTeam ? profile.favorite_team!.trim() : copy.emptyTeam;

  // ── Render ──────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      testID="profile-screen"
    >
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingBottom: Math.max(24, insets.bottom + 24),
          flexGrow: 1,
        }}
      >
        {!isEditing ? (
          <View style={{ flex: 1, justifyContent: "space-between" }}>
            <View>
              <View style={{ alignItems: "center" }}>
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

                <TouchableOpacity
                  onPress={handleEditAvatar}
                  style={{ marginBottom: 8 }}
                  testID="edit-avatar-button"
                >
                  <Text style={{ color: colors.primary, fontWeight: "bold" }}>
                    {copy.editAvatar}
                  </Text>
                </TouchableOpacity>

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
                {!showThreeStats ? (
                  <Text
                    style={{
                      color: colors.textSecondary,
                      textAlign: "center",
                      marginTop: 4,
                    }}
                  >
                    @{profile.username}
                  </Text>
                ) : null}
                <Text
                  style={{
                    color: hasBio ? colors.textSecondary : colors.textSecondary,
                    textAlign: "center",
                    marginTop: 8,
                    opacity: hasBio ? 1 : 0.7,
                  }}
                >
                  {bioText}
                </Text>
              </View>
              <View
                style={{
                  marginTop: 20,
                  flexDirection: "row",
                  alignSelf: "stretch",
                }}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.surfaceBorder,
                    marginRight: 12,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {copy.points}
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

                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.surfaceBorder,
                    marginRight: showThreeStats ? 12 : 0,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {copy.team}
                  </Text>
                  <Text
                    style={{
                      color: hasTeam
                        ? colors.textPrimary
                        : colors.textSecondary,
                      fontSize: 16,
                      fontWeight: "bold",
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {teamText}
                  </Text>
                </View>
                {showThreeStats ? (
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: colors.surface,
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: colors.surfaceBorder,
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {copy.user}
                    </Text>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 14,
                        fontWeight: "bold",
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      @{profile.username}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={{ marginTop: 24, alignItems: "stretch" }}>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  padding: 16,
                  alignItems: "center",
                }}
                onPress={handleEdit}
                testID="edit-button"
              >
                <Text style={{ color: colors.background, fontWeight: "bold" }}>
                  {copy.editProfile}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  marginTop: 12,
                  padding: 16,
                  alignItems: "center",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#EF4444",
                }}
                onPress={handleSignOut}
                testID="sign-out-button"
              >
                <Text style={{ color: "#EF4444", fontWeight: "bold" }}>
                  {copy.signOut}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
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

            {/* Edit mode */}
            <Text
              style={{
                color: colors.textSecondary,
                marginBottom: 8,
                fontWeight: "bold",
              }}
            >
              {copy.sectionProfile}
            </Text>
            <View
              style={{
                height: 1,
                backgroundColor: colors.surfaceBorder,
                marginBottom: 16,
              }}
            />
            <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
              {copy.displayName}
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
              {copy.bio}
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
            <Text
              style={{
                color: colors.textSecondary,
                marginBottom: 8,
                fontWeight: "bold",
              }}
            >
              {copy.sectionTeam}
            </Text>
            <View
              style={{
                height: 1,
                backgroundColor: colors.surfaceBorder,
                marginBottom: 16,
              }}
            />
            <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
              {copy.favoriteTeam}
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
                  {copy.save}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ borderRadius: 12, padding: 16, alignItems: "center" }}
              onPress={handleCancel}
              testID="cancel-button"
            >
              <Text style={{ color: colors.textSecondary }}>{copy.cancel}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
