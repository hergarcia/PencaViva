import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Platform-safe key-value storage.
 * Uses expo-secure-store on native (iOS/Android) and localStorage on web.
 */
export async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setStorageItem(
  key: string,
  value: string,
): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
