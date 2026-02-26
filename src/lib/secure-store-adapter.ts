import * as SecureStore from "expo-secure-store";

/**
 * Chunk size for splitting large values.
 * iOS Keychain has a ~2048-byte limit per item.
 * Supabase sessions can exceed this with rich provider metadata.
 */
const CHUNK_SIZE = 1800;

function getChunkKey(key: string, index: number): string {
  return `${key}__chunk_${index}`;
}

function getCountKey(key: string): string {
  return `${key}__count`;
}

function removeChunks(key: string, count: number): void {
  const countKey = getCountKey(key);
  SecureStore.deleteItemAsync(countKey);
  for (let i = 0; i < count; i++) {
    SecureStore.deleteItemAsync(getChunkKey(key, i));
  }
}

/**
 * Supabase-compatible storage adapter using expo-secure-store.
 * Implements chunking to handle iOS Keychain's 2048-byte limit.
 *
 * Conforms to Supabase's SupportedStorage interface:
 * - getItem(key): string | null
 * - setItem(key, value): void
 * - removeItem(key): void | Promise<void>
 */
export const secureStoreAdapter = {
  getItem(key: string): string | null {
    const countStr = SecureStore.getItem(getCountKey(key));

    if (countStr !== null) {
      const count = parseInt(countStr, 10);
      const chunks: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = SecureStore.getItem(getChunkKey(key, i));
        if (chunk === null) {
          return null;
        }
        chunks.push(chunk);
      }
      return chunks.join("");
    }

    return SecureStore.getItem(key);
  },

  setItem(key: string, value: string): void {
    // Clean up any previous chunks
    const existingCountStr = SecureStore.getItem(getCountKey(key));
    if (existingCountStr !== null) {
      removeChunks(key, parseInt(existingCountStr, 10));
    }

    if (value.length <= CHUNK_SIZE) {
      SecureStore.setItem(key, value);
      return;
    }

    // Split into chunks
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    SecureStore.setItem(getCountKey(key), String(chunks.length));
    for (let i = 0; i < chunks.length; i++) {
      SecureStore.setItem(getChunkKey(key, i), chunks[i]);
    }
  },

  removeItem(key: string): void {
    const countStr = SecureStore.getItem(getCountKey(key));
    if (countStr !== null) {
      removeChunks(key, parseInt(countStr, 10));
    }
    SecureStore.deleteItemAsync(key);
  },
};
