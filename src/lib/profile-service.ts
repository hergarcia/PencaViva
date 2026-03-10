import { supabase } from "@/lib/supabase";

// ── Username validation constants ───────────────────────────────────

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

// ── Types ───────────────────────────────────────────────────────────

export type ProfileUpdateData = {
  username?: string;
  display_name?: string;
  bio?: string | null;
  favorite_team?: string | null;
  avatar_url?: string | null;
};

export type UsernameValidationResult = {
  isValid: boolean;
  error?: string;
};

// ── Validation (pure, no DB) ────────────────────────────────────────

export function validateUsername(username: string): UsernameValidationResult {
  if (username.length < USERNAME_MIN_LENGTH) {
    return { isValid: false, error: "Username must be at least 3 characters" };
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return { isValid: false, error: "Username must be 20 characters or less" };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return {
      isValid: false,
      error: "Only letters, numbers, and underscores allowed",
    };
  }
  return { isValid: true };
}

// ── Supabase queries ────────────────────────────────────────────────

export async function checkUsernameAvailable(
  username: string,
  currentUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", currentUserId)
    .limit(1);

  if (error) throw error;
  return data.length === 0;
}

export async function updateProfile(
  userId: string,
  profileData: ProfileUpdateData,
): Promise<void> {
  // Build update payload with only defined fields to avoid overwriting with undefined
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if ("username" in profileData) payload.username = profileData.username;
  if ("display_name" in profileData)
    payload.display_name = profileData.display_name;
  if ("bio" in profileData) payload.bio = profileData.bio;
  if ("favorite_team" in profileData)
    payload.favorite_team = profileData.favorite_team;
  if ("avatar_url" in profileData) payload.avatar_url = profileData.avatar_url;

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId);

  if (error) throw error;
}

/**
 * Check if user profile has been customized (username changed from default).
 * Default pattern: user_<12 hex chars> (17 chars total).
 */
export async function checkProfileComplete(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  if (error) throw error;

  const defaultPattern = /^user_[a-f0-9]{12}$/;
  return !defaultPattern.test(data.username);
}

// ── Storage ─────────────────────────────────────────────────────────

export async function uploadAvatar(
  userId: string,
  uri: string,
): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `${userId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  return publicUrl;
}
